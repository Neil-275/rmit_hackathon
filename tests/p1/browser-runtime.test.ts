import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import {
  createStubAuth, createStubCrypto, createVoiceVaultLive, type AuthSession,
} from "../../src/integration/browser-runtime";
import { createServices, httpStatusOf, type Services } from "../../src/server/services";
import { loadRoster } from "../../src/server/roster";
import type { Actor } from "../../src/contracts/api";
import { createTempDb } from "./helpers/db";
import { RUNTIME_METHODS, UUID_RE, assertApiResult, findForbiddenKeys, quorumFor, toPlain } from "./helpers/contract.mjs";

const API = "https://app.test/api/v1";
const roster = loadRoster(path.resolve(__dirname, "../../config/roster.json"));
const personas: Record<string, AuthSession> = Object.fromEntries(roster.personas.map((p) => [p.subject, {
  authenticated: true, subject: p.subject, displayName: p.displayName, organizationId: roster.organizationId, roles: p.roles,
}]));

// Route giả tối thiểu: token "stub:<subject>" -> Actor, rồi gọi service như route Next sẽ làm.
type Call = { url: string; method: string; headers: Record<string, string>; body?: string };
function fakeServer(svc: Services, calls: Call[]): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url: url.href, method: init?.method ?? "GET", headers, body: init?.body as string | undefined });
    const subject = /^Bearer stub:(.+)$/.exec(headers.Authorization ?? "")?.[1];
    const p = personas[subject ?? ""];
    const actor: Actor | null = p ? { subject: p.subject!, organizationId: p.organizationId!, roles: p.roles! } : null;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const q = Object.fromEntries(url.searchParams);
    const parts = url.pathname.replace(/^\/api\/v1/, "").split("/").filter(Boolean);
    const m = init?.method ?? "GET";
    let result;
    const key = parts[0] === "council" && parts[1] === "change-requests" ? `${m} /council/change-requests`
      : `${m} /${parts.map((s, i) => (i % 2 === 1 && s !== "mine" ? ":id" : s)).join("/")}`;
    switch (key) {
      case "GET /me": result = await svc.getMe(actor!); break;
      case "GET /directory": result = await svc.getDirectory(actor!); break;
      case "GET /council": result = await svc.getCouncil(actor!); break;
      case "GET /council/change-requests": result = await svc.listCouncilChanges(actor!, q); break;
      case "POST /council/change-requests": result = await svc.submitCouncilChange(actor!, body); break;
      case "GET /audit": result = await svc.listAudit(actor!, q); break;
      case "GET /ideas": result = await svc.listIdeas(actor!, q); break;
      case "POST /ideas": result = await svc.createIdea(actor!, body); break;
      case "GET /ideas/:id": result = await svc.getIdea(actor!, parts[1]); break;
      case "POST /ideas/:id/endorse": result = await svc.endorseIdea(actor!, parts[1], body); break;
      case "POST /ideas/:id/decision": result = await svc.decideIdea(actor!, parts[1], body); break;
      case "GET /ideas/:id/identity-envelope": result = await svc.getIdeaIdentityEnvelope(actor!, parts[1]); break;
      case "GET /reports": result = await svc.listReports(actor!, q); break;
      case "POST /reports": result = await svc.createReport(actor!, body); break;
      case "GET /reports/:id": result = await svc.getReport(actor!, parts[1]); break;
      case "POST /reports/:id/unmask-requests": result = await svc.createUnmaskRequest(actor!, parts[1], body); break;
      case "GET /reports/:id/identity-envelope": result = await svc.getReportIdentityEnvelope(actor!, parts[1], q.votingRequestId); break;
      case "GET /voting-requests/mine": result = await svc.listMyVotingRequests(actor!, q); break;
      case "GET /voting-requests/:id": result = await svc.getVotingRequest(actor!, parts[1]); break;
      case "POST /voting-requests/:id/approvals": result = await svc.castVote(actor!, parts[1], body); break;
      default: return new Response("not found", { status: 404 });
    }
    return new Response(JSON.stringify(result), { status: httpStatusOf(result) });
  }) as typeof fetch;
}

let db: ReturnType<typeof createTempDb>;
let prisma: PrismaClient;
let svc: Services;
let calls: Call[];

beforeAll(() => { db = createTempDb(); prisma = db.prisma; });
afterAll(async () => { await db.cleanup(); });
beforeEach(async () => {
  await prisma.vote.deleteMany();
  await prisma.votingRequest.deleteMany();
  await prisma.report.deleteMany();
  await prisma.idea.deleteMany();
  await prisma.auditEvent.deleteMany();
  svc = createServices({ prisma, roster, drawInt: (min) => min });
  calls = [];
});

function live(subject: string | null) {
  const auth = createStubAuth(subject ? personas[subject] : { authenticated: false }, `stub:${subject}`);
  return createVoiceVaultLive({ apiBase: `${API}/`, auth, crypto: createStubCrypto(), fetch: fakeServer(svc, calls) });
}

async function call(runtime: ReturnType<typeof live>, method: string, ...args: unknown[]) {
  const pending = (runtime as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method](...args);
  expect(typeof (pending as Promise<unknown>)?.then).toBe("function");
  const result = toPlain(await pending);
  assertApiResult(result, method);
  return result;
}

const validIdea = { title: "Giảm thời gian họp", description: "Họp đứng 15 phút\r\nmỗi sáng", category: "process", publishCreditOnApproval: true };

describe("shape runtime (chép từ tests/p0/mock-runtime.contract.test.mjs)", () => {
  it("contractVersion v1, mode LIVE và đủ method", () => {
    const runtime = live("subject-an");
    expect(runtime.contractVersion).toBe("v1");
    expect(runtime.mode).toBe("LIVE");
    for (const name of RUNTIME_METHODS) expect(typeof (runtime as Record<string, unknown>)[name], name).toBe("function");
  });

  it("không có method sửa roster trực tiếp", () => {
    expect(Object.keys(live("subject-an")).filter((k) => /^(set|update|patch|edit|replace|add|remove)Council/i.test(k))).toEqual([]);
  });

  it("mọi method luôn resolve ApiResult, kể cả khi thiếu tham số", async () => {
    const runtime = live("subject-an");
    for (const name of RUNTIME_METHODS) await call(runtime, name);
  });

  it("method ngoài P1 trả POLICY_UNAVAILABLE / APP / không retry", async () => {
    const runtime = live("subject-an");
    for (const name of ["applyCouncilChange"]) {
      const r = await call(runtime, name);
      expect(r).toMatchObject({ ok: false, error: { code: "POLICY_UNAVAILABLE", enforcement: "APP", retryable: false } });
    }
  });

  it("init trả SessionView không token; logout đưa về chưa đăng nhập", async () => {
    const runtime = live("subject-chi");
    const init = await call(runtime, "init");
    expect(init.ok).toBe(true);
    expect(init.data.authenticated).toBe(true);
    expect(init.data.roles).toContain("director");
    expect(Array.isArray(init.data.capabilities)).toBe(true);
    expect(findForbiddenKeys(init.data)).toEqual([]);
    await call(runtime, "logout");
    const after = await call(runtime, "getSession");
    expect(after.data.authenticated).toBe(false);
  });

  it("chưa đăng nhập: getSession authenticated=false, ghi trả UNAUTHENTICATED, không gọi mạng", async () => {
    const runtime = live(null);
    expect((await call(runtime, "getSession")).data.authenticated).toBe(false);
    expect((await call(runtime, "submitIdea", validIdea)).error.code).toBe("UNAUTHENTICATED");
    expect(calls).toEqual([]);
  });
});

describe("luồng LIVE qua API", () => {
  it("submitIdea: UUID, UNDER_REVIEW, body không có danh tính plaintext", async () => {
    const created = await call(live("subject-an"), "submitIdea", validIdea);
    expect(created.ok, JSON.stringify(created)).toBe(true);
    expect(created.data.id).toMatch(UUID_RE);
    expect(created.data.status).toBe("UNDER_REVIEW");
    expect(created.data.publicCredit ?? null).toBeNull();
    expect(findForbiddenKeys(created.data)).toEqual([]);
    const post = calls.find((c) => c.method === "POST")!;
    for (const secret of ["subject-an", "\"An\""]) expect(post.body).not.toContain(secret);
    expect((await call(live("subject-an"), "submitIdea", { title: "", description: "" })).error.code).toBe("INVALID_REQUEST");
  });

  it("submitReport: contact và danh tính chỉ nằm trong ciphertext", async () => {
    const r = await call(live("subject-an"), "submitReport", {
      title: "Phản ánh", evidenceDetails: "giả", accusedPersonIds: ["subject-binh"], contact: "zalo-0909",
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(r.data.status).toBe("INVESTIGATING");
    const post = calls.find((c) => c.method === "POST")!;
    for (const secret of ["subject-an", "zalo-0909", "contact"]) expect(post.body).not.toContain(secret);
  });

  it("Authorization chỉ gửi tới apiBase", async () => {
    const runtime = live("subject-chi");
    await call(runtime, "listIdeas", {});
    await call(runtime, "getIdea", "../../evil.example/x");
    await call(runtime, "getCouncil");
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.url.startsWith(`${API}/`)).toBe(true);
      expect(new URL(c.url).origin).toBe("https://app.test");
    }
  });

  it("lỗi mạng và response sai shape không throw", async () => {
    const auth = createStubAuth(personas["subject-an"], "stub:subject-an");
    const down = createVoiceVaultLive({ apiBase: API, auth, crypto: createStubCrypto(), fetch: (async () => { throw new TypeError("offline"); }) as typeof fetch });
    const r1 = await call(down, "listIdeas", {});
    expect(r1.error).toMatchObject({ code: "POLICY_UNAVAILABLE", retryable: true });
    const junk = createVoiceVaultLive({ apiBase: API, auth, crypto: createStubCrypto(), fetch: (async () => new Response("{\"x\":1}")) as typeof fetch });
    expect((await call(junk, "listIdeas", {})).error.code).toBe("CONTRACT_MISMATCH");
    const html = createVoiceVaultLive({ apiBase: API, auth, crypto: createStubCrypto(), fetch: (async () => new Response("<html>", { status: 502 })) as typeof fetch });
    expect((await call(html, "listIdeas", {})).error).toMatchObject({ code: "POLICY_UNAVAILABLE", retryable: true });
  });

  it("end-to-end: báo cáo -> yêu cầu mở -> vote đủ T có independent -> recipient giải mã", async () => {
    const report = await call(live("subject-an"), "submitReport", {
      title: "Phản ánh", evidenceDetails: "giả", accusedPersonIds: ["subject-an"], contact: "zalo-0909",
    });
    expect(report.ok, JSON.stringify(report)).toBe(true);
    const j1 = live("subject-juror-1");
    const vr = await call(j1, "createUnmaskRequest", report.data.id, { recipientSubject: "subject-juror-3", purpose: "điều tra" });
    expect(vr.ok, JSON.stringify(vr)).toBe(true);
    expect(vr.data.quorumRequired).toBe(quorumFor(vr.data.voterCount));

    const recipient = live("subject-juror-3");
    expect((await call(recipient, "revealIdentity", "REPORT", report.data.id, vr.data.id)).error.code).toBe("QUORUM_PENDING");

    const mine = await call(j1, "listMyVotingRequests", {});
    expect(mine.data.items.some((i: { id: string }) => i.id === vr.data.id)).toBe(true);
    expect((await call(live("subject-an"), "castVote", vr.data.id, { decision: "APPROVE", reason: "x" })).ok).toBe(false);

    expect((await call(j1, "castVote", vr.data.id, { decision: "APPROVE", reason: "ok" })).data.state).toBe("COLLECTING");
    const ready = await call(recipient, "castVote", vr.data.id, { decision: "APPROVE", reason: "ok" });
    expect(ready.data).toMatchObject({ state: "READY", independentApproved: true });

    const revealed = await call(recipient, "revealIdentity", "REPORT", report.data.id, vr.data.id);
    expect(revealed.ok, JSON.stringify(revealed)).toBe(true);
    expect(revealed.data).toMatchObject({ resourceKind: "REPORT", subject: "subject-an", displayName: "An", contact: "zalo-0909" });
    expect((await call(live("subject-chi"), "revealIdentity", "REPORT", report.data.id, vr.data.id)).error.code).toBe("FORBIDDEN");
  });

  it("director duyệt ý tưởng có consent rồi mở danh tính tác giả", async () => {
    const created = await call(live("subject-an"), "submitIdea", validIdea);
    const chi = live("subject-chi");
    expect((await call(live("subject-binh"), "endorseIdea", created.data.id, 1)).data.status).toBe("ENDORSED");
    const decided = await call(chi, "decideIdea", created.data.id, { decision: "APPROVE", reason: "tốt", expectedVersion: 2 });
    expect(decided.data.status).toBe("APPROVED");
    const revealed = await call(chi, "revealIdentity", "IDEA", created.data.id);
    expect(revealed.data).toMatchObject({ subject: "subject-an", displayName: "An" });
    const audit = await call(chi, "listAudit", {});
    expect(audit.data.items.every((e: { source: string }) => e.source === "APP")).toBe(true);
    expect(findForbiddenKeys(audit.data)).toEqual([]);
  });
});
