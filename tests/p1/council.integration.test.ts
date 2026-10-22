import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { createTempDb } from "./helpers/db";
import { actor, reportDto } from "./helpers/dto";
import { loadRoster } from "../../src/server/roster";
import { createServices, type Services } from "../../src/server/services";
import { createHttpHandler } from "../../src/server/http";
import { ok, type ApiResult } from "../../src/contracts/api";
import { createStubAuth, createStubCrypto, createVoiceVaultLive } from "../../src/integration/browser-runtime";
import { createVoiceVaultUIRuntime } from "../../src/integration/ui-runtime";

const roster = loadRoster();
const j1 = actor("subject-juror-1"), j2 = actor("subject-juror-2"), j3 = actor("subject-juror-3");
let db: ReturnType<typeof createTempDb>, svc: Services;
let clock: Date;
function data<T>(r: ApiResult<T>): T { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.data; }
function proposal(subject = "subject-an") {
  return { contractVersion: "v1", expectedCouncilVersion: 1, reason: "Add an eligible council member", proposedMembers: [...roster.council.members.map(m => ({ ...m })), { subject, membershipRole: "MEMBER", active: true, independent: false }], proposedSelectionPolicy: { minVoters: 3, maxVoters: 5 } };
}
const vote = async (who: typeof j1, id: string, decision: "APPROVE" | "DENY" = "APPROVE") => data(await svc.castVote(who, id, { contractVersion: "v1", votingRequestId: id, decision, reason: "Reviewed proposal" }));
async function ready(subject?: string) {
  const p = data(await svc.submitCouncilChange(j1, proposal(subject)));
  await vote(j1, p.votingRequestId!);
  expect((await vote(j3, p.votingRequestId!)).state).toBe("READY");
  return p;
}
beforeAll(() => { db = createTempDb(); });
afterAll(async () => { await db?.cleanup(); });
beforeEach(async () => {
  // deleteMany is dependency-safe: proposals reference rounds by immutable IDs, not FK.
  await db.prisma.vote.deleteMany();
  await db.prisma.votingRequest.deleteMany();
  await db.prisma.councilChange.deleteMany();
  await db.prisma.councilSnapshot.deleteMany();
  await db.prisma.councilState.deleteMany();
  await db.prisma.report.deleteMany();
  await db.prisma.auditEvent.deleteMany();
  clock = new Date("2026-10-22T10:00:00Z");
  svc = createServices({ prisma: db.prisma, roster, now: () => clock, drawInt: (min) => min });
});

describe("APP council governance", () => {
  it("creates an immutable proposal voted by the old roster, without early authority", async () => {
    const p = data(await svc.submitCouncilChange(j1, proposal()));
    expect(p).toMatchObject({ state: "COLLECTING", baseCouncilVersion: 1, diff: { added: ["subject-an"], removed: [], changed: [] } });
    const round = data(await svc.getVotingRequest(j1, p.votingRequestId!));
    expect(round).toMatchObject({ operation: "CHANGE_COUNCIL", resourceKind: "COUNCIL_CHANGE", voterCount: 3, quorumRequired: 2 });
    expect(round.voters.map(v => v.subject)).toEqual(expect.arrayContaining([j1.subject, j2.subject, j3.subject]));
    expect(round.voters.map(v => v.subject)).not.toContain("subject-an");
    expect(data(await svc.getCouncil(j1)).version).toBe(1);
    expect(data(await svc.getMe(actor("subject-an"))).capabilities).not.toContain("vote");
    expect(await svc.applyCouncilChange(j1, p.id, { contractVersion: "v1", expectedCouncilVersion: 1 })).toMatchObject({ ok: false, error: { code: "QUORUM_PENDING" } });
    await vote(j1, p.votingRequestId!); await vote(j2, p.votingRequestId!);
    expect(await svc.applyCouncilChange(j1, p.id, { contractVersion: "v1", expectedCouncilVersion: 1 })).toMatchObject({ ok: false, error: { code: "QUORUM_PENDING" } });
    await vote(j3, p.votingRequestId!);
    expect(data(await svc.getCouncil(j1)).version).toBe(1);
  });

  it("applies once, persists history across service instances and uses new roster for reports", async () => {
    const p = await ready();
    const applied = data(await svc.applyCouncilChange(j1, p.id, { contractVersion: "v1", expectedCouncilVersion: 1 }));
    expect(applied.state).toBe("APPLIED");
    const restarted = createServices({ prisma: db.prisma, roster, drawInt: (min) => min });
    const council = data(await restarted.getCouncil(j1));
    expect(council.version).toBe(2);
    expect(council.members.map(m => m.subject)).toContain("subject-an");
    expect(council.rosterHash).not.toBe(roster.rosterHash);
    expect(data(await restarted.getMe(actor("subject-an"))).capabilities).toContain("vote");
    expect(data(await svc.applyCouncilChange(j1, p.id, { contractVersion: "v1", expectedCouncilVersion: 1 })).state).toBe("APPLIED");
    expect(await db.prisma.councilSnapshot.count()).toBe(2);
    expect(await db.prisma.auditEvent.count({ where: { action: "COUNCIL_CHANGE_APPLIED" } })).toBe(1);
    const report = data(await restarted.createReport(actor("subject-an"), await reportDto(["subject-binh"])));
    expect(report).toMatchObject({ councilVersion: 2, councilRosterHash: council.rosterHash });
  });

  it("reuses identical targets even with changed reason or concurrent retries, never redraws", async () => {
    const results = await Promise.all([proposal(), { ...proposal(), reason: "Different reason cannot redraw" }].map(p => svc.submitCouncilChange(j1, p)));
    expect(data(results[0]).id).toBe(data(results[1]).id);
    expect(await db.prisma.councilChange.count()).toBe(1);
    expect(await db.prisma.votingRequest.count()).toBe(1);
  });

  it("excludes changed incumbents and waits if fewer than the fixed minimum remain", async () => {
    const input = proposal(); input.proposedMembers[0].membershipRole = "MEMBER";
    const p = data(await svc.submitCouncilChange(j1, input));
    expect(p).toMatchObject({ state: "AWAITING_ELIGIBLE_JURY", votingRequestId: null });
    expect(data(await svc.getCouncil(j1)).version).toBe(1);
  });

  it("DENY and expired READY proposals cannot apply", async () => {
    const p = data(await svc.submitCouncilChange(j1, proposal()));
    await vote(j2, p.votingRequestId!, "DENY");
    expect(await svc.applyCouncilChange(j1, p.id, { contractVersion: "v1", expectedCouncilVersion: 1 })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    const r = await ready("subject-binh");
    clock = new Date(clock.getTime() + 73 * 3600 * 1000);
    expect(await svc.applyCouncilChange(j1, r.id, { contractVersion: "v1", expectedCouncilVersion: 1 })).toMatchObject({ ok: false, error: { code: "APPROVAL_EXPIRED" } });
  });

  it("two concurrent applies publish only one new version and stale every old pending round", async () => {
    const a = await ready(), b = await ready("subject-binh");
    const report = data(await svc.createReport(actor("subject-an"), await reportDto(["subject-an"])));
    const unmask = data(await svc.createUnmaskRequest(j1, report.id, { contractVersion: "v1", recipientSubject: j3.subject, purpose: "Review evidence" }));
    await vote(j1, unmask.id); await vote(j3, unmask.id);
    const results = await Promise.all([a, b].map(p => svc.applyCouncilChange(j1, p.id, { contractVersion: "v1", expectedCouncilVersion: 1 })));
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.find(r => !r.ok)).toMatchObject({ error: { code: "COUNCIL_VERSION_CONFLICT" } });
    expect(data(await svc.getCouncil(j1)).version).toBe(2);
    expect(data(await svc.getVotingRequest(j1, unmask.id)).state).toBe("STALE");
    expect(await svc.getReportIdentityEnvelope(j3, report.id, unmask.id)).toMatchObject({ ok: false, error: { code: "COUNCIL_VERSION_CONFLICT" } });
    expect(data(await svc.getReport(j1, report.id)).capabilities).not.toContain("requestUnmask");
    expect(await svc.castVote(j1, unmask.id, { contractVersion: "v1", votingRequestId: unmask.id, decision: "APPROVE", reason: "old" })).toMatchObject({ ok: false });
    expect(await svc.createUnmaskRequest(j1, report.id, { contractVersion: "v1", recipientSubject: j3.subject, purpose: "Retry" })).toMatchObject({ ok: false, error: { code: "COUNCIL_VERSION_CONFLICT" } });
  });

  it("validates roles, org, target membership, independent and policy", async () => {
    expect(await svc.submitCouncilChange(actor("subject-an"), proposal())).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await svc.submitCouncilChange({ ...j1, organizationId: "other" }, proposal())).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    for (const invalid of [proposal("ghost"), { ...proposal(), proposedMembers: [...roster.council.members, roster.council.members[0]] }, { ...proposal(), proposedSelectionPolicy: { minVoters: 2, maxVoters: 5 } }, { ...proposal(), proposedMembers: roster.council.members.map(m => ({ ...m, independent: false })) }]) {
      expect(await svc.submitCouncilChange(j1, invalid)).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
    }
    expect(await svc.submitCouncilChange(j1, { ...proposal(), expectedCouncilVersion: 2 })).toMatchObject({ ok: false, error: { code: "COUNCIL_VERSION_CONFLICT" } });
  });

  it("maps proposal and vote APIs for the UI but keeps HTTP apply policy-locked", async () => {
    const handler = createHttpHandler({ authenticate: async () => ok(j1), getServices: () => svc });
    const ui = createVoiceVaultUIRuntime(createVoiceVaultLive({ apiBase: "/api/v1", auth: createStubAuth({ authenticated: true, subject: j1.subject }), crypto: createStubCrypto(), fetch: async (url, init) => handler(new Request(new URL(String(url), "https://app.test"), init)) }));
    expect(await ui.getCouncil()).toMatchObject({ ok: true, data: { capabilities: { canPropose: true } } });
    const p = data(await ui.submitCouncilChange(proposal()));
    expect(p).toMatchObject({ status: "COLLECTING", voting: { status: "COLLECTING" }, capabilities: { canApply: false } });
    expect(await ui.listCouncilChanges()).toMatchObject({ ok: true, data: { items: [{ id: p.id }] } });
    const response = await handler(new Request(`https://app.test/api/v1/council/change-requests/${p.id}/apply`, { method: "POST", headers: { authorization: "Bearer signed-token" }, body: JSON.stringify({ contractVersion: "v1", expectedCouncilVersion: 1 }) }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "POLICY_UNAVAILABLE" } });
    expect(await ui.applyCouncilChange(p.id, 1)).toMatchObject({ ok: false, error: { code: "POLICY_UNAVAILABLE" } });
  });

  it("rejects forged payload binding and a different executor without publishing", async () => {
    const p = await ready();
    expect(await svc.applyCouncilChange(j2, p.id, { contractVersion: "v1", expectedCouncilVersion: 1 })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    await db.prisma.votingRequest.update({ where: { id: p.votingRequestId! }, data: { payloadHash: "forged" } });
    expect(await svc.applyCouncilChange(j1, p.id, { contractVersion: "v1", expectedCouncilVersion: 1 })).toMatchObject({ ok: false, error: { code: "INTEGRITY_MISMATCH" } });
    expect(data(await svc.getCouncil(j1)).version).toBe(1);
  });

  it("preserves terminal denial history when another proposal publishes", async () => {
    const denied = data(await svc.submitCouncilChange(j1, proposal()));
    await vote(j2, denied.votingRequestId!, "DENY");
    const accepted = await ready("subject-binh");
    data(await svc.applyCouncilChange(j1, accepted.id, { contractVersion: "v1", expectedCouncilVersion: 1 }));
    expect(data(await svc.getCouncilChange(j1, denied.id)).state).toBe("DENIED");
    expect(data(await svc.getVotingRequest(j1, denied.votingRequestId!)).state).toBe("DENIED");
  });

  it("rolls back roster publication, history and round state if audit fails", async () => {
    const p = await ready();
    const audit = await db.prisma.auditEvent.findFirstOrThrow();
    const broken = createServices({ prisma: db.prisma, roster, now: () => clock, newId: () => audit.id });
    await expect(broken.applyCouncilChange(j1, p.id, { contractVersion: "v1", expectedCouncilVersion: 1 })).rejects.toThrow();
    expect(data(await svc.getCouncil(j1)).version).toBe(1);
    expect(await db.prisma.councilSnapshot.count()).toBe(1);
    expect(data(await svc.getCouncilChange(j1, p.id)).state).toBe("READY");
    expect(await db.prisma.auditEvent.count({ where: { action: "COUNCIL_CHANGE_APPLIED" } })).toBe(0);
  });
});
