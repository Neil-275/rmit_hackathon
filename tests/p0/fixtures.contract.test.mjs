// Synthetic seed state is private mock input; privacy is asserted on returned views.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, PATHS, createWindow, loadFixtures, runClassic, toPlain } from './helpers/env.mjs';

const { fixtures } = loadFixtures();
const fx = toPlain(fixtures);

test('fixtures load as a network-free classic script and contain JSON-only synthetic data', () => {
  const window = createWindow();
  let requests = 0;
  window.fetch = window.XMLHttpRequest = () => { requests++; throw new Error('Network forbidden'); };
  runClassic(window, PATHS.fixtures);
  assert.equal(requests, 0);
  assert.equal(fx.contractVersion, CONTRACT_VERSION);
  assert.deepEqual(JSON.parse(JSON.stringify(fixtures)), fx);
  assert.doesNotMatch(JSON.stringify(fx), /Bearer\s|eyJ[A-Za-z0-9_-]{10,}\.|-----BEGIN .*PRIVATE KEY-----/);
  assert.equal(fx.organizationId, 'voicevault-demo');
  for (const person of fx.people) {
    assert.deepEqual(Object.keys(person).filter(key => /token|password|secret|contact|email/i.test(key)), []);
  }
});

test('seed people have unique identifiers and support the UI demo roles', () => {
  assert.equal(new Set(fx.people.map(person => person.id)).size, fx.people.length);
  for (const role of ['engineer', 'manager', 'director', 'it_admin', 'ethics_pool']) {
    assert.ok(fx.people.some(person => person.role === role), role);
  }
  for (const person of fx.people) {
    assert.equal(typeof person.displayName, 'string');
    assert.equal(typeof person.title, 'string');
    assert.equal(typeof person.department, 'string');
  }
});

test('idea authors refer to synthetic people and public credit requires approval and consent', () => {
  const people = new Set(fx.people.map(person => person.id));
  for (const idea of fx.ideas) {
    assert.ok(people.has(idea.authorSubject));
    assert.equal(typeof idea.publishCreditOnApproval, 'boolean');
    if (idea.publicCredit) {
      assert.equal(idea.status, 'APPROVED');
      assert.equal(idea.publishCreditOnApproval, true);
    }
  }
  for (const status of ['UNDER_REVIEW', 'ENDORSED', 'APPROVED']) {
    assert.ok(fx.ideas.some(idea => idea.status === status));
  }
});

test('council has an independent active member and a valid 3-to-5 selection policy', () => {
  const people = new Set(fx.people.map(person => person.id));
  assert.ok(Number.isInteger(fx.council.version) && fx.council.version >= 1);
  assert.equal(new Set(fx.council.members.map(member => member.subject)).size, fx.council.members.length);
  assert.ok(fx.council.members.some(member => member.active && member.independent));
  for (const member of fx.council.members) assert.ok(people.has(member.subject));
  const { minVoters, maxVoters } = fx.council.selectionPolicy;
  assert.ok(3 <= minVoters && minVoters <= maxVoters && maxVoters <= 5);
});

test('seed report assignments cover N=3/4/5, exclude accused people and retain an independent voter', () => {
  const roster = new Map(fx.council.members.map(member => [member.subject, member]));
  assert.deepEqual([...new Set(fx.reports.map(report => report.voterIds.length))].sort(), [3, 4, 5]);
  for (const report of fx.reports) {
    assert.equal(new Set(report.voterIds).size, report.voterIds.length);
    assert.ok(report.voterIds.includes(report.recipientSubject));
    assert.ok(report.voterIds.some(id => roster.get(id)?.independent));
    for (const id of report.voterIds) {
      assert.equal(roster.get(id)?.active, true);
      assert.ok(!report.accusedPersonIds.includes(id));
      assert.notEqual(id, report.reporterSubject);
    }
  }
});

test('simulation scenarios support the named UI error and empty-state controls', () => {
  const scenarios = fx.scenarios.map(scenario => scenario.id);
  assert.equal(new Set(scenarios).size, scenarios.length);
  for (const id of ['NORMAL', 'EMPTY', 'UNAUTHENTICATED', 'POLICY_UNAVAILABLE', 'EXPIRED', 'INTEGRITY_MISMATCH']) {
    assert.ok(scenarios.includes(id), id);
  }
});
