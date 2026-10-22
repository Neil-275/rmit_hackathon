// Đọc và kiểm tra config/roster.json (council, persona, directory). Placeholder cho tới khi có subject Tide thật.
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { CouncilMember, DirectoryPerson, SelectionPolicy } from "./domain/council";

export interface Persona {
  subject: string;
  displayName: string;
  roles: string[];
}

export interface Roster {
  organizationId: string;
  policyVersion: string;
  council: { version: number; selectionPolicy: SelectionPolicy; members: CouncilMember[] };
  personas: Persona[];
  directory: DirectoryPerson[];
  rosterHash: string;
}

const fail = (message: string): never => {
  throw new Error(`roster.json không hợp lệ: ${message}`);
};

export function parseRoster(raw: unknown): Roster {
  const r = raw as Partial<Roster> | null;
  if (!r || typeof r !== "object") fail("không phải object");
  const { organizationId, policyVersion, council, personas, directory } = r as Roster;
  if (typeof organizationId !== "string" || !organizationId) fail("organizationId");
  if (typeof policyVersion !== "string" || !policyVersion) fail("policyVersion");
  if (!council || !Number.isInteger(council.version) || !Array.isArray(council.members)) fail("council");
  const { minVoters, maxVoters } = council.selectionPolicy ?? ({} as SelectionPolicy);
  if (!(minVoters >= 3 && minVoters <= maxVoters && maxVoters <= 5)) fail("selectionPolicy");
  const subjects = council.members.map((m) => m.subject);
  if (new Set(subjects).size !== subjects.length) fail("council member trùng");
  if (council.members.length < 3 || !council.members.some((m) => m.independent && m.active)) {
    fail("council cần >= 3 người và một independent active");
  }
  if (!Array.isArray(personas) || !Array.isArray(directory)) fail("personas/directory");
  const ids = new Set(directory.map((p) => p.id));
  if (ids.size !== directory.length) fail("directory id trùng");
  for (const m of council.members) if (!ids.has(m.subject)) fail(`${m.subject} không có trong directory`);

  const members = council.members.map((m) => ({
    subject: m.subject, displayName: m.displayName, membershipRole: m.membershipRole,
    independent: m.independent === true, active: m.active === true,
  }));
  const selectionPolicy = { minVoters, maxVoters };
  const rosterHash = createHash("sha256").update(JSON.stringify({
    schema: "voicevault.council.v1",
    organizationId,
    version: council.version,
    selectionPolicy,
    members: [...members].sort((a, b) => a.subject.localeCompare(b.subject)),
  })).digest("hex");

  return {
    organizationId,
    policyVersion,
    council: { version: council.version, selectionPolicy, members },
    personas: personas.map((p) => ({ subject: p.subject, displayName: p.displayName, roles: [...p.roles] })),
    directory: directory.map((p) => ({ id: p.id, displayName: p.displayName, managerId: p.managerId ?? null })),
    rosterHash,
  };
}

export function loadRoster(file = path.join(process.cwd(), "config", "roster.json")): Roster {
  return parseRoster(JSON.parse(readFileSync(file, "utf8")));
}
