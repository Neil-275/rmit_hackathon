// Contract v1 cho API P1 (/api/v1) và runtime bridge.
// Nguồn sự thật về tên field là tests/p0 (fixture + mock). Field chưa được tests/p0 khẳng định
// thì để optional và ghi trong docs/integration/p1-core.md mục "Contract cần chốt".
// File này chạy được cả browser lẫn Node: không import node:*, không API riêng của Next.

export const CONTRACT_VERSION = "v1" as const;
export type ContractVersion = typeof CONTRACT_VERSION;
export const API_PREFIX = "/api/v1";

// ---------- Enum ----------

export const ENFORCEMENTS = ["APP", "FABRIC", "QEA", "CLIENT", "SIMULATED"] as const;
export type Enforcement = (typeof ENFORCEMENTS)[number];

export const ERROR_CODES = [
  "INVALID_REQUEST", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND",
  "VERSION_CONFLICT", "COUNCIL_VERSION_CONFLICT", "COUNCIL_VOTE_REQUIRED",
  "QUORUM_PENDING", "INSUFFICIENT_ELIGIBLE_JURORS", "APPROVAL_EXPIRED",
  "INTEGRITY_MISMATCH", "POLICY_DENIED", "POLICY_UNAVAILABLE", "CONTRACT_MISMATCH",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  COUNCIL_VERSION_CONFLICT: 409,
  COUNCIL_VOTE_REQUIRED: 403,
  QUORUM_PENDING: 409,
  INSUFFICIENT_ELIGIBLE_JURORS: 409,
  APPROVAL_EXPIRED: 410,
  INTEGRITY_MISMATCH: 422,
  POLICY_DENIED: 403,
  POLICY_UNAVAILABLE: 503,
  CONTRACT_MISMATCH: 409,
};

export type ResourceKind = "IDEA" | "REPORT" | "COUNCIL_CHANGE";
export type VotingOperation = "REVEAL_REPORT_IDENTITY" | "CHANGE_COUNCIL";
export type Role = "employee" | "manager" | "director" | "auditor" | "it_admin";

export type IdeaStatus = "UNDER_REVIEW" | "ENDORSED" | "APPROVED" | "REJECTED";
export type ReportStatus = "AWAITING_ELIGIBLE_JURY" | "INVESTIGATING" | "RESOLVED";
export type VotingState = "COLLECTING" | "READY" | "DENIED" | "EXPIRED" | "STALE" | "APPLIED";
export type VoteDecision = "APPROVE" | "DENY";
export type IdeaDecision = "APPROVE" | "REJECT";

// ---------- ApiResult ----------

export interface ApiError {
  code: ErrorCode;
  message: string;
  enforcement: Enforcement;
  retryable: boolean;
}
export type ApiResult<T> =
  | { ok: true; data: T; requestId: string; contractVersion: ContractVersion }
  | { ok: false; error: ApiError; requestId: string; contractVersion: ContractVersion };

const newRequestId = (): string =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function ok<T>(data: T, requestId: string = newRequestId()): ApiResult<T> {
  return { ok: true, data, requestId, contractVersion: CONTRACT_VERSION };
}

export function fail<T = never>(
  code: ErrorCode,
  message: string,
  opts: { enforcement?: Enforcement; retryable?: boolean; requestId?: string } = {},
): ApiResult<T> {
  return {
    ok: false,
    error: {
      code,
      message,
      enforcement: opts.enforcement ?? "APP",
      retryable: opts.retryable ?? false,
    },
    requestId: opts.requestId ?? newRequestId(),
    contractVersion: CONTRACT_VERSION,
  };
}

// ---------- Actor (route -> service) ----------

/** Route gắn sau khi verify JWT; service không đọc header/token. */
export interface Actor {
  subject: string;
  organizationId: string;
  roles: string[];
}

// ---------- View ----------

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ListQuery {
  cursor?: string | null;
  limit?: number;
  status?: string;
}

export interface SessionView {
  authenticated: boolean;
  subject?: string | null;
  displayName?: string | null;
  organizationId?: string | null;
  roles: string[];
  capabilities: string[];
}

export interface IdeaView {
  id: string;
  version: number;
  status: IdeaStatus;
  title: string;
  description: string;
  category: string;
  publishCreditOnApproval: boolean;
  publicCredit: string | null;
  endorsedBy?: string | null;
  endorsedAt?: string | null;
  capabilities: string[];
  contentHash?: string;
  createdAt?: string;
  decidedAt?: string | null;
  decisionReason?: string | null;
}

export interface ReportView {
  id: string;
  version: number;
  status: ReportStatus;
  title: string;
  evidenceDetails?: string;
  accusedPersonIds: string[];
  votingRequestId: string | null;
  capabilities: string[];
  councilVersion?: number;
  councilRosterHash?: string;
  voterCount?: number | null;
  quorumRequired?: number | null;
  contentHash?: string;
  createdAt?: string;
}

export interface VoterView {
  subject: string;
  displayName?: string;
  independent: boolean;
  hasVoted: boolean;
  decision?: VoteDecision;
}

export interface VotingRequestView {
  id: string;
  version?: number;
  operation: VotingOperation;
  resourceKind: ResourceKind;
  resourceId: string;
  state: VotingState;
  voterCount: number;
  quorumRequired: number;
  voters: VoterView[];
  validApprovals: number;
  independentApproved: boolean;
  expiresAt: string;
  recipientSubject?: string;
  purpose?: string;
  councilVersion?: number;
  capabilities?: string[];
}

/** P1: một UnmaskRequest ứng với đúng một VotingRequest, id trùng votingRequestId. */
export interface UnmaskRequestView extends VotingRequestView {
  votingRequestId: string;
  reportId: string;
}

export interface CouncilMemberView {
  subject: string;
  displayName: string;
  membershipRole: "MEMBER" | "CHAIR";
  independent: boolean;
  active: boolean;
}

export interface CouncilView {
  version: number;
  rosterHash: string;
  members: CouncilMemberView[];
  selectionPolicy: { minVoters: number; maxVoters: number };
  capabilities?: string[];
}

export interface CouncilChangeRequest {
  contractVersion: ContractVersion;
  expectedCouncilVersion: number;
  reason: string;
  proposedMembers: Omit<CouncilMemberView, "displayName">[];
  proposedSelectionPolicy: CouncilView["selectionPolicy"];
}

export interface CouncilChangeView {
  id: string;
  state: VotingState | "AWAITING_ELIGIBLE_JURY";
  baseCouncilVersion: number;
  proposedMembers: CouncilMemberView[];
  proposedSelectionPolicy: CouncilView["selectionPolicy"];
  diff: { added: string[]; removed: string[]; changed: string[] };
  reason: string;
  payloadHash: string;
  votingRequestId: string | null;
  voting: VotingRequestView | null;
  capabilities: string[];
  appliedCouncilVersion: number | null;
  createdAt: string;
}

export interface DirectoryView {
  people: { id: string; displayName: string }[];
}

export interface AuditEventView {
  id: string;
  occurredAt: string;
  action: string;
  resourceKind: ResourceKind | null;
  resourceId: string | null;
  source: Enforcement;
  result: "OK" | "DENIED" | "ERROR";
  requestId?: string | null;
}

/** View tạm sau khi browser giải mã; không persist, không gửi lại server. */
export interface IdentityView {
  resourceKind: "IDEA" | "REPORT";
  resourceId: string;
  subject: string;
  displayName: string;
  contact?: string | null;
}

// ---------- Form input (UI -> runtime) ----------

export interface IdeaFormInput {
  title: string;
  description: string;
  category: string;
  publishCreditOnApproval: boolean;
}

export interface ReportFormInput {
  title: string;
  evidenceDetails: string;
  accusedPersonIds: string[];
  contact?: string;
}

export interface DecideIdeaInput {
  decision: IdeaDecision;
  reason: string;
  expectedVersion: number;
}

export interface UnmaskFormInput {
  recipientSubject: string;
  purpose: string;
}

export interface VoteInput {
  decision: VoteDecision;
  reason: string;
}

// ---------- DTO (runtime -> API) ----------

export interface ResourceBinding {
  contractVersion: ContractVersion;
  organizationId: string;
  resourceKind: "IDEA" | "REPORT";
  resourceId: string;
  contentVersion: number;
  contentHash: string;
  policyVersion: string;
}

export interface IdentityEnvelope {
  scheme: "TIDE_V1";
  tag: "idea_author" | "report_id";
  ciphertext: string;
  ciphertextHash: string;
  binding: ResourceBinding;
}

export interface CreateIdeaRequest {
  contractVersion: ContractVersion;
  id: string;
  title: string;
  description: string;
  category: string;
  publishCreditOnApproval: boolean;
  identityEnvelope: IdentityEnvelope;
}

export interface CreateReportRequest {
  contractVersion: ContractVersion;
  id: string;
  title: string;
  evidenceDetails: string;
  accusedPersonIds: string[];
  identityEnvelope: IdentityEnvelope;
}

export interface DecideIdeaRequest {
  contractVersion: ContractVersion;
  decision: IdeaDecision;
  reason: string;
  expectedVersion: number;
}

export interface EndorseIdeaRequest {
  contractVersion: ContractVersion;
  expectedVersion: number;
}

export interface CreateUnmaskRequest {
  contractVersion: ContractVersion;
  recipientSubject: string;
  purpose: string;
}

export interface SubmitApprovalRequest {
  contractVersion: ContractVersion;
  votingRequestId: string;
  decision: VoteDecision;
  reason: string;
  /** P1 chưa có proof G3; optional cho tới khi spike G1/G3 xong. */
  proof?: string;
}

/** Response của GET identity-envelope; chỉ runtime đọc, không đưa cho UI. */
export interface IdentityEnvelopeResponse {
  resourceKind: "IDEA" | "REPORT";
  resourceId: string;
  envelope: IdentityEnvelope;
}

// ---------- Route table ----------

export interface RouteSpec {
  method: "GET" | "POST";
  path: string;
  service: string;
  request?: string;
  response: string;
}

/** Route P1. `service` là tên export trong src/server/services; route chỉ gắn actor rồi gọi. */
export const ROUTES: readonly RouteSpec[] = [
  { method: "GET", path: "/me", service: "getMe", response: "SessionView" },
  { method: "GET", path: "/directory", service: "getDirectory", response: "DirectoryView" },
  { method: "GET", path: "/ideas", service: "listIdeas", request: "ListQuery(query)", response: "Page<IdeaView>" },
  { method: "POST", path: "/ideas", service: "createIdea", request: "CreateIdeaRequest", response: "IdeaView" },
  { method: "GET", path: "/ideas/:id", service: "getIdea", response: "IdeaView" },
  { method: "POST", path: "/ideas/:id/endorse", service: "endorseIdea", request: "EndorseIdeaRequest", response: "IdeaView" },
  { method: "POST", path: "/ideas/:id/decision", service: "decideIdea", request: "DecideIdeaRequest", response: "IdeaView" },
  { method: "GET", path: "/ideas/:id/identity-envelope", service: "getIdeaIdentityEnvelope", response: "IdentityEnvelopeResponse" },
  { method: "GET", path: "/reports", service: "listReports", request: "ListQuery(query)", response: "Page<ReportView>" },
  { method: "POST", path: "/reports", service: "createReport", request: "CreateReportRequest", response: "ReportView" },
  { method: "GET", path: "/reports/:id", service: "getReport", response: "ReportView" },
  { method: "POST", path: "/reports/:id/unmask-requests", service: "createUnmaskRequest", request: "CreateUnmaskRequest", response: "UnmaskRequestView" },
  { method: "GET", path: "/reports/:id/identity-envelope", service: "getReportIdentityEnvelope", request: "?votingRequestId=", response: "IdentityEnvelopeResponse" },
  { method: "GET", path: "/voting-requests/mine", service: "listMyVotingRequests", request: "ListQuery(query)", response: "Page<VotingRequestView>" },
  { method: "GET", path: "/voting-requests/:id", service: "getVotingRequest", response: "VotingRequestView" },
  { method: "POST", path: "/voting-requests/:id/approvals", service: "castVote", request: "SubmitApprovalRequest", response: "VotingRequestView" },
  { method: "GET", path: "/council", service: "getCouncil", response: "CouncilView" },
  { method: "GET", path: "/council/change-requests", service: "listCouncilChanges", response: "Page<CouncilChangeView>" },
  { method: "POST", path: "/council/change-requests", service: "submitCouncilChange", request: "CouncilChangeRequest", response: "CouncilChangeView" },
  { method: "GET", path: "/council/change-requests/:id", service: "getCouncilChange", response: "CouncilChangeView" },
  { method: "POST", path: "/council/change-requests/:id/apply", service: "applyCouncilChange", request: "expectedCouncilVersion", response: "CouncilChangeView" },
  { method: "GET", path: "/audit", service: "listAudit", request: "ListQuery(query)", response: "Page<AuditEventView>" },
] as const;

export const RUNTIME_METHODS = [
  "init", "getSession", "login", "logout",
  "listIdeas", "getIdea", "submitIdea", "endorseIdea", "decideIdea",
  "listReports", "getReport", "submitReport", "getDirectory",
  "createUnmaskRequest", "listMyVotingRequests", "getVotingRequest", "castVote",
  "getCouncil", "listCouncilChanges", "submitCouncilChange", "applyCouncilChange",
  "revealIdentity", "listAudit",
] as const;
export type RuntimeMethod = (typeof RUNTIME_METHODS)[number];

export const MAX_PAGE_SIZE = 50;

// ---------- Validator viết tay ----------

export type Validation<T> = { ok: true; value: T } | { ok: false; message: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

class Invalid extends Error {}
const need = (cond: unknown, message: string): void => {
  if (!cond) throw new Invalid(message);
};
function text(v: unknown, field: string, max: number, min = 1): string {
  need(typeof v === "string", `${field} phải là chuỗi`);
  const s = v as string;
  need(s.trim().length >= min, `${field} không được rỗng`);
  need(s.length <= max, `${field} quá dài (tối đa ${max})`);
  return s;
}
function run<T>(fn: () => T): Validation<T> {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, message: e.message };
    throw e;
  }
}
function body(v: unknown): Record<string, unknown> {
  need(isObject(v), "body phải là object");
  const o = v as Record<string, unknown>;
  need(o.contractVersion === CONTRACT_VERSION, "contractVersion phải là v1");
  return o;
}

export const LIMITS = { title: 200, description: 5000, category: 64, evidence: 10000, reason: 1000, accused: 10 };

function binding(v: unknown, kind: "IDEA" | "REPORT", resourceId: string): ResourceBinding {
  need(isObject(v), "binding phải là object");
  const b = v as Record<string, unknown>;
  need(b.contractVersion === CONTRACT_VERSION, "binding.contractVersion");
  need(typeof b.organizationId === "string" && b.organizationId.length > 0, "binding.organizationId");
  need(b.resourceKind === kind, `binding.resourceKind phải là ${kind}`);
  need(b.resourceId === resourceId, "binding.resourceId khác id");
  need(Number.isInteger(b.contentVersion) && (b.contentVersion as number) >= 1, "binding.contentVersion");
  need(typeof b.contentHash === "string" && HEX64_RE.test(b.contentHash), "binding.contentHash phải là sha256 hex");
  need(typeof b.policyVersion === "string" && b.policyVersion.length > 0, "binding.policyVersion");
  return {
    contractVersion: CONTRACT_VERSION,
    organizationId: b.organizationId as string,
    resourceKind: kind,
    resourceId,
    contentVersion: b.contentVersion as number,
    contentHash: b.contentHash as string,
    policyVersion: b.policyVersion as string,
  };
}

function envelope(v: unknown, kind: "IDEA" | "REPORT", resourceId: string): IdentityEnvelope {
  need(isObject(v), "identityEnvelope phải là object");
  const e = v as Record<string, unknown>;
  const tag = kind === "IDEA" ? "idea_author" : "report_id";
  need(e.scheme === "TIDE_V1", "identityEnvelope.scheme");
  need(e.tag === tag, `identityEnvelope.tag phải là ${tag}`);
  need(typeof e.ciphertext === "string" && e.ciphertext.length > 0 && e.ciphertext.length <= 65536, "identityEnvelope.ciphertext");
  need(typeof e.ciphertextHash === "string" && HEX64_RE.test(e.ciphertextHash), "identityEnvelope.ciphertextHash");
  return {
    scheme: "TIDE_V1",
    tag,
    ciphertext: e.ciphertext as string,
    ciphertextHash: e.ciphertextHash as string,
    binding: binding(e.binding, kind, resourceId),
  };
}

export function validateCreateIdeaRequest(v: unknown): Validation<CreateIdeaRequest> {
  return run(() => {
    const o = body(v);
    need(isUuid(o.id), "id phải là UUID");
    const id = (o.id as string).toLowerCase();
    need(typeof o.publishCreditOnApproval === "boolean", "publishCreditOnApproval phải là boolean");
    return {
      contractVersion: CONTRACT_VERSION,
      id,
      title: text(o.title, "title", LIMITS.title),
      description: text(o.description, "description", LIMITS.description),
      category: text(o.category, "category", LIMITS.category),
      publishCreditOnApproval: o.publishCreditOnApproval as boolean,
      identityEnvelope: envelope(o.identityEnvelope, "IDEA", id),
    };
  });
}

export function validateCreateReportRequest(v: unknown): Validation<CreateReportRequest> {
  return run(() => {
    const o = body(v);
    need(isUuid(o.id), "id phải là UUID");
    const id = (o.id as string).toLowerCase();
    need(Array.isArray(o.accusedPersonIds), "accusedPersonIds phải là mảng");
    const accused = o.accusedPersonIds as unknown[];
    need(accused.length >= 1 && accused.length <= LIMITS.accused, `accusedPersonIds cần 1..${LIMITS.accused} phần tử`);
    for (const a of accused) need(typeof a === "string" && a.length > 0 && a.length <= 128, "accusedPersonIds chứa giá trị sai");
    return {
      contractVersion: CONTRACT_VERSION,
      id,
      title: text(o.title, "title", LIMITS.title),
      evidenceDetails: text(o.evidenceDetails, "evidenceDetails", LIMITS.evidence),
      accusedPersonIds: [...new Set(accused as string[])].sort(),
      identityEnvelope: envelope(o.identityEnvelope, "REPORT", id),
    };
  });
}

export function validateCouncilVersionRequest(v: unknown): Validation<{ expectedCouncilVersion: number }> {
  return run(() => {
    const o = body(v);
    need(Number.isSafeInteger(o.expectedCouncilVersion) && (o.expectedCouncilVersion as number) >= 1 && (o.expectedCouncilVersion as number) < 2_147_483_647, "expectedCouncilVersion");
    return { expectedCouncilVersion: o.expectedCouncilVersion as number };
  });
}

export function validateCouncilChangeRequest(v: unknown): Validation<CouncilChangeRequest> {
  return run(() => {
    const o = body(v), version = validateCouncilVersionRequest(v);
    need(version.ok, "expectedCouncilVersion");
    need(Array.isArray(o.proposedMembers) && o.proposedMembers.length >= 3 && o.proposedMembers.length <= 12, "proposedMembers: 3..12");
    const members = (o.proposedMembers as unknown[]).map(value => {
      need(isObject(value), "member"); const m = value as Record<string, unknown>;
      need(m.membershipRole === "MEMBER" || m.membershipRole === "CHAIR", "membershipRole");
      need(typeof m.independent === "boolean" && typeof m.active === "boolean", "member flags");
      return { subject: text(m.subject, "subject", 128), membershipRole: m.membershipRole as "MEMBER" | "CHAIR", independent: m.independent as boolean, active: m.active as boolean };
    });
    need(new Set(members.map(m => m.subject)).size === members.length, "duplicate members");
    need(isObject(o.proposedSelectionPolicy), "proposedSelectionPolicy");
    const p = o.proposedSelectionPolicy as Record<string, unknown>;
    need(Number.isInteger(p.minVoters) && Number.isInteger(p.maxVoters) && (p.minVoters as number) >= 3 && (p.maxVoters as number) <= 5 && (p.minVoters as number) <= (p.maxVoters as number), "3 <= minVoters <= maxVoters <= 5");
    const active = members.filter(m => m.active);
    need(active.length >= (p.minVoters as number) && active.some(m => m.independent), "Insufficient active members or independent representative");
    return { contractVersion: CONTRACT_VERSION, expectedCouncilVersion: (version as { ok: true; value: { expectedCouncilVersion: number } }).value.expectedCouncilVersion,
      reason: text(o.reason, "reason", LIMITS.reason, 10), proposedMembers: members,
      proposedSelectionPolicy: { minVoters: p.minVoters as number, maxVoters: p.maxVoters as number } };
  });
}

export function validateEndorseIdeaRequest(v: unknown): Validation<EndorseIdeaRequest> {
  return run(() => {
    const o = body(v);
    need(Number.isSafeInteger(o.expectedVersion) && (o.expectedVersion as number) >= 1 && (o.expectedVersion as number) <= 2_147_483_647, "expectedVersion");
    return { contractVersion: CONTRACT_VERSION, expectedVersion: o.expectedVersion as number };
  });
}

export function validateDecideIdeaRequest(v: unknown): Validation<DecideIdeaRequest> {
  return run(() => {
    const o = body(v);
    need(o.decision === "APPROVE" || o.decision === "REJECT", "decision phải là APPROVE|REJECT");
    need(Number.isInteger(o.expectedVersion) && (o.expectedVersion as number) >= 1, "expectedVersion");
    return {
      contractVersion: CONTRACT_VERSION,
      decision: o.decision as IdeaDecision,
      reason: text(o.reason, "reason", LIMITS.reason, 0),
      expectedVersion: o.expectedVersion as number,
    };
  });
}

export function validateCreateUnmaskRequest(v: unknown): Validation<CreateUnmaskRequest> {
  return run(() => {
    const o = body(v);
    return {
      contractVersion: CONTRACT_VERSION,
      recipientSubject: text(o.recipientSubject, "recipientSubject", 128),
      purpose: text(o.purpose, "purpose", LIMITS.reason),
    };
  });
}

export function validateSubmitApprovalRequest(v: unknown, votingRequestId: string): Validation<SubmitApprovalRequest> {
  return run(() => {
    const o = body(v);
    need(o.votingRequestId === votingRequestId, "votingRequestId khác path");
    need(o.decision === "APPROVE" || o.decision === "DENY", "decision phải là APPROVE|DENY");
    need(o.proof === undefined || typeof o.proof === "string", "proof phải là chuỗi");
    return {
      contractVersion: CONTRACT_VERSION,
      votingRequestId,
      decision: o.decision as VoteDecision,
      reason: text(o.reason, "reason", LIMITS.reason, 0),
      ...(o.proof === undefined ? {} : { proof: o.proof as string }),
    };
  });
}

export function validateListQuery(v: unknown): Validation<Required<Pick<ListQuery, "limit">> & ListQuery> {
  return run(() => {
    const o = v === undefined || v === null ? {} : v;
    need(isObject(o), "query phải là object");
    const q = o as Record<string, unknown>;
    const rawLimit = q.limit === undefined || q.limit === "" ? MAX_PAGE_SIZE : Number(q.limit);
    need(Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= MAX_PAGE_SIZE, `limit phải trong 1..${MAX_PAGE_SIZE}`);
    need(q.cursor === undefined || q.cursor === null || typeof q.cursor === "string", "cursor");
    need(q.status === undefined || typeof q.status === "string", "status");
    return {
      limit: rawLimit,
      cursor: (q.cursor as string | null | undefined) ?? null,
      ...(q.status === undefined ? {} : { status: q.status as string }),
    };
  });
}

// Dùng cho cả runtime (validate response) và test.
export function isApiResult(v: unknown): v is ApiResult<unknown> {
  if (!isObject(v) || v.contractVersion !== CONTRACT_VERSION || typeof v.requestId !== "string" || !v.requestId) return false;
  if (v.ok === true) return "data" in v;
  if (v.ok !== false || !isObject(v.error)) return false;
  const e = v.error;
  return typeof e.code === "string" && typeof e.message === "string"
    && (ENFORCEMENTS as readonly string[]).includes(e.enforcement as string) && typeof e.retryable === "boolean";
}

export const FORBIDDEN_VIEW_KEYS = [
  "token", "accessToken", "idToken", "refreshToken", "authorization", "password", "email",
  "authorSubject", "reporterSubject", "reporterId", "submittedBy", "createdBy",
  "identityEnvelope", "ciphertext", "plaintext", "proof",
] as const;
