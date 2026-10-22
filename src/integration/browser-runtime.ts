// LIVE runtime phía browser: gọi /api/v1 và mã hóa danh tính trước khi gửi.
// Mọi method luôn resolve ApiResult, không throw. Lỗi mạng -> POLICY_UNAVAILABLE retryable.
// auth và crypto là adapter tiêm vào; cài đặt Tide thật làm sau spike G1.
// Chạy được cả browser lẫn Node: không node:*, không API riêng của Next.
import {
  CONTRACT_VERSION, fail, isApiResult, ok,
  type ApiResult, type DecideIdeaInput, type IdeaFormInput, type IdeaView, type IdentityEnvelope,
  type IdentityEnvelopeResponse, type IdentityView, type ReportFormInput, type ReportView,
  type ResourceBinding, type SessionView, type UnmaskFormInput, type VoteInput,
} from "../contracts/api";
import { canonicalAccused, hashCiphertext, hashIdeaV1, hashReportV1 } from "../contracts/encoding";

export interface AuthSession {
  authenticated: boolean;
  subject?: string;
  displayName?: string;
  organizationId?: string;
  roles?: string[];
}

export interface AuthAdapter {
  init(): Promise<void>;
  /** Access token hiện hành, null nếu chưa đăng nhập. Chỉ dùng cho header gửi tới apiBase. */
  getToken(): Promise<string | null>;
  login(): Promise<void>;
  logout(): Promise<void>;
  session(): AuthSession;
}

/** Danh tính được mã hóa: không bao giờ gửi plaintext lên server. */
export interface IdentityPlaintext {
  subject: string;
  displayName: string;
  contact?: string | null;
}

export interface CryptoAdapter {
  encryptIdentity(binding: ResourceBinding, identity: IdentityPlaintext, tag: IdentityEnvelope["tag"]): Promise<string>;
  decryptIdentity(envelope: IdentityEnvelope): Promise<IdentityPlaintext>;
}

export interface LiveOptions {
  apiBase: string;
  auth: AuthAdapter;
  crypto: CryptoAdapter;
  fetch?: typeof fetch;
  policyVersion?: string;
  newId?: () => string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function createVoiceVaultLive(options: LiveOptions) {
  const { auth, crypto } = options;
  const apiBase = String(options.apiBase ?? "").replace(/\/+$/, "");
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const policyVersion = options.policyVersion ?? "p1-app-enforced";
  const newId = options.newId ?? (() => globalThis.crypto.randomUUID());

  const safe = <A extends unknown[], T>(fn: (...args: A) => Promise<ApiResult<T>>) =>
    async (...args: A): Promise<ApiResult<T>> => {
      try {
        return await fn(...args);
      } catch (e) {
        return fail("POLICY_UNAVAILABLE", `lỗi runtime: ${(e as Error)?.message ?? "không rõ"}`, { enforcement: "CLIENT", retryable: true });
      }
    };

  async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<ApiResult<T>> {
    const token = await auth.getToken();
    if (!token) return fail("UNAUTHENTICATED", "cần đăng nhập", { enforcement: "CLIENT" });
    let res: Response;
    try {
      // URL luôn là apiBase + path: token không bao giờ đi tới origin khác.
      res = await doFetch(`${apiBase}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        credentials: "omit",
      });
    } catch {
      return fail("POLICY_UNAVAILABLE", "không kết nối được API", { enforcement: "CLIENT", retryable: true });
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return fail("POLICY_UNAVAILABLE", `API trả dữ liệu không phải JSON (HTTP ${res.status})`, { enforcement: "CLIENT", retryable: res.status >= 500 });
    }
    if (!isApiResult(json)) return fail("CONTRACT_MISMATCH", "response không đúng ApiResult v1", { enforcement: "CLIENT" });
    return json as ApiResult<T>;
  }

  const qs = (query: unknown): string => {
    if (!isObj(query)) return "";
    const p = new URLSearchParams();
    for (const key of ["cursor", "limit", "status"]) {
      const v = query[key];
      if (v !== undefined && v !== null && v !== "") p.set(key, String(v));
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const seg = (id: unknown): string | null => (typeof id === "string" && id.length > 0 ? encodeURIComponent(id) : null);
  const badId = () => fail<never>("INVALID_REQUEST", "thiếu id", { enforcement: "CLIENT" });

  const sessionView = (): SessionView => {
    const s = auth.session();
    if (!s.authenticated) return { authenticated: false, roles: [], capabilities: [] };
    return {
      authenticated: true, subject: s.subject ?? null, displayName: s.displayName ?? null,
      organizationId: s.organizationId ?? null, roles: s.roles ?? [], capabilities: [],
    };
  };

  async function getSession(): Promise<ApiResult<SessionView>> {
    if (!auth.session().authenticated) return ok(sessionView());
    const me = await request<SessionView>("GET", "/me");
    return me.ok || me.error.code !== "UNAUTHENTICATED" ? me : ok(sessionView());
  }

  async function identityFor(binding: ResourceBinding, tag: IdentityEnvelope["tag"], contact?: string | null): Promise<IdentityEnvelope | null> {
    const s = auth.session();
    if (!s.authenticated || !s.subject) return null;
    const plaintext: IdentityPlaintext = { subject: s.subject, displayName: s.displayName ?? s.subject, ...(contact ? { contact } : {}) };
    const ciphertext = await crypto.encryptIdentity(binding, plaintext, tag);
    if (typeof ciphertext !== "string" || !ciphertext) throw new Error("INVALID_CRYPTO_RESPONSE");
    return { scheme: "TIDE_V1", tag, ciphertext, ciphertextHash: await hashCiphertext(ciphertext), binding };
  }

  const text = (v: unknown) => (typeof v === "string" ? v : "");

  async function submitIdea(input: IdeaFormInput): Promise<ApiResult<IdeaView>> {
    const s = auth.session();
    if (!s.authenticated || !s.organizationId) return fail("UNAUTHENTICATED", "cần đăng nhập", { enforcement: "CLIENT" });
    const f = isObj(input) ? input : ({} as Record<string, unknown>);
    const title = text(f.title), description = text(f.description), category = text(f.category) || "general";
    if (!title.trim() || !description.trim()) return fail("INVALID_REQUEST", "title và description bắt buộc", { enforcement: "CLIENT" });
    const id = newId();
    const binding: ResourceBinding = {
      contractVersion: CONTRACT_VERSION, organizationId: s.organizationId, resourceKind: "IDEA", resourceId: id,
      contentVersion: 1, policyVersion,
      contentHash: await hashIdeaV1({ organizationId: s.organizationId, resourceId: id, contentVersion: 1, title, description, category }),
    };
    const identityEnvelope = await identityFor(binding, "idea_author");
    if (!identityEnvelope) return fail("UNAUTHENTICATED", "cần đăng nhập", { enforcement: "CLIENT" });
    return request<IdeaView>("POST", "/ideas", {
      contractVersion: CONTRACT_VERSION, id, title, description, category,
      publishCreditOnApproval: f.publishCreditOnApproval === true, identityEnvelope,
    });
  }

  async function submitReport(input: ReportFormInput): Promise<ApiResult<ReportView>> {
    const s = auth.session();
    if (!s.authenticated || !s.organizationId) return fail("UNAUTHENTICATED", "cần đăng nhập", { enforcement: "CLIENT" });
    const f = isObj(input) ? input : ({} as Record<string, unknown>);
    const title = text(f.title), evidenceDetails = text(f.evidenceDetails);
    const accused = Array.isArray(f.accusedPersonIds) ? f.accusedPersonIds.filter((x): x is string => typeof x === "string" && !!x) : [];
    const accusedPersonIds = canonicalAccused(accused);
    if (!title.trim() || !evidenceDetails.trim() || accusedPersonIds.length === 0) {
      return fail("INVALID_REQUEST", "title, evidenceDetails và ít nhất một accusedPersonIds bắt buộc", { enforcement: "CLIENT" });
    }
    const id = newId();
    const binding: ResourceBinding = {
      contractVersion: CONTRACT_VERSION, organizationId: s.organizationId, resourceKind: "REPORT", resourceId: id,
      contentVersion: 1, policyVersion,
      contentHash: await hashReportV1({ organizationId: s.organizationId, resourceId: id, contentVersion: 1, title, evidenceDetails, accusedPersonIds }),
    };
    // contact chỉ nằm trong ciphertext, không bao giờ ở body plaintext.
    const identityEnvelope = await identityFor(binding, "report_id", typeof f.contact === "string" ? f.contact : null);
    if (!identityEnvelope) return fail("UNAUTHENTICATED", "cần đăng nhập", { enforcement: "CLIENT" });
    return request<ReportView>("POST", "/reports", {
      contractVersion: CONTRACT_VERSION, id, title, evidenceDetails, accusedPersonIds, identityEnvelope,
    });
  }

  async function revealIdentity(resourceKind: unknown, resourceId: unknown, requestId?: unknown): Promise<ApiResult<IdentityView>> {
    const id = seg(resourceId);
    if (!id || (resourceKind !== "IDEA" && resourceKind !== "REPORT")) {
      return fail("INVALID_REQUEST", "resourceKind phải là IDEA|REPORT và cần resourceId", { enforcement: "CLIENT" });
    }
    let path: string;
    if (resourceKind === "IDEA") path = `/ideas/${id}/identity-envelope`;
    else {
      const vr = seg(requestId);
      if (!vr) return fail("INVALID_REQUEST", "cần votingRequestId", { enforcement: "CLIENT" });
      path = `/reports/${id}/identity-envelope?votingRequestId=${vr}`;
    }
    const res = await request<IdentityEnvelopeResponse>("GET", path);
    if (!res.ok) return res;
    const env = res.data?.envelope;
    if (!env || env.binding?.resourceKind !== resourceKind || env.binding?.resourceId !== resourceId
        || (await hashCiphertext(env.ciphertext)) !== env.ciphertextHash) {
      return fail("INTEGRITY_MISMATCH", "envelope không khớp tài nguyên hoặc hash", { enforcement: "CLIENT" });
    }
    const plain = await crypto.decryptIdentity(env);
    // View tạm: trả cho UI, không lưu ở runtime.
    return ok({
      resourceKind, resourceId: resourceId as string, subject: plain.subject, displayName: plain.displayName,
      ...(plain.contact ? { contact: plain.contact } : {}),
    });
  }

  const outOfScope = (name: string) => async () =>
    fail<never>("POLICY_UNAVAILABLE", `${name} chưa có trong P1`, { enforcement: "APP", retryable: false });

  const runtime = {
    contractVersion: CONTRACT_VERSION,
    mode: "LIVE" as const,
    init: safe(async () => { await auth.init(); return getSession(); }),
    getSession: safe(getSession),
    login: safe(async () => { await auth.login(); return ok(sessionView()); }),
    logout: safe(async () => { await auth.logout(); return ok<SessionView>({ authenticated: false, roles: [], capabilities: [] }); }),
    listIdeas: safe(async (query?: unknown) => request("GET", `/ideas${qs(query)}`)),
    getIdea: safe(async (id?: unknown) => { const s = seg(id); return s ? request("GET", `/ideas/${s}`) : badId(); }),
    submitIdea: safe(submitIdea),
    decideIdea: safe(async (id?: unknown, input?: DecideIdeaInput) => {
      const s = seg(id);
      if (!s) return badId();
      const f = (isObj(input) ? input : {}) as Record<string, unknown>;
      return request("POST", `/ideas/${s}/decision`, {
        contractVersion: CONTRACT_VERSION, decision: f.decision, reason: text(f.reason), expectedVersion: f.expectedVersion,
      });
    }),
    listReports: safe(async (query?: unknown) => request("GET", `/reports${qs(query)}`)),
    getReport: safe(async (id?: unknown) => { const s = seg(id); return s ? request("GET", `/reports/${s}`) : badId(); }),
    submitReport: safe(submitReport),
    getDirectory: safe(async () => request("GET", "/directory")),
    createUnmaskRequest: safe(async (reportId?: unknown, input?: UnmaskFormInput) => {
      const s = seg(reportId);
      if (!s) return badId();
      const f = (isObj(input) ? input : {}) as Record<string, unknown>;
      return request("POST", `/reports/${s}/unmask-requests`, {
        contractVersion: CONTRACT_VERSION, recipientSubject: text(f.recipientSubject), purpose: text(f.purpose),
      });
    }),
    listMyVotingRequests: safe(async (query?: unknown) => request("GET", `/voting-requests/mine${qs(query)}`)),
    getVotingRequest: safe(async (id?: unknown) => { const s = seg(id); return s ? request("GET", `/voting-requests/${s}`) : badId(); }),
    castVote: safe(async (id?: unknown, input?: VoteInput) => {
      const s = seg(id);
      if (!s) return badId();
      const f = (isObj(input) ? input : {}) as Record<string, unknown>;
      return request("POST", `/voting-requests/${s}/approvals`, {
        contractVersion: CONTRACT_VERSION, votingRequestId: id, decision: f.decision, reason: text(f.reason),
      });
    }),
    getCouncil: safe(async () => request("GET", "/council")),
    revealIdentity: safe(revealIdentity),
    listAudit: safe(async (query?: unknown) => request("GET", `/audit${qs(query)}`)),
    endorseIdea: outOfScope("endorseIdea"),
    listCouncilChanges: outOfScope("listCouncilChanges"),
    submitCouncilChange: outOfScope("submitCouncilChange"),
    applyCouncilChange: outOfScope("applyCouncilChange"),
  };
  return runtime;
}

export type VoiceVaultLiveRuntime = ReturnType<typeof createVoiceVaultLive>;

/** Stub cho test và chạy local trước khi có Tide SDK. KHÔNG dùng cho bảo mật thật. */
export function createStubAuth(session: AuthSession, token = "stub-token"): AuthAdapter & { current: AuthSession } {
  const state = { current: { ...session } };
  return {
    get current() { return state.current; },
    async init() {},
    async getToken() { return state.current.authenticated ? token : null; },
    async login() { state.current = { ...session, authenticated: true }; },
    async logout() { state.current = { authenticated: false }; },
    session() { return state.current; },
  };
}

/** Stub crypto: base64 JSON, chỉ để test luồng; không phải mã hóa. */
export function createStubCrypto(): CryptoAdapter {
  const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  return {
    async encryptIdentity(binding, identity, tag) {
      return `stub:${b64(JSON.stringify({ tag, resourceId: binding.resourceId, identity }))}`;
    },
    async decryptIdentity(envelope) {
      const decoded = JSON.parse(unb64(envelope.ciphertext.replace(/^stub:/, "")));
      if (decoded.resourceId !== envelope.binding.resourceId) throw new Error("BINDING_MISMATCH");
      return decoded.identity as IdentityPlaintext;
    },
  };
}
