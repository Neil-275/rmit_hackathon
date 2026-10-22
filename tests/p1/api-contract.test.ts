import { describe, expect, it } from "vitest";
import {
  ERROR_CODES, ERROR_HTTP_STATUS, ROUTES, RUNTIME_METHODS, fail, isApiResult, ok,
  validateCreateIdeaRequest, validateCreateReportRequest, validateDecideIdeaRequest,
  validateListQuery, validateSubmitApprovalRequest,
} from "../../src/contracts/api";
import { ENFORCEMENT, REQUIRED_ERROR_CODES, RUNTIME_METHODS as P0_METHODS } from "./helpers/contract.mjs";

const ID = "3f8f2f0e-6a3b-4c5d-9e7f-0123456789ab";
const HASH = "a".repeat(64);
const envelope = (kind: "IDEA" | "REPORT", id = ID) => ({
  scheme: "TIDE_V1",
  tag: kind === "IDEA" ? "idea_author" : "report_id",
  ciphertext: "opaque",
  ciphertextHash: HASH,
  binding: {
    contractVersion: "v1", organizationId: "org-demo", resourceKind: kind, resourceId: id,
    contentVersion: 1, contentHash: HASH, policyVersion: "p1",
  },
});
const idea = (over: Record<string, unknown> = {}) => ({
  contractVersion: "v1", id: ID, title: "t", description: "d", category: "process",
  publishCreditOnApproval: true, identityEnvelope: envelope("IDEA"), ...over,
});

describe("contract chung với tests/p0", () => {
  it("cùng danh sách 23 method runtime", () => {
    expect([...RUNTIME_METHODS].sort()).toEqual([...P0_METHODS].sort());
  });
  it("đủ 14 mã lỗi và mỗi mã có HTTP status", () => {
    for (const code of REQUIRED_ERROR_CODES) {
      expect(ERROR_CODES).toContain(code);
      expect(ERROR_HTTP_STATUS[code as keyof typeof ERROR_HTTP_STATUS]).toBeGreaterThanOrEqual(400);
    }
  });
  it("ok/fail tạo ApiResult hợp lệ, mặc định APP", () => {
    expect(isApiResult(ok({ a: 1 }))).toBe(true);
    const f = fail("FORBIDDEN", "x");
    expect(isApiResult(f)).toBe(true);
    expect(f.ok === false && f.error.enforcement).toBe("APP");
    expect(ENFORCEMENT).toContain("APP");
  });
  it("route table không trùng và có các route P1 chính", () => {
    const keys = ROUTES.map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of ROUTES) expect(r.path.startsWith("/")).toBe(true);
    expect(keys).toContain("POST /voting-requests/:id/approvals");
    expect(keys).toContain("GET /reports/:id/identity-envelope");
  });
});

describe("validator", () => {
  it("CreateIdeaRequest hợp lệ", () => {
    expect(validateCreateIdeaRequest(idea()).ok).toBe(true);
  });
  it.each([
    ["id không phải UUID", { id: "x" }],
    ["title rỗng", { title: "  " }],
    ["sai contractVersion", { contractVersion: "v2" }],
    ["consent không boolean", { publishCreditOnApproval: "yes" }],
    ["thiếu envelope", { identityEnvelope: undefined }],
    ["binding khác id", { identityEnvelope: envelope("IDEA", "00000000-0000-4000-8000-000000000000") }],
    ["tag sai loại", { identityEnvelope: envelope("REPORT") }],
  ])("CreateIdeaRequest từ chối: %s", (_label, over) => {
    expect(validateCreateIdeaRequest(idea(over)).ok).toBe(false);
  });
  it("CreateReportRequest dedupe + sort accused", () => {
    const r = validateCreateReportRequest({
      contractVersion: "v1", id: ID, title: "t", evidenceDetails: "e",
      accusedPersonIds: ["b", "a", "b"], identityEnvelope: envelope("REPORT"),
    });
    expect(r.ok && r.value.accusedPersonIds).toEqual(["a", "b"]);
  });
  it("CreateReportRequest cần ít nhất một accused", () => {
    const r = validateCreateReportRequest({
      contractVersion: "v1", id: ID, title: "t", evidenceDetails: "e",
      accusedPersonIds: [], identityEnvelope: envelope("REPORT"),
    });
    expect(r.ok).toBe(false);
  });
  it("Decide/approval/list query", () => {
    expect(validateDecideIdeaRequest({ contractVersion: "v1", decision: "APPROVE", reason: "", expectedVersion: 1 }).ok).toBe(true);
    expect(validateDecideIdeaRequest({ contractVersion: "v1", decision: "MAYBE", reason: "", expectedVersion: 1 }).ok).toBe(false);
    expect(validateSubmitApprovalRequest({ contractVersion: "v1", votingRequestId: ID, decision: "DENY", reason: "r" }, ID).ok).toBe(true);
    expect(validateSubmitApprovalRequest({ contractVersion: "v1", votingRequestId: "other", decision: "DENY", reason: "r" }, ID).ok).toBe(false);
    expect(validateListQuery(undefined)).toEqual({ ok: true, value: { limit: 50, cursor: null } });
    expect(validateListQuery({ limit: "51" }).ok).toBe(false);
  });
});
