// Chép nguyên từ tests/p0/helpers/env.mjs (commit dccfd22): hằng số và assertion shape của contract v1.
// Không import trực tiếp vì env.mjs kéo jsdom và đường dẫn public/ mà branch này chưa có.
import assert from "node:assert/strict";

export const CONTRACT_VERSION = "v1";

export const RUNTIME_METHODS = [
  "init", "getSession", "login", "logout",
  "listIdeas", "getIdea", "submitIdea", "endorseIdea", "decideIdea",
  "listReports", "getReport", "submitReport", "getDirectory",
  "createUnmaskRequest", "listMyVotingRequests", "getVotingRequest", "castVote",
  "getCouncil", "listCouncilChanges", "submitCouncilChange", "applyCouncilChange",
  "revealIdentity", "listAudit",
];

export const ENFORCEMENT = ["APP", "FABRIC", "QEA", "CLIENT", "SIMULATED"];

export const REQUIRED_ERROR_CODES = [
  "INVALID_REQUEST", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND",
  "VERSION_CONFLICT", "COUNCIL_VERSION_CONFLICT", "COUNCIL_VOTE_REQUIRED",
  "QUORUM_PENDING", "INSUFFICIENT_ELIGIBLE_JURORS", "APPROVAL_EXPIRED",
  "INTEGRITY_MISMATCH", "POLICY_DENIED", "POLICY_UNAVAILABLE", "CONTRACT_MISMATCH",
];

// Không key nào trong view/fixture được mang token, danh tính người nộp hoặc vật liệu mật mã.
export const FORBIDDEN_KEYS = [
  "token", "accessToken", "idToken", "refreshToken", "authorization", "password", "email",
  "authorSubject", "reporterSubject", "reporterId", "submittedBy", "createdBy",
  "identityEnvelope", "ciphertext", "plaintext", "proof",
];

export const quorumFor = (n) => Math.ceil((2 * n) / 3);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Đối tượng tạo trong realm jsdom có prototype khác; chép về realm Node trước khi deepEqual.
export const toPlain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

export function assertApiResult(result, label = "ApiResult") {
  assert.ok(result && typeof result === "object", `${label}: không phải object`);
  assert.equal(result.contractVersion, CONTRACT_VERSION, `${label}: contractVersion`);
  assert.equal(typeof result.requestId, "string", `${label}: requestId`);
  assert.ok(result.requestId.length > 0, `${label}: requestId rỗng`);
  if (result.ok === true) {
    assert.ok("data" in result, `${label}: thiếu data`);
    return;
  }
  assert.equal(result.ok, false, `${label}: ok phải là boolean`);
  const { error } = result;
  assert.ok(error && typeof error === "object", `${label}: thiếu error`);
  assert.equal(typeof error.code, "string", `${label}: error.code`);
  assert.equal(typeof error.message, "string", `${label}: error.message`);
  assert.ok(ENFORCEMENT.includes(error.enforcement), `${label}: enforcement ${error.enforcement}`);
  assert.equal(typeof error.retryable, "boolean", `${label}: error.retryable`);
}

export function findForbiddenKeys(value, at = "$", found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => findForbiddenKeys(item, `${at}[${i}]`, found));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.some((k) => k.toLowerCase() === key.toLowerCase())) found.push(`${at}.${key}`);
      findForbiddenKeys(child, `${at}.${key}`, found);
    }
  }
  return found;
}
