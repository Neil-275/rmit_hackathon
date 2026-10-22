// Helper chung cho test P0.1 (contract v1, fixtures, bootstrap, mock runtime, shell file://).
//
// Contract v1 mà các test khóa lại:
//   window.VoiceVaultFixtures          contract-fixtures.js (Tùng), dữ liệu giả, deep-frozen
//   window.createVoiceVaultMock(fx)    mock-runtime.js (UI), trả runtime mode=MOCK
//   window.createVoiceVaultLive(opts)  runtime.generated.js (Tùng), chỉ HTTP(S)
//   window.VoiceVaultUI.mount(runtime) app.js (UI), bootstrap gọi đúng một lần
//   window.VoiceVaultBootstrap         bootstrap.js (Tùng): { contractVersion, run(options), ready? }
//   window.VoiceVaultBootstrapConfig   { autoStart: false } chỉ để test tắt auto-run
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const PATHS = {
  fixtures: path.join(ROOT, "public/integration/contract-fixtures.js"),
  bootstrap: path.join(ROOT, "public/integration/bootstrap.js"),
  mock: path.join(ROOT, "public/ui/mock-runtime.js"),
  app: path.join(ROOT, "public/ui/app.js"),
  index: path.join(ROOT, "public/ui/index.html"),
};

export const FILE_URL = pathToFileURL(PATHS.index).href;
export const LIVE_URL = "http://localhost:3000/ui/index.html";

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

export function readSource(file) {
  assert.ok(existsSync(file), `Thiếu file ${path.relative(ROOT, file)}`);
  return readFileSync(file, "utf8");
}

export function createWindow(url = FILE_URL) {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  return dom.window;
}

export function runClassic(window, file) {
  window.eval(`${readSource(file)}\n//# sourceURL=${path.basename(file)}`);
}

export function setGlobal(window, name, value) {
  window.eval(`window[${JSON.stringify(name)}] = ${JSON.stringify(value)};`);
}

// Đối tượng tạo trong realm jsdom có prototype khác; chép về realm Node trước khi deepEqual.
export const toPlain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

export function loadFixtures() {
  const window = createWindow();
  runClassic(window, PATHS.fixtures);
  assert.ok(window.VoiceVaultFixtures, "contract-fixtures.js phải gán window.VoiceVaultFixtures");
  return { window, fixtures: window.VoiceVaultFixtures };
}

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

export function isDeepFrozen(value, window) {
  if (!value || typeof value !== "object") return true;
  if (!window.Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => isDeepFrozen(child, window));
}
