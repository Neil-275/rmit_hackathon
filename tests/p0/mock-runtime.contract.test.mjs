// Contract test cho public/ui/mock-runtime.js (mẫu tối thiểu do Tùng bàn giao, sau đó UI sở hữu).
// Mock phải cùng interface/shape với LIVE, có state riêng mỗi instance và không giả nguồn FABRIC.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_VERSION, PATHS, RUNTIME_METHODS, UUID_RE, assertApiResult, createWindow,
  findForbiddenKeys, quorumFor, runClassic, toPlain,
} from "./helpers/env.mjs";

function boot() {
  const window = createWindow();
  runClassic(window, PATHS.fixtures);
  runClassic(window, PATHS.mock);
  assert.equal(typeof window.createVoiceVaultMock, "function", "mock-runtime.js phải định nghĩa createVoiceVaultMock");
  const fixtures = window.VoiceVaultFixtures;
  const runtime = window.createVoiceVaultMock(fixtures);
  return { window, fixtures, fx: toPlain(fixtures), runtime };
}

async function call(runtime, method, ...args) {
  const pending = runtime[method](...args);
  assert.equal(typeof pending?.then, "function", `${method} phải trả Promise`);
  const result = toPlain(await pending);
  assertApiResult(result, method);
  return result;
}

async function expectError(runtime, method, code, ...args) {
  const result = await call(runtime, method, ...args);
  assert.equal(result.ok, false, `${method} phải lỗi ${code}`);
  assert.equal(result.error.code, code);
  assert.equal(result.error.enforcement, "SIMULATED", "mock không được nhận là APP/FABRIC/QEA");
  return result;
}

const validIdea = {
  title: "Giảm thời gian họp",
  description: "Họp đứng 15 phút\r\nmỗi sáng",
  category: "process",
  publishCreditOnApproval: true,
};

function personaWith(fx, role) {
  const persona = fx.personas.find((p) => p.roles.includes(role));
  assert.ok(persona, `fixtures thiếu persona ${role}`);
  return persona.subject;
}

function openRevealRequest(fx) {
  const vr = fx.votingRequests.find(
    (v) => v.operation === "REVEAL_REPORT_IDENTITY" && v.state === "COLLECTING"
      && v.voters.some((x) => !x.hasVoted) && v.validApprovals < v.quorumRequired,
  );
  assert.ok(vr, "fixtures cần một REVEAL request COLLECTING còn người chưa vote");
  return vr;
}

test("runtime khai contractVersion v1, mode MOCK và đủ method", () => {
  const { runtime } = boot();
  assert.equal(runtime.contractVersion, CONTRACT_VERSION);
  assert.equal(runtime.mode, "MOCK");
  for (const name of RUNTIME_METHODS) assert.equal(typeof runtime[name], "function", `thiếu ${name}`);
});

test("không có method sửa roster trực tiếp", () => {
  const { runtime } = boot();
  const keys = Object.keys(runtime).concat(Object.keys(Object.getPrototypeOf(runtime) ?? {}));
  assert.deepEqual(keys.filter((k) => /^(set|update|patch|edit|replace|add|remove)Council/i.test(k)), []);
});

test("mọi method luôn resolve ApiResult, kể cả khi thiếu tham số", async () => {
  const { runtime } = boot();
  for (const name of RUNTIME_METHODS) await call(runtime, name);
});

test("init trả SessionView không token; logout đưa về chưa đăng nhập", async () => {
  const { runtime } = boot();
  const init = await call(runtime, "init");
  assert.equal(init.ok, true);
  assert.equal(typeof init.data.authenticated, "boolean");
  assert.ok(Array.isArray(init.data.capabilities));
  assert.deepEqual(findForbiddenKeys(init.data), []);
  await call(runtime, "logout");
  const after = await call(runtime, "getSession");
  assert.equal(after.data.authenticated, false);
});

test("setPersona đổi phiên; subject không tồn tại trả NOT_FOUND", async () => {
  const { runtime, fx } = boot();
  assert.equal(typeof runtime.mock?.setPersona, "function", "MOCK cần runtime.mock.setPersona(subject)");
  const director = personaWith(fx, "director");
  const changed = toPlain(await runtime.mock.setPersona(director));
  assertApiResult(changed, "setPersona");
  assert.equal(changed.ok, true);
  const session = await call(runtime, "getSession");
  assert.equal(session.data.authenticated, true);
  assert.ok(session.data.roles.includes("director"));
  const bad = toPlain(await runtime.mock.setPersona("khong-ton-tai"));
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, "NOT_FOUND");
});

test("listIdeas trả Page và không lộ tác giả", async () => {
  const { runtime, fx } = boot();
  await runtime.mock.setPersona(personaWith(fx, "director"));
  const page = await call(runtime, "listIdeas", {});
  assert.equal(page.ok, true);
  assert.ok(Array.isArray(page.data.items));
  assert.ok(page.data.nextCursor === null || typeof page.data.nextCursor === "string");
  assert.deepEqual(findForbiddenKeys(page.data), []);
});

test("submitIdea hợp lệ tạo UNDER_REVIEW với UUID, input sai trả INVALID_REQUEST", async () => {
  const { runtime, fx } = boot();
  await runtime.mock.setPersona(personaWith(fx, "employee"));
  const created = await call(runtime, "submitIdea", validIdea);
  assert.equal(created.ok, true);
  assert.match(created.data.id, UUID_RE);
  assert.equal(created.data.status, "UNDER_REVIEW");
  assert.equal(created.data.publicCredit ?? null, null);
  assert.deepEqual(findForbiddenKeys(created.data), []);
  await expectError(runtime, "submitIdea", "INVALID_REQUEST", { title: "", description: "" });
});

test("chưa đăng nhập thì thao tác ghi trả UNAUTHENTICATED", async () => {
  const { runtime } = boot();
  await call(runtime, "logout");
  await expectError(runtime, "submitIdea", "UNAUTHENTICATED", validIdea);
});

test("mỗi instance có state riêng và không sửa fixtures", async () => {
  const { window, fx } = boot();
  const before = JSON.stringify(window.VoiceVaultFixtures);
  const a = window.createVoiceVaultMock(window.VoiceVaultFixtures);
  const b = window.createVoiceVaultMock(window.VoiceVaultFixtures);
  const employee = personaWith(fx, "employee");
  const director = personaWith(fx, "director");
  await a.mock.setPersona(employee);
  const created = await call(a, "submitIdea", validIdea);
  await b.mock.setPersona(director);
  const listB = await call(b, "listIdeas", {});
  assert.ok(!listB.data.items.some((i) => i.id === created.data.id), "state bị chia sẻ giữa instance");
  assert.equal(JSON.stringify(window.VoiceVaultFixtures), before, "fixtures bị sửa");
});

test("voting request hiển thị đúng N/T", async () => {
  const { runtime, fx } = boot();
  const vr = openRevealRequest(fx);
  await runtime.mock.setPersona(vr.voters[0].subject);
  const got = await call(runtime, "getVotingRequest", vr.id);
  assert.equal(got.ok, true);
  assert.equal(got.data.voterCount, vr.voterCount);
  assert.equal(got.data.quorumRequired, quorumFor(vr.voterCount));
});

test("listMyVotingRequests chỉ trả request có persona trong danh sách voter", async () => {
  const { runtime, fx } = boot();
  const vr = openRevealRequest(fx);
  const voter = vr.voters[0].subject;
  await runtime.mock.setPersona(voter);
  const mine = await call(runtime, "listMyVotingRequests", {});
  assert.equal(mine.ok, true);
  assert.ok(mine.data.items.some((i) => i.id === vr.id));
  for (const item of mine.data.items) assert.ok(item.voters.some((v) => v.subject === voter));
});

test("người ngoài jury vote bị FORBIDDEN", async () => {
  const { runtime, fx } = boot();
  const vr = openRevealRequest(fx);
  const outsider = fx.personas.find((p) => !vr.voters.some((v) => v.subject === p.subject));
  assert.ok(outsider, "fixtures cần persona ngoài jury");
  await runtime.mock.setPersona(outsider.subject);
  await expectError(runtime, "castVote", "FORBIDDEN", vr.id, { decision: "APPROVE", reason: "x" });
});

test("vote hai lần chỉ được tính một", async () => {
  const { runtime, fx } = boot();
  const vr = openRevealRequest(fx);
  const voter = vr.voters.find((v) => !v.hasVoted && !v.independent) ?? vr.voters.find((v) => !v.hasVoted);
  await runtime.mock.setPersona(voter.subject);
  const first = await call(runtime, "castVote", vr.id, { decision: "APPROVE", reason: "ok" });
  assert.equal(first.ok, true);
  const count = first.data.validApprovals;
  const second = await call(runtime, "castVote", vr.id, { decision: "APPROVE", reason: "lần 2" });
  const after = await call(runtime, "getVotingRequest", vr.id);
  assert.equal(after.data.validApprovals, count, "phiếu thứ hai không được tính");
  if (second.ok === false) assert.equal(second.error.enforcement, "SIMULATED");
});

test("dưới T vẫn khóa: revealIdentity trả QUORUM_PENDING", async () => {
  const { runtime, fx } = boot();
  const vr = openRevealRequest(fx);
  await runtime.mock.setPersona(personaWith(fx, "director"));
  await expectError(runtime, "revealIdentity", "QUORUM_PENDING", "REPORT", vr.resourceId, vr.id);
});

test("đủ T APPROVE có independent thì READY; T tính trên N, không trên số đã vote", async () => {
  const { runtime, fx } = boot();
  const vr = openRevealRequest(fx);
  const pending = vr.voters.filter((v) => !v.hasVoted).sort((a, b) => Number(b.independent) - Number(a.independent));
  let state = vr.state;
  let approvals = vr.validApprovals;
  for (const voter of pending) {
    await runtime.mock.setPersona(voter.subject);
    const res = await call(runtime, "castVote", vr.id, { decision: "APPROVE", reason: "đồng ý" });
    assert.equal(res.ok, true);
    approvals = res.data.validApprovals;
    state = res.data.state;
    assert.equal(res.data.quorumRequired, quorumFor(vr.voterCount), "T không được đổi khi vote");
    if (approvals < vr.quorumRequired) assert.equal(state, "COLLECTING", "READY sớm hơn T");
    if (state === "READY") break;
  }
  assert.equal(state, "READY");
  assert.ok(approvals >= vr.quorumRequired);
});

test("một DENY hợp lệ kết thúc request", async () => {
  const { runtime, fx } = boot();
  const vr = openRevealRequest(fx);
  const voter = vr.voters.find((v) => !v.hasVoted);
  await runtime.mock.setPersona(voter.subject);
  const res = await call(runtime, "castVote", vr.id, { decision: "DENY", reason: "chưa đủ căn cứ" });
  assert.equal(res.ok, true);
  assert.equal(res.data.state, "DENIED");
});

test("đề xuất đổi council không đổi roster hiện hành; apply khi chưa đủ phiếu bị chặn", async () => {
  const { runtime, fx } = boot();
  const member = fx.council.members[0].subject;
  await runtime.mock.setPersona(member);
  const before = await call(runtime, "getCouncil");
  assert.equal(before.ok, true);
  const proposal = await call(runtime, "submitCouncilChange", {
    expectedCouncilVersion: before.data.version,
    reason: "Bổ sung thành viên độc lập",
    proposedMembers: [
      ...before.data.members,
      { subject: "subject-new-member", displayName: "Thành viên mới", membershipRole: "MEMBER", independent: true, active: true },
    ],
    proposedSelectionPolicy: before.data.selectionPolicy,
  });
  assert.equal(proposal.ok, true);
  assert.ok(["COLLECTING", "AWAITING_ELIGIBLE_JURY"].includes(proposal.data.state));
  assert.equal(proposal.data.baseCouncilVersion, before.data.version);

  const during = await call(runtime, "getCouncil");
  assert.deepEqual(during.data, before.data, "roster đổi trước khi APPLIED");

  const apply = await call(runtime, "applyCouncilChange", proposal.data.id, proposal.data.version);
  assert.equal(apply.ok, false);
  assert.equal(apply.error.code, "QUORUM_PENDING");
  const after = await call(runtime, "getCouncil");
  assert.deepEqual(after.data, before.data);
});

test("listAudit chỉ có nguồn SIMULATED cho sự kiện mock tạo ra", async () => {
  const { runtime, fx } = boot();
  await runtime.mock.setPersona(personaWith(fx, "employee"));
  const created = await call(runtime, "submitIdea", validIdea);
  const audit = await call(runtime, "listAudit", {});
  if (audit.ok) {
    const own = audit.data.items.filter((e) => e.resourceId === created.data.id);
    for (const event of own) assert.equal(event.source, "SIMULATED");
    assert.deepEqual(findForbiddenKeys(audit.data), []);
  }
});
