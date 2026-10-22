// APP governance persistence. HTTP apply stays locked until Tide G3/G5 are verified.
import { createHash } from "node:crypto";
import type { Prisma, CouncilChange, CouncilState } from "@prisma/client";
import { fail, ok, validateCouncilChangeRequest, validateCouncilVersionRequest, validateListQuery,
  type Actor, type ApiResult, type CouncilChangeView, type CouncilView, type Page, type VotingRequestView } from "../../contracts/api";
import { computeEligible, selectVotingAssignment } from "../domain/council";
import { isTerminal, tally, type VotingState } from "../domain/voting";
import { parseRoster, type Roster } from "../roster";
import type { ServiceDeps } from "./index";

type Tx = Prisma.TransactionClient;
type Round = Prisma.VotingRequestGetPayload<{ include: { votes: true } }>;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const isMember = (r: Roster, subject: string) => r.council.members.some(m => m.subject === subject && m.active);
const permitted = (r: Roster, a: Actor) => isMember(r, a.subject) || a.roles.includes("it_admin");

export function createCouncilServices(deps: Required<Pick<ServiceDeps, "prisma" | "roster" | "now" | "drawInt" | "newId" | "votingTtlMs">>,
  hooks: { guard: (actor: Actor) => ApiResult<never> | null; votingView: (row: Round, actor: Actor) => VotingRequestView }) {
  const { prisma, roster, now, drawInt, newId, votingTtlMs } = deps;
  const org = roster.organizationId;
  const seed = { organizationId: org, version: roster.council.version, rosterHash: roster.rosterHash,
    membersJson: JSON.stringify(roster.council.members), policyJson: JSON.stringify(roster.council.selectionPolicy) };
  async function ensure() {
    await prisma.councilState.upsert({ where: { organizationId: org }, create: seed, update: {} });
    await prisma.councilSnapshot.upsert({ where: { organizationId_version: { organizationId: org, version: seed.version } }, create: seed, update: {} });
  }
  function decode(row: CouncilState): Roster {
    const effective = parseRoster({ ...roster, council: { version: row.version, members: JSON.parse(row.membersJson), selectionPolicy: JSON.parse(row.policyJson) } });
    if (effective.rosterHash !== row.rosterHash) throw new Error("COUNCIL_INTEGRITY_MISMATCH");
    return effective;
  }
  async function effectiveRoster() {
    await ensure();
    return decode(await prisma.councilState.findUniqueOrThrow({ where: { organizationId: org } }));
  }
  // First transaction operation is a write: serialize voting/apply/proposal across processes in SQLite.
  async function lock(tx: Tx) {
    return decode(await tx.councilState.update({ where: { organizationId: org }, data: { revision: { increment: 1 } } }));
  }
  const snapshot = (r: Round) => ({ state: r.state as VotingState, voters: JSON.parse(r.votersJson), quorumRequired: r.quorumRequired, expiresAt: r.expiresAt,
    votes: r.votes.map(v => ({ voterSubject: v.voterSubject, decision: v.decision as "APPROVE" | "DENY" })) });
  async function view(row: CouncilChange, actor: Actor, effective: Roster, db: Tx = prisma): Promise<CouncilChangeView> {
    const round = row.votingRequestId ? await db.votingRequest.findUnique({ where: { id: row.votingRequestId }, include: { votes: true } }) : null;
    const roundState = round ? tally(snapshot(round), now()).state : null;
    const state: CouncilChangeView["state"] = row.state === "APPLIED" ? "APPLIED"
      : roundState && isTerminal(roundState) ? roundState
      : row.baseCouncilVersion !== effective.council.version ? "STALE"
      : roundState ?? "AWAITING_ELIGIBLE_JURY";
    return { id: row.id, state, reason: row.reason, baseCouncilVersion: row.baseCouncilVersion,
      proposedMembers: JSON.parse(row.proposedMembersJson), proposedSelectionPolicy: JSON.parse(row.proposedPolicyJson),
      diff: JSON.parse(row.diffJson), payloadHash: row.payloadHash, votingRequestId: row.votingRequestId,
      voting: round ? { ...hooks.votingView(round, actor), state: state === "AWAITING_ELIGIBLE_JURY" ? "STALE" : state } : null,
      capabilities: state === "READY" && row.requesterSubject === actor.subject ? ["apply"] : [],
      appliedCouncilVersion: row.appliedCouncilVersion, createdAt: row.createdAt.toISOString() };
  }
  async function record(tx: Tx, action: string, resourceId: string, actor: Actor) {
    await tx.auditEvent.create({ data: { id: newId(), organizationId: org, action, resourceKind: "COUNCIL_CHANGE", resourceId,
      actorSubject: actor.subject, source: "APP", result: "OK", occurredAt: now() } });
  }
  async function getCouncil(actor: Actor): Promise<ApiResult<CouncilView>> {
    const denied = hooks.guard(actor); if (denied) return denied;
    const r = await effectiveRoster();
    return ok({ ...r.council, rosterHash: r.rosterHash, capabilities: permitted(r, actor) ? ["propose"] : [] });
  }
  async function submitCouncilChange(actor: Actor, input: unknown): Promise<ApiResult<CouncilChangeView>> {
    const denied = hooks.guard(actor); if (denied) return denied;
    const checked = validateCouncilChangeRequest(input); if (!checked.ok) return fail("INVALID_REQUEST", checked.message);
    const dto = checked.value;
    if (dto.proposedMembers.some(m => !roster.directory.some(p => p.id === m.subject))) return fail("INVALID_REQUEST", "Unknown organization member.");
    await ensure();
    return prisma.$transaction(async tx => {
      const base = await lock(tx);
      if (!permitted(base, actor)) return fail("FORBIDDEN", "Only an active council member or IT admin may propose.");
      if (base.council.version !== dto.expectedCouncilVersion) return fail("COUNCIL_VERSION_CONFLICT", "The council changed. Reload.");
      const members = [...dto.proposedMembers].sort((a, b) => a.subject.localeCompare(b.subject)).map(m => ({ ...m, displayName: roster.directory.find(p => p.id === m.subject)!.displayName }));
      const targetHash = hash({ org, baseVersion: base.council.version, baseHash: base.rosterHash, members, policy: dto.proposedSelectionPolicy });
      const existing = await tx.councilChange.findUnique({ where: { organizationId_baseCouncilVersion_targetHash: { organizationId: org, baseCouncilVersion: base.council.version, targetHash } } });
      if (existing) return ok(await view(existing, actor, base, tx));
      const old = base.council.members;
      const added = members.filter(m => !old.some(o => o.subject === m.subject)).map(m => m.subject);
      const removed = old.filter(o => !members.some(m => m.subject === o.subject)).map(m => m.subject);
      const changed = old.filter(o => { const m = members.find(m => m.subject === o.subject); return m && (o.active !== m.active || o.independent !== m.independent || o.membershipRole !== m.membershipRole); }).map(m => m.subject);
      if (!added.length && !removed.length && !changed.length && base.council.selectionPolicy.minVoters === dto.proposedSelectionPolicy.minVoters && base.council.selectionPolicy.maxVoters === dto.proposedSelectionPolicy.maxVoters) return fail("INVALID_REQUEST", "The proposal makes no change.");
      const eligible = computeEligible(old, [...added, ...removed, ...changed], roster.directory);
      if (!eligible.ok) return fail("INVALID_REQUEST", eligible.message);
      const selection = selectVotingAssignment(eligible.value.eligible, base.council.selectionPolicy, drawInt);
      if (!selection.ok && selection.code !== "INSUFFICIENT_ELIGIBLE_JURORS") return fail("INVALID_REQUEST", selection.message);
      const id = newId(), roundId = selection.ok ? newId() : null;
      const payloadHash = hash({ targetHash, reason: dto.reason, recipient: actor.subject });
      const row = await tx.councilChange.create({ data: { id, organizationId: org, baseCouncilVersion: base.council.version, baseCouncilHash: base.rosterHash,
        targetHash, payloadHash, reason: dto.reason, requesterSubject: actor.subject, proposedMembersJson: JSON.stringify(members), proposedPolicyJson: JSON.stringify(dto.proposedSelectionPolicy),
        diffJson: JSON.stringify({ added, removed, changed }), state: selection.ok ? "COLLECTING" : "AWAITING_ELIGIBLE_JURY", votingRequestId: roundId, createdAt: now() } });
      if (selection.ok && roundId) await tx.votingRequest.create({ data: { id: roundId, organizationId: org, operation: "CHANGE_COUNCIL", resourceKind: "COUNCIL_CHANGE", resourceId: id,
        voterCount: selection.value.voterCount, quorumRequired: selection.value.quorumRequired, votersJson: JSON.stringify(selection.value.voters),
        councilVersion: base.council.version, councilRosterHash: base.rosterHash, recipientSubject: actor.subject, purpose: dto.reason,
        payloadHash, nonce: newId(), state: "COLLECTING", createdAt: now(), expiresAt: new Date(now().getTime() + votingTtlMs) } });
      await record(tx, "COUNCIL_CHANGE_PROPOSED", id, actor);
      return ok(await view(row, actor, base, tx));
    });
  }
  async function getCouncilChange(actor: Actor, id: string): Promise<ApiResult<CouncilChangeView>> {
    const denied = hooks.guard(actor); if (denied) return denied;
    const base = await effectiveRoster(), row = await prisma.councilChange.findFirst({ where: { id, organizationId: org } });
    return row ? ok(await view(row, actor, base)) : fail("NOT_FOUND", "Proposal not found.");
  }
  async function listCouncilChanges(actor: Actor, query?: unknown): Promise<ApiResult<Page<CouncilChangeView>>> {
    const denied = hooks.guard(actor); if (denied) return denied;
    const q = validateListQuery(query); if (!q.ok) return fail("INVALID_REQUEST", q.message);
    const offset = Number(q.value.cursor ?? 0); if (!Number.isSafeInteger(offset) || offset < 0) return fail("INVALID_REQUEST", "Invalid cursor.");
    const base = await effectiveRoster();
    const rows = await prisma.councilChange.findMany({ where: { organizationId: org }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
    const views = (await Promise.all(rows.map(row => view(row, actor, base)))).filter(v => !q.value.status || v.state === q.value.status);
    return ok({ items: views.slice(offset, offset + q.value.limit), nextCursor: views.length > offset + q.value.limit ? String(offset + q.value.limit) : null });
  }
  async function applyCouncilChange(actor: Actor, id: string, input: unknown): Promise<ApiResult<CouncilChangeView>> {
    const denied = hooks.guard(actor); if (denied) return denied;
    const checked = validateCouncilVersionRequest(input); if (!checked.ok) return fail("INVALID_REQUEST", checked.message);
    await ensure();
    return prisma.$transaction(async tx => {
      const base = await lock(tx), row = await tx.councilChange.findFirst({ where: { id, organizationId: org } });
      if (!row) return fail("NOT_FOUND", "Proposal not found.");
      if (row.requesterSubject !== actor.subject) return fail("FORBIDDEN", "Only the designated executor may apply.");
      if (checked.value.expectedCouncilVersion !== row.baseCouncilVersion) return fail("COUNCIL_VERSION_CONFLICT", "Wrong base version.");
      if (row.state === "APPLIED") return ok(await view(row, actor, base, tx));
      if (row.baseCouncilVersion !== base.council.version || row.baseCouncilHash !== base.rosterHash) return fail("COUNCIL_VERSION_CONFLICT", "Proposal is stale.");
      const round = row.votingRequestId ? await tx.votingRequest.findUnique({ where: { id: row.votingRequestId }, include: { votes: true } }) : null;
      if (!round) return fail("INSUFFICIENT_ELIGIBLE_JURORS", "The proposal has no eligible assignment.");
      const targetHash = hash({ org, baseVersion: row.baseCouncilVersion, baseHash: row.baseCouncilHash, members: JSON.parse(row.proposedMembersJson), policy: JSON.parse(row.proposedPolicyJson) });
      if (targetHash !== row.targetHash || hash({ targetHash, reason: row.reason, recipient: row.requesterSubject }) !== row.payloadHash
        || round.organizationId !== org || round.resourceKind !== "COUNCIL_CHANGE" || round.operation !== "CHANGE_COUNCIL" || round.resourceId !== row.id
        || round.payloadHash !== row.payloadHash || round.councilVersion !== base.council.version || round.councilRosterHash !== base.rosterHash || round.recipientSubject !== actor.subject) return fail("INTEGRITY_MISMATCH", "Voting context does not match the proposal.");
      const result = tally(snapshot(round), now());
      if (result.state === "EXPIRED") return fail("APPROVAL_EXPIRED", "Proposal has expired.");
      if (result.state === "DENIED" || result.state === "STALE") return fail("FORBIDDEN", "Proposal cannot be applied.");
      if (result.state !== "READY" || result.validApprovals < round.quorumRequired || !result.independentApproved) return fail("QUORUM_PENDING", "Quorum and independent approval are required.");
      const effective = parseRoster({ ...roster, council: { version: base.council.version + 1, members: JSON.parse(row.proposedMembersJson), selectionPolicy: JSON.parse(row.proposedPolicyJson) } });
      const published = { organizationId: org, version: effective.council.version, rosterHash: effective.rosterHash, membersJson: JSON.stringify(effective.council.members), policyJson: JSON.stringify(effective.council.selectionPolicy) };
      const updated = await tx.councilState.updateMany({ where: { organizationId: org, version: row.baseCouncilVersion, rosterHash: row.baseCouncilHash }, data: published });
      if (updated.count !== 1) return fail("COUNCIL_VERSION_CONFLICT", "Concurrent council publication.");
      await tx.councilSnapshot.create({ data: published });
      const applied = await tx.councilChange.update({ where: { id: row.id }, data: { state: "APPLIED", appliedCouncilVersion: effective.council.version } });
      await tx.votingRequest.update({ where: { id: round.id }, data: { state: "APPLIED", version: { increment: 1 } } });
      await tx.votingRequest.updateMany({ where: { organizationId: org, councilVersion: { lte: row.baseCouncilVersion }, state: { in: ["COLLECTING", "READY"] } }, data: { state: "STALE", version: { increment: 1 } } });
      await record(tx, "COUNCIL_CHANGE_APPLIED", row.id, actor);
      return ok(await view(applied, actor, effective, tx));
    });
  }
  return { ensure, effectiveRoster, lock, getCouncil, submitCouncilChange, getCouncilChange, listCouncilChanges, applyCouncilChange };
}
