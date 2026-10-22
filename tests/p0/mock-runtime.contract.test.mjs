// Reuse the UI owner's workflow regressions and add P0 boundary/privacy checks.
import '../../public/ui/tests/runtime.test.cjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATHS, RUNTIME_METHODS, assertApiResult, createWindow, findForbiddenKeys, runClassic, toPlain } from './helpers/env.mjs';

function boot() {
  const window = createWindow();
  for (const file of [PATHS.fixtures, PATHS.mock]) runClassic(window, file);
  return { window, runtime: window.createVoiceVaultMock(window.VoiceVaultFixtures) };
}
async function call(runtime, method, ...args) {
  const pending = runtime[method](...args);
  assert.equal(typeof pending?.then, 'function', method);
  const result = toPlain(await pending);
  assertApiResult(result, method);
  return result;
}
async function ok(runtime, method, ...args) {
  const result = await call(runtime, method, ...args);
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.data;
}
const ideaInput = { title: 'A useful process improvement', description: 'Improve the review process for every team in the workspace.', category: 'PROCESS', publishCreditOnApproval: true };

test('all current UI runtime methods resolve ApiResult even with missing arguments', async () => {
  const { runtime } = boot();
  assert.equal(runtime.mode, 'MOCK');
  assert.equal(runtime.contractVersion, 'v1');
  for (const method of RUNTIME_METHODS) {
    assert.equal(typeof runtime[method], 'function', method);
    await call(runtime, method);
  }
  assert.deepEqual(Object.keys(runtime).filter(key => /^(set|update|patch|edit|replace|add|remove)Council/i.test(key)), []);
});

test('mock instances and returned nested views are isolated without mutating seed fixtures', async () => {
  const { window, runtime } = boot();
  const before = JSON.stringify(window.VoiceVaultFixtures);
  const other = window.createVoiceVaultMock(window.VoiceVaultFixtures);
  const created = await ok(runtime, 'submitIdea', ideaInput);
  const list = await ok(other, 'listIdeas', {});
  assert.ok(!list.items.some(idea => idea.id === created.id));
  const council = await ok(runtime, 'getCouncil');
  council.members[0].active = false;
  council.selectionPolicy.minVoters = 99;
  const untouched = await ok(runtime, 'getCouncil');
  assert.equal(untouched.members[0].active, true);
  assert.equal(untouched.selectionPolicy.minVoters, 3);
  assert.equal(JSON.stringify(window.VoiceVaultFixtures), before);
});

test('Session, Idea, Report, Directory, Council and Audit views never expose submitter IDs, tokens or contact', async () => {
  const { runtime } = boot();
  const session = await ok(runtime, 'init');
  assert.equal(typeof session.capabilities.canSubmit, 'boolean');
  assert.equal(typeof session.role, 'string');
  assert.deepEqual(findForbiddenKeys(session), []);
  for (const method of ['listIdeas', 'listReports', 'getDirectory', 'getCouncil', 'listCouncilChanges', 'listAudit']) {
    const data = await ok(runtime, method, {});
    assert.deepEqual(findForbiddenKeys(data), [], method);
    assert.doesNotMatch(JSON.stringify(data), /@example\.test/);
  }
  const reports = await ok(runtime, 'listReports', {});
  for (const report of reports.items) {
    assert.equal(typeof report.capabilities.canRequestUnmask, 'boolean');
    assert.equal(typeof report.voting.canVote, 'boolean');
    assert.ok(Array.isArray(report.voting.validApprovals));
  }
  const ideas = await ok(runtime, 'listIdeas', {});
  for (const idea of ideas.items) {
    assert.equal(typeof idea.capabilities.canEndorse, 'boolean');
    if (idea.publicCredit) {
      assert.equal(idea.status, 'APPROVED');
      assert.equal(idea.publishCreditOnApproval, true);
    }
  }
});

for (const [id, n, threshold] of [['vote-report-102', 3, 2], ['vote-report-101', 4, 3], ['vote-report-103', 5, 4]]) {
  test(`N=${n} requires ${threshold} approvals including an independent voter`, async () => {
    const { runtime } = boot();
    await ok(runtime, 'login', 'frank');
    let round = await ok(runtime, 'getVotingRequest', id);
    assert.equal(round.voterCount, n);
    assert.equal(round.quorumRequired, threshold);
    const ordered = [...round.voters].sort((a, b) => Number(b.independent) - Number(a.independent));
    for (let index = 0; index < threshold; index++) {
      await ok(runtime, 'login', ordered[index].id);
      round = await ok(runtime, 'castVote', id, { decision: 'APPROVE', reason: 'Reviewed the synthetic evidence.' });
      assert.equal(round.quorumRequired, threshold);
      assert.equal(round.status, index + 1 < threshold ? 'COLLECTING' : 'READY');
    }
    assert.equal(round.independentApproved, true);
  });
}
