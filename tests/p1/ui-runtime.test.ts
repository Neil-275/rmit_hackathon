import { describe, expect, it } from "vitest";
import { ok, fail } from "../../src/contracts/api";
import { createVoiceVaultUIRuntime } from "../../src/integration/ui-runtime";

function core(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: "v1", mode: "LIVE",
    init: async () => ok({ authenticated: true, subject: "director", displayName: "Director", roles: ["director"], capabilities: ["decideIdea"] }),
    getSession: async () => ok({ authenticated: true, subject: "employee", roles: ["employee"], capabilities: ["submitIdea", "submitReport"] }),
    listIdeas: async () => ok({ items: [{ id: "idea", status: "UNDER_REVIEW", capabilities: ["decide", "revealIdentity"], publicCredit: null }], nextCursor: null }),
    listReports: async () => ok({ items: [{ id: "report", capabilities: ["requestUnmask"], votingRequestId: "round" }], nextCursor: null }),
    getVotingRequest: async () => ok({ id: "round", state: "READY", operation: "REVEAL_REPORT_IDENTITY", resourceId: "report", purpose: "Review evidence", validApprovals: 2, independentApproved: true, capabilities: ["revealIdentity"], voters: [{ subject: "juror", displayName: "Juror", independent: true, hasVoted: true, decision: "APPROVE" }] }),
    getCouncil: async () => ok({ version: 1, members: [], selectionPolicy: { minVoters: 3, maxVoters: 5 } }),
    listAudit: async () => ok({ items: [{ id: "event", occurredAt: "2026-10-22T00:00:00.000Z", source: "APP", resourceId: "idea", action: "IDEA_APPROVED" }], nextCursor: null }),
    revealIdentity: async () => { throw new Error("must never be called"); },
    ...overrides,
  };
}

describe("current static UI adapter", () => {
  it("maps session capabilities and role without inventing authenticated users", async () => {
    const ui = createVoiceVaultUIRuntime(core());
    const session = await ui.getSession();
    expect(session.ok && session.data.capabilities.canSubmit).toBe(false);
    expect(session.ok && session.data.role).toBe("engineer");
    const unavailable = createVoiceVaultUIRuntime(core({ getSession: async () => fail("UNAUTHENTICATED", "expired") }));
    expect(await unavailable.getSession()).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("maps idea actions but never offers unverified identity release", async () => {
    const result = await createVoiceVaultUIRuntime(core()).listIdeas();
    expect(result.ok && result.data.items[0].capabilities).toEqual({ canEndorse: false, canDecide: true, canReveal: false });
  });

  it("hydrates nested voting and maps counts separately from actual decisions", async () => {
    const result = await createVoiceVaultUIRuntime(core()).listReports();
    expect(result.ok && result.data.items[0].voting).toMatchObject({
      status: "READY", purpose: "Review evidence", approvalCount: 2, validApprovals: [{ voterId: "juror", decision: "APPROVE" }], canReveal: false,
    });
  });

  it("supplies council capabilities and the audit fields consumed by the UI", async () => {
    const ui = createVoiceVaultUIRuntime(core());
    expect(await ui.getCouncil()).toMatchObject({ ok: true, data: { capabilities: { canPropose: false } } });
    expect(await ui.listAudit()).toMatchObject({ ok: true, data: { items: [{ createdAt: "2026-10-22T00:00:00.000Z", enforcement: "APP", targetId: "idea" }] } });
  });

  it("fails closed for reveal and does not invent empty lists when a service fails", async () => {
    const ui = createVoiceVaultUIRuntime(core({ listReports: async () => fail("FORBIDDEN", "denied") }));
    expect(await ui.revealIdentity("REPORT", "report", "round")).toMatchObject({ ok: false, error: { code: "POLICY_UNAVAILABLE" } });
    expect(await ui.listReports()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});
