// Contract test cho public/integration/contract-fixtures.js.
// Fixture là nguồn duy nhất cho mock UI; mọi invariant nghiệp vụ (N/T, roster, privacy) phải đúng ngay trong dữ liệu giả.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_VERSION, ENFORCEMENT, PATHS, REQUIRED_ERROR_CODES, RUNTIME_METHODS, UUID_RE,
  assertApiResult, createWindow, findForbiddenKeys, isDeepFrozen, loadFixtures, quorumFor,
  runClassic, toPlain,
} from "./helpers/env.mjs";

const { window, fixtures: live } = loadFixtures();
const fx = toPlain(live);
const byId = (list) => new Map(list.map((item) => [item.id, item]));

test("nạp bằng classic script trên file:// mà không fetch/XHR", () => {
  const w = createWindow();
  let networkCalls = 0;
  w.fetch = () => { networkCalls++; throw new Error("fetch bị cấm"); };
  w.XMLHttpRequest = function () { networkCalls++; throw new Error("XHR bị cấm"); };
  runClassic(w, PATHS.fixtures);
  assert.equal(networkCalls, 0);
  assert.equal(w.location.protocol, "file:");
  assert.ok(w.VoiceVaultFixtures);
});

test("contractVersion là v1", () => {
  assert.equal(fx.contractVersion, CONTRACT_VERSION);
});

test("deep-frozen để mock không sửa được dữ liệu dùng chung", () => {
  assert.ok(isDeepFrozen(live, window));
});

test("chỉ chứa dữ liệu JSON-serializable", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(fx)), fx);
});

test("methods liệt kê đủ runtime interface v1, không trùng", () => {
  assert.ok(Array.isArray(fx.methods));
  assert.equal(new Set(fx.methods).size, fx.methods.length);
  for (const name of RUNTIME_METHODS) assert.ok(fx.methods.includes(name), `thiếu method ${name}`);
});

test("enums chốt Enforcement và mã lỗi", () => {
  assert.deepEqual([...fx.enums.Enforcement].sort(), [...ENFORCEMENT].sort());
  for (const code of REQUIRED_ERROR_CODES) assert.ok(fx.enums.ErrorCode.includes(code), `thiếu ${code}`);
});

test("không có token, danh tính người nộp hoặc vật liệu mật mã", () => {
  assert.deepEqual(findForbiddenKeys(fx), []);
  const text = JSON.stringify(fx);
  assert.doesNotMatch(text, /Bearer\s|eyJ[A-Za-z0-9_-]{10,}\./, "không chứa JWT/Bearer");
  assert.doesNotMatch(text, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, "không chứa email");
});

test("personas có subject duy nhất và đủ vai cho demo", () => {
  const subjects = fx.personas.map((p) => p.subject);
  assert.equal(new Set(subjects).size, subjects.length);
  const withRole = (role) => fx.personas.filter((p) => p.roles.includes(role));
  assert.ok(withRole("employee").length >= 1, "cần employee");
  assert.ok(withRole("director").length >= 1, "cần director");
  for (const p of fx.personas) assert.equal(typeof p.displayName, "string");
});

test("session có trạng thái chưa đăng nhập và đã đăng nhập, không token", () => {
  assert.equal(fx.session.anonymous.authenticated, false);
  assert.equal(fx.session.authenticated.authenticated, true);
  for (const s of [fx.session.anonymous, fx.session.authenticated]) {
    assert.ok(Array.isArray(s.capabilities));
  }
});

test("ideas phủ UNDER_REVIEW/APPROVED/REJECTED và chỉ công khai credit khi hợp lệ", () => {
  const statuses = new Set(fx.ideas.map((i) => i.status));
  for (const s of ["UNDER_REVIEW", "APPROVED", "REJECTED"]) assert.ok(statuses.has(s), `thiếu idea ${s}`);
  for (const idea of fx.ideas) {
    assert.match(idea.id, UUID_RE);
    assert.ok(Number.isInteger(idea.version) && idea.version >= 1);
    assert.ok(Array.isArray(idea.capabilities));
    if (idea.publicCredit) {
      assert.equal(idea.status, "APPROVED", `${idea.id}: credit trước APPROVED`);
      assert.equal(idea.publishCreditOnApproval, true, `${idea.id}: credit không có consent`);
    }
  }
});

test("reports phủ AWAITING_ELIGIBLE_JURY và INVESTIGATING, liên kết voting request hợp lệ", () => {
  const statuses = new Set(fx.reports.map((r) => r.status));
  assert.ok(statuses.has("AWAITING_ELIGIBLE_JURY"));
  assert.ok(statuses.has("INVESTIGATING"));
  const votes = byId(fx.votingRequests);
  for (const report of fx.reports) {
    assert.match(report.id, UUID_RE);
    assert.ok(Array.isArray(report.accusedPersonIds) && report.accusedPersonIds.length >= 1);
    if (report.status === "AWAITING_ELIGIBLE_JURY") {
      assert.equal(report.votingRequestId, null, "chưa đủ jury thì chưa có voting request");
    }
    if (report.votingRequestId) {
      const vr = votes.get(report.votingRequestId);
      assert.ok(vr, `${report.id}: votingRequestId không tồn tại`);
      assert.equal(vr.operation, "REVEAL_REPORT_IDENTITY");
      for (const accused of report.accusedPersonIds) {
        assert.ok(!vr.voters.some((v) => v.subject === accused), `${report.id}: người bị tố nằm trong jury`);
      }
    }
  }
});

test("voting requests: N trong 3..5, phủ N=3/4/5, T=ceil(2N/3)", () => {
  const sizes = new Set(fx.votingRequests.map((v) => v.voterCount));
  for (const n of [3, 4, 5]) assert.ok(sizes.has(n), `thiếu mẫu N=${n}`);
  const operations = new Set(fx.votingRequests.map((v) => v.operation));
  assert.ok(operations.has("REVEAL_REPORT_IDENTITY"));
  assert.ok(operations.has("CHANGE_COUNCIL"));
  for (const vr of fx.votingRequests) {
    const label = vr.id;
    assert.ok(vr.voterCount >= 3 && vr.voterCount <= 5, `${label}: N ngoài khoảng`);
    assert.equal(vr.quorumRequired, quorumFor(vr.voterCount), `${label}: T sai`);
    assert.equal(vr.voters.length, vr.voterCount, `${label}: số voter khác N`);
    assert.equal(new Set(vr.voters.map((v) => v.subject)).size, vr.voterCount, `${label}: voter trùng`);
    assert.ok(vr.voters.some((v) => v.independent), `${label}: không có independent`);
    assert.ok(vr.validApprovals >= 0 && vr.validApprovals <= vr.voterCount, `${label}: validApprovals`);
    assert.ok(vr.validApprovals <= vr.voters.filter((v) => v.hasVoted).length, `${label}: phiếu nhiều hơn người đã vote`);
    if (vr.state === "READY") {
      assert.ok(vr.validApprovals >= vr.quorumRequired && vr.independentApproved, `${label}: READY khi chưa đủ T/independent`);
    }
    if (vr.state === "COLLECTING") {
      assert.ok(vr.validApprovals < vr.quorumRequired || !vr.independentApproved, `${label}: đủ điều kiện mà vẫn COLLECTING`);
    }
    assert.ok(!Number.isNaN(Date.parse(vr.expiresAt)), `${label}: expiresAt`);
  }
});

test("council: roster >= 3, có independent active, policy 3 <= min <= max <= 5", () => {
  const { council } = fx;
  assert.ok(Number.isInteger(council.version) && council.version >= 1);
  assert.equal(typeof council.rosterHash, "string");
  assert.ok(council.members.length >= 3);
  const subjects = council.members.map((m) => m.subject);
  assert.equal(new Set(subjects).size, subjects.length);
  assert.ok(council.members.some((m) => m.independent && m.active));
  const { minVoters, maxVoters } = council.selectionPolicy;
  assert.ok(minVoters >= 3 && minVoters <= maxVoters && maxVoters <= 5);
});

test("voter của request đang mở lấy từ roster hiện hành", () => {
  const roster = new Set(fx.council.members.map((m) => m.subject));
  for (const vr of fx.votingRequests.filter((v) => ["COLLECTING", "READY"].includes(v.state))) {
    for (const voter of vr.voters) assert.ok(roster.has(voter.subject), `${vr.id}: ${voter.subject} ngoài roster`);
  }
});

test("council changes phủ COLLECTING/READY/APPLYING/APPLIED/STALE, roster cũ còn hiệu lực khi chưa APPLIED", () => {
  const states = new Set(fx.councilChanges.map((c) => c.state));
  for (const s of ["COLLECTING", "READY", "APPLYING", "APPLIED", "STALE"]) assert.ok(states.has(s), `thiếu ${s}`);
  const votes = byId(fx.votingRequests);
  for (const change of fx.councilChanges) {
    if (["COLLECTING", "READY", "APPLYING"].includes(change.state)) {
      assert.equal(change.baseCouncilVersion, fx.council.version, `${change.id}: pending phải dựa trên version hiện hành`);
    }
    if (change.state === "STALE") {
      assert.ok(change.baseCouncilVersion < fx.council.version, `${change.id}: STALE phải dựa trên version cũ`);
    }
    if (change.votingRequestId) {
      const vr = votes.get(change.votingRequestId);
      assert.ok(vr, `${change.id}: votingRequestId không tồn tại`);
      assert.equal(vr.operation, "CHANGE_COUNCIL");
    }
    assert.ok(change.diff && Array.isArray(change.diff.added) && Array.isArray(change.diff.removed));
  }
});

test("directory chỉ có id/displayName", () => {
  assert.ok(fx.directory.people.length >= 1);
  for (const person of fx.directory.people) {
    assert.deepEqual(Object.keys(person).sort(), ["displayName", "id"]);
  }
});

test("errors: mỗi mã bắt buộc có ApiResult lỗi đúng shape", () => {
  for (const code of REQUIRED_ERROR_CODES) {
    const result = fx.errors[code];
    assert.ok(result, `thiếu fixture lỗi ${code}`);
    assertApiResult(result, code);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, code);
  }
});

test("audit dùng nguồn trong enum và có mẫu APP/FABRIC/SIMULATED", () => {
  const sources = new Set(fx.audit.map((a) => a.source));
  for (const s of ["APP", "FABRIC", "SIMULATED"]) assert.ok(sources.has(s), `thiếu audit ${s}`);
  for (const event of fx.audit) assert.ok(ENFORCEMENT.includes(event.source));
});
