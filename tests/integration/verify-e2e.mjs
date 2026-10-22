// @ts-check
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

const BASE_URL = process.env.VOICEVAULT_URL || 'http://localhost:3000';
const TIDECLOAK_URL = process.env.TIDECLOAK_URL || 'http://localhost:8081';

describe('VoiceVault x TideCloak End-to-End Verification Suite', () => {

  test('1. Health check returns ok and connects to local SQLite', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    assert.equal(res.status, 200, 'Health check must return 200');
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.status, 'ok');
    assert.equal(json.data.database, 'sqlite');
    assert.ok(json.data.rosterHash, 'Must expose council roster hash');
  });

  let realToken = '';

  test('2. Acquire TideCloak token (Live or Simulated)', async () => {
    let tokenAcquired = false;
    try {
      const params = new URLSearchParams({
        grant_type: 'password',
        client_id: 'myclient',
        username: 'an_nguyen',
        password: 'password123'
      });

      const res = await fetch(`${TIDECLOAK_URL}/realms/myrealm/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          realToken = data.access_token;
          tokenAcquired = true;
        }
      }
    } catch (e) {
      // Live container unreachable, use simulated endpoint
    }

    if (!tokenAcquired) {
      // Simulated TideCloak token endpoint
      const simRes = await fetch(`${BASE_URL}/api/v1/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'an_nguyen' })
      });
      assert.equal(simRes.status, 200, 'Simulated TideCloak token issuance must succeed');
      const simData = await simRes.json();
      realToken = simData.data.access_token;
    }

    assert.ok(realToken, 'Token must be present');
  });

  test('3. Server-side TideCloak token enforcement on /api/protected', async () => {
    // 3a. Denied: Unauthenticated access
    const resNoToken = await fetch(`${BASE_URL}/api/protected`);
    assert.equal(resNoToken.status, 401, 'Request without token must be 401');
    const bodyNoToken = await resNoToken.json();
    assert.ok(bodyNoToken.error?.includes('Unauthorized'));

    // 3b. Denied: Tampered / Invalid token
    const resTampered = await fetch(`${BASE_URL}/api/protected`, {
      headers: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature' }
    });
    assert.equal(resTampered.status, 403, 'Tampered token must be 403');
    const bodyTampered = await resTampered.json();
    assert.ok(bodyTampered.error?.includes('Forbidden'));

    // 3c. Authorized: Valid TideCloak token
    assert.ok(realToken, 'Real token must be present');
    const resValid = await fetch(`${BASE_URL}/api/protected`, {
      headers: { 'Authorization': `Bearer ${realToken}` }
    });
    assert.equal(resValid.status, 200, 'Valid token must be 200');
    const bodyValid = await resValid.json();
    assert.equal(bodyValid.ok, true);
    assert.equal(bodyValid.username, 'an_nguyen');
  });

  test('4. Protected Ideas lifecycle: Role-based permissions & client-sealed author identity', async () => {
    // Submit idea by employee an_nguyen
    const ideaPayload = {
      title: 'E2E Test TideCloak Decentralized Identity Idea',
      description: 'Testing confidential idea submission with client encrypted identity envelope',
      category: 'ENGINEERING',
      publishCreditOnApproval: true,
      authorCiphertext: 'TC-CIPHERTEXT-ENCRYPTED-AN-NGUYEN-IDENTITY-KEY-9988'
    };

    const submitRes = await fetch(`${BASE_URL}/api/v1/ideas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${realToken}`
      },
      body: JSON.stringify(ideaPayload)
    });

    assert.equal(submitRes.status, 201, 'Idea creation must succeed with 201');
    const submitBody = await submitRes.json();
    assert.equal(submitBody.ok, true);
    const createdIdea = submitBody.data;
    assert.ok(createdIdea.id);
    assert.equal(createdIdea.status, 'UNDER_REVIEW');
    assert.equal(createdIdea.publicCredit, null, 'Public credit must stay sealed under review');

    // 4a. Denied: Regular employee without 'manager' role attempts to endorse
    const endorseDeniedRes = await fetch(`${BASE_URL}/api/v1/ideas/${createdIdea.id}/endorse`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${realToken}` }
    });
    assert.equal(endorseDeniedRes.status, 403, 'Regular employee must be denied endorsement (403)');
    const endorseDeniedBody = await endorseDeniedRes.json();
    assert.equal(endorseDeniedBody.error.code, 'FORBIDDEN');

    // 4b. Allowed: Manager endorses idea
    const endorseAllowedRes = await fetch(`${BASE_URL}/api/v1/ideas/${createdIdea.id}/endorse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-Persona': 'minh' // Manager persona
      }
    });
    assert.equal(endorseAllowedRes.status, 200, 'Manager endorsement must succeed');
    const endorseAllowedBody = await endorseAllowedRes.json();
    assert.equal(endorseAllowedBody.data.endorsementCount, 1);
  });

  test('5. Whistleblowing Report: Conflict-of-interest exclusion and threshold gating', async () => {
    // Submit report accusing a council member (e.g. Bich Dao)
    const accusedId = 'person-bich-dao';
    const reportPayload = {
      title: 'Suspicious procurement conflict in APAC division',
      summary: 'Detailed report with encrypted attachments and evidence envelope',
      accusedPersonIds: [accusedId]
    };

    const reportRes = await fetch(`${BASE_URL}/api/v1/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${realToken}`
      },
      body: JSON.stringify(reportPayload)
    });

    assert.equal(reportRes.status, 201, 'Report creation must succeed with 201');
    const reportBody = await reportRes.json();
    assert.equal(reportBody.ok, true);
    assert.ok(reportBody.data.id);
    assert.ok(reportBody.data.votingRequestId);

    // Fetch the generated voting request
    const vrRes = await fetch(`${BASE_URL}/api/v1/voting-requests/${reportBody.data.votingRequestId}`);
    assert.equal(vrRes.status, 200);
    const vrBody = await vrRes.json();
    const vr = vrBody.data;

    // Check jury rules
    assert.ok(vr.voterCount >= 3 && vr.voterCount <= 5, 'Jury size must be between 3 and 5');
    assert.equal(vr.quorumRequired, Math.ceil((2 * vr.voterCount) / 3), 'Threshold T must be ceil(2N/3)');

    const voterSubjects = vr.voters.map((v) => v.subject);
    assert.ok(!voterSubjects.includes(accusedId), 'Accused council member MUST be excluded from jury');
    assert.equal(vr.state, 'COLLECTING', 'Initial state must be COLLECTING');
  });

  test('6. Audit logging contains accurate enforcement source labels', async () => {
    const auditRes = await fetch(`${BASE_URL}/api/v1/audit?limit=10`);
    assert.equal(auditRes.status, 200);
    const auditBody = await auditRes.json();
    assert.ok(Array.isArray(auditBody.data.items));
    assert.ok(auditBody.data.items.length > 0);

    const sources = new Set(auditBody.data.items.map(i => i.source));
    assert.ok(sources.has('APP') || sources.has('FABRIC') || sources.has('SIMULATED'), 'Audit events must use honest enforcement sources');
  });

  test('7. Database user profile and Prisma ORM synchronization', async () => {
    // 7a. Directory returns people persisted in SQLite
    const dirRes = await fetch(`${BASE_URL}/api/v1/directory`);
    assert.equal(dirRes.status, 200);
    const dirBody = await dirRes.json();
    assert.ok(Array.isArray(dirBody.data.people));
    assert.ok(dirBody.data.people.length >= 8, 'Directory should contain all database users');
    const anPerson = dirBody.data.people.find(p => p.id === 'subject-an');
    assert.ok(anPerson, 'An must be present in directory');

    // 7b. User profile from /api/v1/profile returns connected DB profile
    const profileRes = await fetch(`${BASE_URL}/api/v1/profile`, {
      headers: { 'X-Dev-Persona': 'minh' }
    });
    assert.equal(profileRes.status, 200);
    const profileBody = await profileRes.json();
    assert.equal(profileBody.ok, true);
    assert.equal(profileBody.data.user.displayName, 'Minh');
    assert.equal(profileBody.data.user.department, 'Operations');

    // 7c. Direct Prisma ORM query validation
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const dbUsers = await prisma.user.findMany();
      assert.ok(dbUsers.length >= 8, 'Prisma should query users table');
      const seedUser = await prisma.user.findFirst({ where: { username: 'minh' } });
      assert.ok(seedUser, 'Seed user Minh must exist in SQLite via Prisma');
      assert.equal(seedUser.department, 'Operations');

      const councilRecord = await prisma.council.findUnique({ where: { version: 3 } });
      assert.ok(councilRecord, 'Council version 3 must exist in SQLite via Prisma');
    } finally {
      await prisma.$disconnect();
    }
  });

  test('8. Simulated TideCloak sign-in, role checking and access enforcement', async () => {
    // 8a. Sign in as Minh (manager) via simulated endpoint
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'minh' })
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.ok, true);
    assert.ok(loginData.data.access_token);
    assert.ok(loginData.data.user.roles.includes('manager'));

    const managerToken = loginData.data.access_token;

    // 8b. Sign in as An (regular employee, lacks manager role)
    const anLoginRes = await fetch(`${BASE_URL}/api/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'an' })
    });
    const anToken = (await anLoginRes.json()).data.access_token;

    // 8c. Denied: Regular employee token cannot endorse an idea
    const ideaRes = await fetch(`${BASE_URL}/api/v1/ideas`);
    const ideaId = (await ideaRes.json()).data.items[0].id;

    const denyRes = await fetch(`${BASE_URL}/api/v1/ideas/${ideaId}/endorse`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${anToken}` }
    });
    assert.equal(denyRes.status, 403, 'Regular employee must be denied endorsement (403)');

    // 8d. Allowed: Manager token successfully endorses idea
    const allowRes = await fetch(`${BASE_URL}/api/v1/ideas/${ideaId}/endorse`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    assert.equal(allowRes.status, 200, 'Manager token must successfully endorse idea (200)');
  });

});
