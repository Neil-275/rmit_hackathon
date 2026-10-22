const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function load(clock) {
  const window = { crypto: webcrypto };
  const context = vm.createContext({ window, crypto: webcrypto, console, setTimeout, clearTimeout, structuredClone });
  if (clock) context.Date = class extends Date { static now() { return clock.value; } };
  for (const name of ['../../integration/contract-fixtures.js', '../mock-runtime.js']) {
    const filename = path.resolve(__dirname, name);
    if (fs.existsSync(filename)) vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  assert.equal(typeof window.createVoiceVaultMock, 'function', 'The v1 mock runtime factory must exist');
  return window.createVoiceVaultMock(window.VoiceVaultFixtures);
}
async function ok(promise) {
  const result = await promise;
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(result.contractVersion, 'v1');
  return result.data;
}
async function error(promise, code) {
  const result = await promise;
  assert.equal(result.ok, false);
  assert.equal(result.error.code, code);
  assert.equal(result.error.enforcement, 'SIMULATED');
}
const ideaInput = { title: 'Một sáng kiến mới có ích', description: 'Cải tiến quy trình kiểm tra để tiết kiệm thời gian cho cả nhóm.', category: 'PROCESS', publishCreditOnApproval: true };
const reportInput = { title: 'Cần xem xét quy trình mua hàng', evidenceDetails: 'Dữ liệu hoàn toàn giả để kiểm tra luồng phản ánh và hội đồng.', accusedPersonIds: ['binh'], contact: 'an@example.test', consent: true };

test('runtime implements every agreed v1 action and identifies itself as MOCK', async () => {
  const runtime = load();
  for (const method of ['init','getSession','login','logout','listIdeas','submitIdea','endorseIdea','decideIdea','listReports','submitReport','getDirectory','createUnmaskRequest','getVotingRequest','castVote','getCouncil','listCouncilChanges','submitCouncilChange','applyCouncilChange','revealIdentity','listAudit']) {
    assert.equal(typeof runtime[method], 'function', method);
  }
  assert.equal(runtime.mode, 'MOCK');
  const session = await ok(runtime.init());
  assert.equal(session.authenticated, true);
  assert.equal(session.subject, 'an');
  assert.equal('token' in session, false);
});

test('invalid submissions fail without creating records', async () => {
  const runtime = load();
  const before = await ok(runtime.listIdeas({}));
  await error(runtime.submitIdea({ ...ideaInput, title: ' ' }), 'INVALID_REQUEST');
  const after = await ok(runtime.listIdeas({}));
  assert.equal(after.items.length, before.items.length);
  await error(runtime.submitReport({ ...reportInput, accusedPersonIds: [] }), 'INVALID_REQUEST');
  await error(runtime.submitReport({ ...reportInput, accusedPersonIds: ['unknown'] }), 'INVALID_REQUEST');
});

test('submission returns a sealed public view and defensive copies', async () => {
  const runtime = load();
  const created = await ok(runtime.submitIdea(ideaInput));
  assert.equal(created.status, 'UNDER_REVIEW');
  assert.equal(created.revealedAuthor, undefined);
  created.title = 'tampered';
  const list = await ok(runtime.listIdeas({}));
  assert.equal(list.items.find(item => item.id === created.id).title, ideaInput.title);
  const report = await ok(runtime.submitReport(reportInput));
  assert.equal(JSON.stringify(report).includes('an@example.test'), false);
  assert.equal('reporterSubject' in report, false);
});

test('idea decisions respect roles, expected version and terminal rejection', async () => {
  const runtime = load();
  const idea = await ok(runtime.submitIdea(ideaInput));
  await error(runtime.endorseIdea(idea.id, idea.version), 'FORBIDDEN');
  await ok(runtime.login('binh'));
  const endorsed = await ok(runtime.endorseIdea(idea.id, idea.version));
  await ok(runtime.login('chi'));
  await error(runtime.decideIdea(idea.id, { decision: 'APPROVE', expectedVersion: idea.version }), 'VERSION_CONFLICT');
  const rejected = await ok(runtime.decideIdea(idea.id, { decision: 'REJECT', expectedVersion: endorsed.version, reason: 'Cần thêm dữ liệu để đánh giá.' }));
  await error(runtime.revealIdentity('IDEA', idea.id), 'POLICY_DENIED');
  await error(runtime.decideIdea(idea.id, { decision: 'APPROVE', expectedVersion: rejected.version }), 'VERSION_CONFLICT');
});

test('approval without publication consent does not reveal the author', async () => {
  const runtime = load();
  const idea = await ok(runtime.submitIdea({ ...ideaInput, publishCreditOnApproval: false }));
  await ok(runtime.login('binh'));
  const endorsed = await ok(runtime.endorseIdea(idea.id, idea.version));
  await ok(runtime.login('chi'));
  await ok(runtime.decideIdea(idea.id, { decision: 'APPROVE', expectedVersion: endorsed.version }));
  await error(runtime.revealIdentity('IDEA', idea.id), 'CONSENT_REQUIRED');
});

test('N=4 and N=5 do not reach the threshold after two approvals', async () => {
  for (const [roundId, expectedN, expectedT] of [['vote-report-101',4,3],['vote-report-103',5,4]]) {
    const runtime = load();
    await ok(runtime.login('frank'));
    let round = await ok(runtime.getVotingRequest(roundId));
    assert.equal(round.voterCount, expectedN);
    assert.equal(round.quorumRequired, expectedT);
    for (const actor of ['frank','grace']) {
      await ok(runtime.login(actor));
      round = await ok(runtime.castVote(roundId, { decision: 'APPROVE', reason: 'Đã xem xét bối cảnh vụ việc.' }));
    }
    assert.equal(round.status, 'COLLECTING');
    await ok(runtime.login('frank'));
    await error(runtime.revealIdentity('REPORT', round.resourceId, round.id), 'QUORUM_PENDING');
  }
});

test('duplicate, excluded and outside voters cannot contribute approvals', async () => {
  const runtime = load();
  await ok(runtime.login('eva'));
  await error(runtime.castVote('vote-report-101', { decision:'APPROVE',reason:'Review' }), 'FORBIDDEN');
  await ok(runtime.login('frank'));
  await ok(runtime.castVote('vote-report-101', { decision:'APPROVE',reason:'Review' }));
  await error(runtime.castVote('vote-report-101', { decision:'APPROVE',reason:'Again' }), 'ALREADY_VOTED');
  const round = await ok(runtime.getVotingRequest('vote-report-101'));
  assert.equal(round.approvalCount, 1);
});

test('reaching the numeric count without an independent vote remains locked', async () => {
  const runtime = load();
  for (const actor of ['frank','henry','iris']) {
    await ok(runtime.login(actor));
    await ok(runtime.castVote('vote-report-101', { decision:'APPROVE',reason:'Reviewed' }));
  }
  let round = await ok(runtime.getVotingRequest('vote-report-101'));
  assert.equal(round.approvalCount, 3);
  assert.equal(round.independentApproved, false);
  assert.equal(round.status, 'COLLECTING');
  await ok(runtime.login('grace'));
  round = await ok(runtime.castVote(round.id, { decision:'APPROVE',reason:'Independent review' }));
  assert.equal(round.status, 'READY');
  await error(runtime.revealIdentity('REPORT', 'report-101', round.id), 'FORBIDDEN');
  await ok(runtime.login('frank'));
  const identity = await ok(runtime.revealIdentity('REPORT', 'report-101', round.id));
  assert.equal(identity.displayName, 'An Nguyễn');
  assert.equal(identity.simulated, true);
  assert.equal(JSON.stringify(await ok(runtime.listAudit({}))).includes('an@example.test'), false);
});

test('deny terminates a vote, and expired or mismatched requests cannot reveal', async () => {
  const runtime = load();
  await ok(runtime.login('frank'));
  const denied = await ok(runtime.castVote('vote-report-101', { decision:'DENY',reason:'Chưa đủ căn cứ.' }));
  assert.equal(denied.status, 'DENIED');
  await error(runtime.castVote(denied.id, { decision:'APPROVE',reason:'Again' }), 'VERSION_CONFLICT');
  await error(runtime.revealIdentity('REPORT', 'report-102', denied.id), 'INTEGRITY_MISMATCH');
  runtime.simulation.setScenario('EXPIRED');
  await error(runtime.castVote('vote-report-103', { decision:'APPROVE',reason:'Review' }), 'APPROVAL_EXPIRED');
});

test('new reports exclude multiple accused members and never redraw on a repeated request', async () => {
  const runtime = load();
  const report = await ok(runtime.submitReport({ ...reportInput, accusedPersonIds:['binh','eva'], clientRequestId:'retry-one' }));
  assert.ok(report.voters.every(voter => voter.id !== 'eva'));
  assert.ok([3,4].includes(report.voterCount));
  assert.equal(report.quorumRequired, report.voterCount === 3 ? 2 : 3);
  const retry = await ok(runtime.submitReport({ ...reportInput, accusedPersonIds:['binh','eva'], clientRequestId:'retry-one' }));
  assert.equal(retry.id, report.id);
  assert.deepEqual(retry.voters, report.voters);
  const waiting = await ok(runtime.submitReport({ ...reportInput, accusedPersonIds:['eva','frank','grace'] }));
  assert.equal(waiting.status, 'AWAITING_ELIGIBLE_JURY');
  assert.equal(waiting.voterCount, 0);
});

test('assigned juror initiates an unmask request without redrawing its report assignment', async () => {
  const runtime = load();
  const report = await ok(runtime.submitReport(reportInput));
  assert.equal(report.voting, null);
  assert.equal(report.capabilities.canRequestUnmask, false);
  await error(runtime.createUnmaskRequest(report.id, {purpose:'Kiểm tra hồ sơ đầy đủ.'}), 'FORBIDDEN');
  const juror = report.voters[0].id;
  await ok(runtime.login(juror));
  const assigned = (await ok(runtime.listReports({}))).items.find(item => item.id === report.id);
  assert.equal(assigned.capabilities.canRequestUnmask, true);
  const input = { recipientSubject: juror, purpose: 'Cần đối chiếu chứng cứ trong phản ánh.' };
  const request = await ok(runtime.createUnmaskRequest(report.id, input));
  assert.deepEqual(request.voting.voters, report.voters);
  assert.equal(request.voting.voterCount, report.voterCount);
  assert.equal(request.voting.quorumRequired, report.quorumRequired);
  const retry = await ok(runtime.createUnmaskRequest(report.id, input));
  assert.equal(retry.id, request.id);
});

test('council roster is unchanged at READY and only applies through the approved proposal', async () => {
  const runtime = load();
  await ok(runtime.login('frank'));
  const council = await ok(runtime.getCouncil());
  const input = { expectedCouncilVersion:council.version, reason:'Bổ sung đại diện độc lập cho hội đồng.', proposedMembers:[...council.members,{subject:'mai',displayName:'Mai Trần',independent:true,active:true,membershipRole:'MEMBER'}], proposedSelectionPolicy:council.selectionPolicy };
  const proposal = await ok(runtime.submitCouncilChange(input));
  const same = await ok(runtime.submitCouncilChange(input));
  assert.equal(same.id, proposal.id);
  await error(runtime.applyCouncilChange(proposal.id, council.version), 'QUORUM_PENDING');
  const round = await ok(runtime.getVotingRequest(proposal.votingRequestId));
  assert.equal(round.voters.some(voter => voter.id === 'mai'), false);
  await ok(runtime.login('mai'));
  await error(runtime.castVote(round.id,{decision:'APPROVE',reason:'My appointment'}),'FORBIDDEN');
  const ordered = [...round.voters].sort((a,b)=>Number(b.independent)-Number(a.independent));
  for (const voter of ordered.slice(0, round.quorumRequired)) {
    await ok(runtime.login(voter.id));
    await ok(runtime.castVote(round.id,{decision:'APPROVE',reason:'Xác nhận thành viên phù hợp.'}));
  }
  assert.equal((await ok(runtime.getCouncil())).version, council.version);
  await ok(runtime.login('frank'));
  const applied = await ok(runtime.applyCouncilChange(proposal.id, council.version));
  assert.equal(applied.status, 'APPLIED');
  const next = await ok(runtime.getCouncil());
  assert.equal(next.version, council.version + 1);
  assert.equal(next.members.some(member => member.subject === 'mai'), true);
  assert.equal((await ok(runtime.getVotingRequest('vote-report-101'))).status, 'STALE');
});

test('scenario errors never present a successful simulated authorization', async () => {
  const runtime = load();
  runtime.simulation.setScenario('EMPTY');
  assert.equal((await ok(runtime.listIdeas({}))).items.length,0);
  runtime.simulation.setScenario('UNAUTHENTICATED');
  await error(runtime.listReports({}), 'UNAUTHENTICATED');
  runtime.simulation.setScenario('NORMAL');
  await ok(runtime.logout());
  assert.equal((await ok(runtime.getSession())).authenticated,false);
  await error(runtime.submitIdea(ideaInput), 'UNAUTHENTICATED');
});

test('anonymous submission audit never links the submitting persona to a resource', async () => {
  const runtime = load();
  const idea = await ok(runtime.submitIdea(ideaInput));
  const report = await ok(runtime.submitReport(reportInput));
  await ok(runtime.login('dave'));
  const audit = await ok(runtime.listAudit({}));
  for (const resource of [idea, report]) {
    const event = audit.items.find(item => item.targetId === resource.id);
    assert.ok(event);
    assert.equal(event.actor, 'Người gửi ẩn danh');
  }
});

test('expired READY council votes cannot change the roster or offer apply capability', async () => {
  const clock = { value: Date.now() };
  const runtime = load(clock);
  await ok(runtime.login('frank'));
  const council = await ok(runtime.getCouncil());
  const proposal = await ok(runtime.submitCouncilChange({
    expectedCouncilVersion: council.version, reason: 'Bổ sung thành viên để kiểm tra thời hạn.',
    proposedMembers: [...council.members, { subject: 'mai', independent: false, active: true, membershipRole: 'MEMBER' }],
    proposedSelectionPolicy: council.selectionPolicy
  }));
  const round = proposal.voting;
  const voters = [...round.voters].sort((a,b) => Number(b.independent) - Number(a.independent));
  for (const voter of voters.slice(0, round.quorumRequired)) {
    await ok(runtime.login(voter.id));
    await ok(runtime.castVote(round.id, { decision: 'APPROVE', reason: 'Thành viên phù hợp.' }));
  }
  await ok(runtime.login('frank'));
  clock.value = Date.parse(round.expiresAt) + 1;
  await error(runtime.applyCouncilChange(proposal.id, council.version), 'APPROVAL_EXPIRED');
  const expired = (await ok(runtime.listCouncilChanges({}))).items[0];
  assert.equal(expired.status, 'EXPIRED');
  assert.equal(expired.capabilities.canApply, false);
  assert.equal((await ok(runtime.getVotingRequest(round.id))).canReveal, false);
  assert.equal((await ok(runtime.getCouncil())).version, council.version);
});
