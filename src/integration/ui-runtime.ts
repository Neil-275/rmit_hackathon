// Translate the P1 API views to the current static UI handoff. This is not an authorization layer.
import { fail, isApiResult, type ApiResult } from "../contracts/api";

type View = Record<string, unknown>;
export type RuntimeSource = { contractVersion: string; mode: string; [key: string]: unknown };
const record = (value: unknown): View => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid view");
  return value as View;
};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const unavailable = () => fail("POLICY_UNAVAILABLE", "This operation requires a verified Tide policy and is currently unavailable.", { enforcement: "APP" });

// simulatedTide: the server runs Simulated TideCloak, so its own role checks gate submission and reveal.
export function createVoiceVaultUIRuntime(core: RuntimeSource, options: { simulatedTide?: boolean } = {}) {
  const simulated = options.simulatedTide === true;
  async function call(name: string, args: unknown[]): Promise<ApiResult<unknown>> {
    const fn = core[name];
    if (typeof fn !== "function") return unavailable();
    const result: unknown = await fn.apply(core, args);
    if (!isApiResult(result)) throw new Error("Invalid ApiResult");
    return result;
  }
  async function mapped<T>(name: string, args: unknown[], convert: (data: unknown) => T | Promise<T>): Promise<ApiResult<T>> {
    try {
      const result = await call(name, args);
      return result.ok ? { ...result, data: await convert(result.data) } : result;
    } catch (error) {
      if (isApiResult(error) && !error.ok) return error;
      return fail("CONTRACT_MISMATCH", "The API response does not match the UI contract.", { enforcement: "CLIENT" });
    }
  }
  async function page<T>(data: unknown, convert: (item: unknown) => T | Promise<T>) {
    const value = record(data);
    if (!Array.isArray(value.items)) throw new Error("Invalid page");
    return { items: await Promise.all(value.items.map(convert)), nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null };
  }
  function session(data: unknown) {
    const value = record(data), roles = strings(value.roles), cap = strings(value.capabilities);
    const authenticated = value.authenticated === true;
    const role = roles.includes("director") ? "director" : roles.includes("manager") ? "manager"
      : roles.includes("it_admin") ? "it_admin" : cap.includes("vote") ? "ethics_pool" : "engineer";
    return {
      authenticated, subject: authenticated ? value.subject : null,
      displayName: authenticated ? String(value.displayName || value.subject || "Member") : "Signed out",
      role: authenticated ? role : null, roles,
      organizationId: value.organizationId,
      // HTTP submissions remain locked until encrypted-envelope provenance is verified.
      capabilities: { canSubmit: simulated && cap.includes("submitIdea"), canProposeCouncil: false },
    };
  }
  function idea(data: unknown) {
    const value = record(data), cap = strings(value.capabilities);
    return {
      id: value.id, title: value.title, description: value.description, category: typeof value.category === "string" ? value.category.toUpperCase() : value.category,
      status: value.status, version: value.version, createdAt: value.createdAt,
      endorsedBy: value.endorsedBy ?? null, endorsedAt: value.endorsedAt ?? null,
      publicCredit: typeof value.publicCredit === "string" ? { displayName: value.publicCredit } : null,
      capabilities: { canEndorse: cap.includes("endorse"), canDecide: cap.includes("decide"), canReveal: simulated && cap.includes("revealIdentity") },
    };
  }
  function voting(data: unknown) {
    const value = record(data), cap = strings(value.capabilities);
    if (!Array.isArray(value.voters)) throw new Error("Invalid voters");
    const voters = value.voters.map((v) => {
      const person = record(v);
      return { id: person.subject, displayName: String(person.displayName || person.subject), independent: person.independent === true };
    });
    const validApprovals = value.voters.flatMap((v) => {
      const person = record(v);
      return person.decision === "APPROVE" || person.decision === "DENY" ? [{ voterId: person.subject, decision: person.decision }] : [];
    });
    return {
      id: value.id, resourceId: value.resourceId, operation: value.operation, status: value.state,
      voters, voterCount: value.voterCount, quorumRequired: value.quorumRequired,
      approvalCount: value.validApprovals, validApprovals, independentApproved: value.independentApproved,
      councilVersion: value.councilVersion, expiresAt: value.expiresAt, recipientSubject: value.recipientSubject, purpose: value.purpose,
      canVote: cap.includes("vote"), canReveal: simulated && cap.includes("revealIdentity"),
    };
  }
  async function report(data: unknown) {
    const value = record(data), cap = strings(value.capabilities);
    let round = null;
    if (typeof value.votingRequestId === "string") {
      const result = await call("getVotingRequest", [value.votingRequestId]);
      if (!result.ok) throw result;
      round = voting(result.data);
    }
    return {
      id: value.id, title: value.title, evidenceDetails: value.evidenceDetails, status: value.status,
      version: value.version, createdAt: value.createdAt, accusedPersonIds: value.accusedPersonIds,
      voterCount: value.voterCount, quorumRequired: value.quorumRequired,
      voters: Array.isArray(value.voters) ? value.voters.map(v => { const person = record(v); return { id: person.subject, displayName: String(person.displayName || person.subject), independent: person.independent === true }; }) : [],
      votingRequestId: value.votingRequestId, voting: round,
      capabilities: { canRequestUnmask: cap.includes("requestUnmask") },
    };
  }
  const runtime = {
    contractVersion: "v1", mode: "LIVE", simulatedTide: simulated,
    // The API has no council-change service yet; the UI shows a note instead of an outage.
    features: { councilChanges: false },
    init: () => mapped("init", [], session),
    getSession: () => mapped("getSession", [], session),
    login: () => mapped("login", [], session),
    logout: () => mapped("logout", [], session),
    listIdeas: (query?: unknown) => mapped("listIdeas", [query], (data) => page(data, idea)),
    getIdea: (id?: unknown) => mapped("getIdea", [id], idea),
    submitIdea: simulated ? (input?: unknown) => mapped("submitIdea", [input], idea) : async (..._args: unknown[]) => unavailable(),
    decideIdea: (id?: unknown, input?: unknown) => mapped("decideIdea", [id, input], idea),
    listReports: (query?: unknown) => mapped("listReports", [query], (data) => page(data, report)),
    getReport: (id?: unknown) => mapped("getReport", [id], report),
    submitReport: simulated ? (input?: unknown) => mapped("submitReport", [input], report) : async (..._args: unknown[]) => unavailable(),
    getDirectory: () => mapped("getDirectory", [], (data) => { const value = record(data); if (!Array.isArray(value.people)) throw new Error("Invalid directory"); return { people: value.people }; }),
    createUnmaskRequest: (id?: unknown, input?: unknown) => mapped("createUnmaskRequest", [id, input], (data) => {
      const value = record(data); return { id: value.id, votingRequestId: value.votingRequestId, voting: voting(value) };
    }),
    getVotingRequest: (id?: unknown) => mapped("getVotingRequest", [id], voting),
    listMyVotingRequests: (query?: unknown) => mapped("listMyVotingRequests", [query], (data) => page(data, voting)),
    castVote: (id?: unknown, input?: unknown) => mapped("castVote", [id, input], voting),
    getCouncil: () => mapped("getCouncil", [], (data) => ({ ...record(data), capabilities: { canPropose: false } })),
    listAudit: (query?: unknown) => mapped("listAudit", [query], (data) => page(data, (item) => {
      const value = record(item);
      return { id: value.id, action: value.action, targetId: value.resourceId, enforcement: value.source, createdAt: value.occurredAt, actor: "Recorded action", outcome: value.result === "OK" ? "ALLOWED" : value.result };
    })),
    // No APP-only vote or director role can activate an unverified cryptographic release.
    revealIdentity: simulated
      ? (kind?: unknown, id?: unknown, round?: unknown) => mapped("revealIdentity", [kind, id, round], (data) => { const v = record(data); return { displayName: v.displayName, contact: v.contact ?? null, simulated: true }; })
      : async (..._args: unknown[]) => unavailable(),
    endorseIdea: (id?: unknown, expectedVersion?: unknown) => mapped("endorseIdea", [id, expectedVersion], idea),
    listCouncilChanges: async (..._args: unknown[]) => unavailable(),
    submitCouncilChange: async (..._args: unknown[]) => unavailable(),
    applyCouncilChange: async (..._args: unknown[]) => unavailable(),
  };
  return runtime;
}
