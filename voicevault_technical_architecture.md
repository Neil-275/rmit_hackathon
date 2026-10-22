# VoiceVault — Technical architecture for two people working in parallel

> Scope: Sealed-Credited Ideas + Protected Reports, RMIT Hackathon — UNLOCKED.
> Status: implementation design. The current application uses MOCK only; LIVE and G1–G5 have not been run. Paths, endpoints, scripts, and integration tests below specify target deliverables, not verified implementation.
> Usage: you read [architecture_toi.md](./architecture_toi.md), Tung reads [architecture_tung.md](./architecture_tung.md); this document maintains shared contracts and business/security rules.
> Confirmed constraint: your machine cannot run Next.js/Docker; Tung's supports both. You own static UI; Tung owns platform and browser runtime. A = you, B = Tung in the flows below.
> This document replaces the previous technical design. Before submission, align README/Idea.MD with actual results; retain no claims stronger than the available evidence.

## Contents

- [1. MVP decisions and security criteria](#1-mvp-decisions-and-security-criteria)
- [2. Architecture and trust boundaries](#2-architecture-and-trust-boundaries)
- [3. Roles and file ownership](#3-roles-and-file-ownership)
- [4. Baseline before branching](#4-baseline-before-branching)
- [5. Shared v1 contract](#5-shared-v1-contract)
- [6. API, auth, and error handling](#6-api-auth-and-error-handling)
- [7. State machines and business flows](#7-state-machines-and-business-flows)
- [8. SDK and TideCloak policy](#8-sdk-and-tidecloak-policy)
- [9. Hashing and authorship evidence](#9-hashing-and-authorship-evidence)
- [10. Conflicts of interest and council selection](#10-conflicts-of-interest-and-council-selection)
- [11. Database, transactions, and migrations](#11-database-transactions-and-migrations)
- [12. Parallel development and detailed Git merges](#12-parallel-development-and-detailed-git-merges)
- [13. Running the system after merge](#13-running-the-system-after-merge)
- [14. Privacy and audit](#14-privacy-and-audit)
- [15. Prompts and handoff templates](#15-prompts-and-handoff-templates)
- [16. Tests, demo, and completion criteria](#16-tests-demo-and-completion-criteria)
- [17. Technical sources](#17-technical-sources)

## 1. MVP decisions and security criteria

| Topic | Decision |
| --- | --- |
| Roles | You: HTML/CSS/JS UI + mock + manual QA. Tung: Next.js/Docker/API/DB/IAM/policy, browser crypto/runtime, build/test/merge |
| Architecture | Next.js serves API and static UI in public/ui; no React/TSX requirement or two separate application scaffolds |
| Database | SQLite + Prisma; replace JSON storage to unify transactions/migrations |
| Versions | Pin scaffolded, successfully smoke-tested Next.js/React/SDK versions; avoid vague “14+” requirements |
| ORM for this guide | Prisma CLI and @prisma/client both 6.19.0; a major upgrade is a separate baseline change |
| Contract | Tung owns DTO/schema v1; UI uses runtime interface v1 and JS fixtures generated from shared source, without TypeScript imports |
| Council roster | Fix a versioned roster at initialization; all later changes require voting |
| Eligible voters | Randomly draw both N and N people from the current roster after CoI filtering; default N ranges from 3 to min(5, eligibleCount) |
| Approval threshold | T = ceil(2 × N / 3) distinct APPROVE votes, including at least one independent approver |
| Council changes | Propose additions/removals/role changes → same voting pipeline as reports → verify and apply atomically; old roster remains effective until applied |
| Insufficient eligible members | AWAITING_ELIGIBLE_JURY; never lower minVoters or change N/T after selection |
| Report content | Fake data, stored in readable form in the prototype; API restricts readers |
| Public authorship credit | Only after APPROVED + idea-bound consent + valid evidence |
| Rejected ideas | Terminal, no reveal request; no promises of key deletion or permanent sealing |
| Reporter plaintext | Recipient session memory only; never persisted to the database |
| Unverified policy | POLICY_UNAVAILABLE, with no fallback to DB counters/UI variables |
| Demo personas | Real authenticated sessions, beyond changing activeRole in the interface |

This scope replaces the old Credited-only MVP in Idea.MD. Both implementers must share this interpretation.

### 1.1. Technical gates require evidence

| Gate | Required evidence | Owner | If unmet |
| --- | --- | --- | --- |
| G1 | An encrypts; another recipient opens through a genuinely supported sharing mechanism | Tung implements; you review UX | Lock reveal and state that cross-user sharing is unsupported |
| G2 | Direct calls cannot open unapproved/rejected records even with a role | B | Do not work around this with broad decrypt roles |
| G3 | Report/council-change approvals and grants bind the correct resource/payload, roster version, N/T, assignment, recipient, expiry, and policy | B | Vote rows show progress only and grant no cryptographic authority |
| G4 | Proof establishes authenticated authorship, beyond a self-declared JSON name | Tung implements; you review presentation | Do not display “Cryptographically Verified” |
| G5 | QEA/policy prevent direct roster/permission edits, repeat bootstrap, and changes without valid votes | B | Limit claims and identify unverified paths |

Record PASS/FAIL/NOT RUN, test case, version, and a nonsensitive request ID for every gate. A red modal does not replace evidence of a real operation.

## 2. Architecture and trust boundaries

~~~mermaid
flowchart LR
    U[User] --> C[Browser: your UI + Tung's runtime]
    C -->|JWT + DTO v1 + ciphertext| S[Tung: API + domain services]
    S --> D[(SQLite)]
    C <--> T[TideCloak SDK / IAM]
    T <--> F[Fabric + policy]
    S --> P[Tung: Policy adapter]
    P -->|Requests and evidence| F
    F -->|Results for a valid session| C
~~~

The diagram defines responsibility boundaries. Actual SDK/policy call flows must be confirmed at G1–G3; this does not assert an unverified Tide API.

Three independent layers:

1. Authentication verifies token, application, organization, and session.
2. Application authorization checks roles, read permissions, jury, state, and version.
3. Cryptographic authorization verifies resource-specific evidence at the cryptographic service itself. Bypassing API/UI or editing DB rows must not create a valid decryption request.

Layers 1/2 alone do not protect against a malicious backend. Policy must not trust an approved flag or a backend-edited assignment without an appropriate source of evidence.

Disclose these limitations:

- A backend receiving JWTs still knows the sender at request time. Omitting sub reduces database linkage but does not provide anonymity against the backend.
- Modified frontend code can record plaintext before encryption; client-code integrity is an assumption to assess when admins control deployment.
- Viewers can capture/disclose content. Revocation cannot recover information already seen.
- A colluding group of T = ceil(2 × N / 3) eligible members can approve; the design does not eliminate all collusion.
- Encryption does not prevent record deletion, service shutdown, or inferring authorship from content.
- Directory, roster/version, N/voter selection, proof, and policy need trustworthy sources consistent with the threat model, beyond database storage.

## 3. Roles and file ownership

| Person | Owns | Not required on this machine |
| --- | --- | --- |
| You / A | public/ui: classic HTML/CSS/JS, local assets, mock runtime, manual QA, demo | No Node/npm/Next/Docker/Prisma/SDK/test runner |
| Tung / B | Next host/API, DB, browser LIVE runtime, SDK bridge, bootstrap, contract/fixtures, policy/QEA, build/CI/tests/merge | No UI conversion to React during integration |
| Shared review | Runtime interface, views/fixtures, N/T/state UX, gate results | You review browser/mock and LIVE evidence provided by Tung |

The complete individual workflows are in [your guide](./architecture_toi.md) and [Tung's guide](./architecture_tung.md).

### 3.1. Target structure

~~~text
repository-root/
├── architecture_toi.md / architecture_tung.md
├── voicevault_technical_architecture.md      shared contract/business rules, coordinated by Tung
├── public/
│   ├── ui/                                 owned by you
│   │   ├── index.html, styles.css, app.js
│   │   ├── mock-runtime.js
│   │   └── views/, assets/
│   ├── integration/                        owned by Tung
│   │   ├── bootstrap.js                    classic JS, works on file://
│   │   ├── contract-fixtures.js             fake fixtures, tracked
│   │   └── runtime.generated.js            generated, gitignored, LIVE only
│   └── auth/                               Tung: SDK callback/SSO assets
├── src/
│   ├── app/                                Tung: host/redirect and API
│   ├── contracts/                          Tung: types/schema/encoding/fixture source
│   ├── integration/browser-runtime.ts      Tung: SDK/API/crypto in browser
│   └── server/                             Tung: services/DB/council/policy/audit
├── prisma/, scripts/, tests/, .github/      Tung
├── package.json, package-lock.json, config/ Tung
└── docs/integration/                        individual handoffs; Tung records tests/gates
~~~

Each file has one owner. Do not edit bootstrap/runtime/dependencies to connect UI; ask Tung to update the runtime contract first. Tung must not edit UI to hide DTO mismatches without an ownership handoff.

Use the static UI unchanged at /ui/index.html; Next.js serves public from the root URL, without a React rewrite. [Next.js public folder](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder).

Use separate checkouts. Only Tung's checkout needs node_modules, env, DB, app ports, and Docker; yours needs a browser/editor and Git if available. Toolchain installation is not a prerequisite for UI work.

## 4. Baseline before branching

### 4.1. Foundation on Tung's machine, local UI on yours

1. Tung verifies/pins Node/npm/Docker/Next/SDK/Prisma locally; your machine need not install the same toolchain.
2. Hand over section 5.4 runtime contract, bootstrap.js, and contract-fixtures.js early, usable locally without a build. Agree the index/app mount hook together.
3. Open public/ui/index.html through file://; classic scripts load fixtures without JSON fetches or ES modules. Label mock mode.
4. Tung scaffolds/pins Next in the existing repository root, configures /ui/index.html, completes Tide enrollment/realm/roster bootstrap, and builds the LIVE bridge.
5. API/schema/fixtures have one source owned by Tung. Use only the interface and view fixtures; do not duplicate TS/types or guess raw JSON.
6. Tung runs auth/SDK/live probes; you review UI. Unverified gates remain FAIL/NOT RUN.
7. Commit/push the baseline to integration/voicevault, with both branches at the same SHA. Your machine does not need runtime.generated.js.

Manifest docs/integration/baseline.json records Tung's toolchain versions, SDK/image/policy ID, roster hash/version, min/max, and bootstrap receipt. docs/integration/gates.md separates mock/manual/LIVE, with no tokens/secrets/plaintext.

Quickstart latest is only for initial setup; Tung pins real image digests and dependencies after smoke tests. [Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart).

### 4.2. Environment

- Only Tung creates .env/DB/realm/SDK config. .env.example contains no secrets; SQLite DBs in prisma/local are gitignored.
- Public browser bundles/config contain no admin credentials, client secrets, or reporter plaintext.
- Callback returns to the real HTTP(S) origin of /ui/index.html; file:// never logs in to Tide or calls APIs.
- UI assets use relative paths and deferred classic scripts. No Tailwind build/CDN/npm imports on your machine.
- Tung manages tags/roles/policy manifests and announces changes; no silent console edits during review.
- Do not commit DB/WAL/SHM/env/tokens/keys/sensitive realm exports. Public fixtures contain fake data only.
- With an existing valid test URL, you can review LIVE in a browser; Tung's localhost is not automatically accessible from your machine.

### 4.3. Scripts required at M0

This table specifies required target scripts. Tung must create and verify them; all commands run on his machine, not yours. Their presence alone does not establish LIVE verification.

| Script | Responsibility |
| --- | --- |
| build:fixtures | Export fake JS fixtures for file:// and check against contract |
| build:bridge | Bundle browser SDK/runtime before running/building Next |
| dev/build/start | Build bridge before Next dev/build; start uses built artifacts |
| test:ui:file | Playwright opens file:// without SDK/API and checks local UI |
| test:ui:live | Playwright through /ui/index.html with real LIVE runtime/API |
| typecheck | tsc --noEmit |
| lint | Configured ESLint; do not assume every Next version provides next lint |
| test:unit | Vitest: encoding, algorithms, service/client adapters |
| test:contracts | DTO/schema/fixture success/error cases and hash vectors |
| test:integration | Separate API + DB tests; identify cases requiring a real realm |
| test:security:live | G1–G5 with real Tide; missing config reports NOT RUN/unsuccessful |
| test:e2e | Playwright with separate sessions per persona |
| db:validate/db:generate | prisma validate / prisma generate |
| db:migrate:dev | prisma migrate dev; only B creates migrations |
| db:migrate:deploy | prisma migrate deploy, applying committed migrations |
| db:seed | tsx prisma/seed.ts, idempotent on the specified demo DB |
| check | typecheck + lint + unit + contracts + build; does not replace live tests |

npm ci requires matching manifest/lockfile and does not create a new lockfile. [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

## 5. Shared v1 contract

Tung owns src/contracts and exports contract-fixtures.js; you review views/runtime interface before branching and do not import TypeScript into classic UI. The browser generates UUIDs before encryption; the server validates/prevents duplicates and never changes proof-bound IDs. Display names are not authorization IDs. Validate every request/response at runtime using shared schemas; types do not replace validation.

Contract changes require schema + fixture + contract test + request/response examples, merged before consumers. Breaking changes require a new version or synchronized migration within one milestone.

### 5.1. Core types

These are internal interfaces to implement, not existing Tide APIs.

~~~typescript
export type ResourceKind = "IDEA" | "REPORT" | "COUNCIL_CHANGE";
export type VotingPurpose = "REVEAL_REPORT_IDENTITY" | "CHANGE_COUNCIL";
export type Enforcement = "APP" | "FABRIC" | "SIMULATED";

export interface ResourceBinding {
  contractVersion: "v1";
  organizationId: string;
  resourceKind: ResourceKind;
  resourceId: string;
  contentVersion: number;
  contentHash: string;
  policyVersion: string;
}
export interface IdentityEnvelope {
  scheme: "TIDE_V1";
  tag: "idea_author" | "report_id";
  ciphertext: string;
  ciphertextHash: string;
  binding: ResourceBinding;
}
export interface CreateIdeaRequest {
  contractVersion: "v1";
  id: string;
  title: string;
  description: string;
  category: string;
  publishCreditOnApproval: boolean;
  identityEnvelope: IdentityEnvelope;
}
export interface CreateReportRequest {
  contractVersion: "v1";
  id: string;
  title: string;
  evidenceDetails: string;
  accusedPersonIds: string[];
  identityEnvelope: IdentityEnvelope;
}
export interface ApprovalContext {
  requestId: string;
  binding: ResourceBinding;
  payloadHash: string;
  ciphertextHash?: string; // Required for REVEAL_REPORT_IDENTITY; unused for CHANGE_COUNCIL.
  operation: VotingPurpose;
  votingAssignmentHash: string;
  councilVersion: number;
  councilRosterHash: string;
  voterCount: number;
  quorumRequired: number;
  recipientSubject: string; // Identity recipient or proposal executor; bound into proof.
  purpose: string;
  nonce: string;
  expiresAt: string;
}
export interface SubmitApprovalRequest {
  contractVersion: "v1";
  votingRequestId: string;
  decision: "APPROVE" | "DENY";
  reason: string;
  proof: string;
}
export interface CouncilMemberSpec {
  subject: string;
  independent: boolean;
  active: boolean;
  membershipRole: "MEMBER" | "CHAIR";
}
export interface VotingSelectionPolicy {
  minVoters: number;
  maxVoters: number;
}
export interface CreateCouncilChangeRequest {
  contractVersion: "v1";
  id: string;
  expectedCouncilVersion: number;
  reason: string;
  proposedMembers: CouncilMemberSpec[]; // Complete target roster; server computes diff/hash.
  proposedSelectionPolicy: VotingSelectionPolicy; // Complete target policy, even when unchanged.
}
export type ApiResult<T> =
  | { ok: true; data: T; requestId: string; contractVersion: "v1" }
  | {
      ok: false;
      error: {
        code: string; message: string;
        enforcement: Enforcement; retryable: boolean;
      };
      requestId: string; contractVersion: "v1";
    };
~~~

Visible binding supports routing/preliminary checks only; its counterpart must be in the protected/authenticated payload. The server recomputes content/ciphertext hashes using agreed encoding. Proof is a verified G3 artifact, not an arbitrary string/backend-issued HMAC. Derive the juror from the token and match the signer, never from the body. IdentityEnvelope schema accepts IDEA/REPORT bindings only; COUNCIL_CHANGE has no identity envelope. For council votes, payloadHash binds target roster/diff/version; for reveal, it binds reveal context and requires ciphertextHash.

### 5.2. Views to finalize at M0

| View | Semantics |
| --- | --- |
| IdeaView | Permission-scoped content, status/version, endorsement, consent, server-computed capabilities; public credit after verification |
| ReportView | Permission-scoped content, roster version/hash, immutable N/T and assignment, approval progress; lists exclude reporter ID/plaintext/envelope |
| UnmaskRequestView | votingRequestId, context hash/state/version, N/T, valid approval count, independent approval, expiry |
| CouncilView | Current roster with ID/role/independent, version/hash; no direct UI editing |
| CouncilChangeView | Base roster/version, target diff/roster, votingRequestId, N/T, assignment, state and apply result; CouncilView stays unchanged until apply |
| DirectoryView | Selectable ID/display name; no email/full personnel graph exposed to everyone |
| RevealChallenge | Context and public data for a verified flow; more than allowDecrypt=true |
| AuditEventView | Source, result, safe request/resource IDs; no submitter identity |

Capabilities guide UI presentation and do not replace cryptographic decisions. Never return raw Prisma objects to clients.

### 5.3. Mock for independent UI work

Implement mock-runtime.js against section 5.4 using window.VoiceVaultFixtures from a local script. No JSON fetch/module imports/CDN on file://. Mock uses fake in-memory state and a clear banner; crypto is not needed to render it.

file:// is MOCK only. HTTP(S) is LIVE only; runtime/config/service errors display errors with no fallback. LIVE tests verify real requests and LIVE mode, beyond a badge. Include N=3/4/5, T=2/3/4 fixtures and council pending/READY/APPLYING/APPLIED/STALE states.

### 5.4. Runtime bridge v1 between UI and system

This new internal contract separates toolchains. Tung supplies LIVE implementation; you supply MOCK implementation. Both use matching inputs/outputs, contractVersion=v1, and view models; UI neither fetches APIs nor reads raw tokens.

~~~text
window.VoiceVaultUI.mount(runtime)      // Defined by you; bootstrap calls it once.
window.createVoiceVaultMock(fixtures)  // Defined by you; used only on file://.

runtime.contractVersion = "v1"
runtime.mode = "MOCK" or "LIVE"
runtime.init() -> Promise<ApiResult<SessionView>>
runtime.getSession() -> Promise<ApiResult<SessionView>>
runtime.login() / runtime.logout() -> start flow; may redirect in LIVE
runtime.listIdeas(query) -> Promise<ApiResult<Page<IdeaView>>>
runtime.submitIdea(formInput) -> Promise<ApiResult<IdeaView>>
runtime.endorseIdea(id, expectedVersion) -> Promise<ApiResult<IdeaView>>
runtime.decideIdea(id, decisionInput) -> Promise<ApiResult<IdeaView>>
runtime.listReports(query) -> Promise<ApiResult<Page<ReportView>>>
runtime.submitReport(formInput) -> Promise<ApiResult<ReportView>>
runtime.getDirectory() -> Promise<ApiResult<DirectoryView>>
runtime.createUnmaskRequest(reportId, input) -> Promise<ApiResult<UnmaskRequestView>>
runtime.getVotingRequest(id) -> Promise<ApiResult<VotingRequestView>>
runtime.castVote(id, decisionInput) -> Promise<ApiResult<VotingRequestView>>
runtime.getCouncil() -> Promise<ApiResult<CouncilView>>
runtime.listCouncilChanges(query) -> Promise<ApiResult<Page<CouncilChangeView>>>
runtime.submitCouncilChange(formInput) -> Promise<ApiResult<CouncilChangeView>>
runtime.applyCouncilChange(id, expectedVersion) -> Promise<ApiResult<CouncilChangeView>>
runtime.revealIdentity(resourceKind, resourceId, requestId) -> Promise<ApiResult<IdentityView>>
runtime.listAudit(query) -> Promise<ApiResult<Page<AuditEventView>>>
~~~

Before U1, Tung defines missing contract views: SessionView (authenticated/displayName/capabilities, no token), Page (items/nextCursor), VotingRequestView (operation/context/N/T/voters/validApprovals/state/expiry), IdentityView (temporary view only, never persisted), and each form schema. When unauthenticated, init/getSession return SessionView with authenticated=false so UI shows a sign-in action; do not force a login loop. Page/View values are serializable JS data; no UI framework is required.

Distinguish formInput from API DTOs:

| UI passes to runtime | Browser LIVE runtime responsibilities |
| --- | --- |
| submitIdea: title/description/category/publishCreditOnApproval | Derive session identity, create UUID/binding/hash/proof/envelope, call POST /ideas |
| submitReport: title/evidenceDetails/accusedPersonIds/contact/consent according to schema | Keep contact/identity in browser, encrypt, send API DTO; never send plaintext identity to server |
| castVote: APPROVE or DENY/reason on votingRequestId | Obtain immutable context, create/verify SDK proof, submit /voting-requests/:id/approvals |
| decideIdea/council proposal/apply | Create or forward artifacts under policy/API; UI never signs or issues grants itself |
| revealIdentity | Obtain challenge/envelope, perform browser crypto/verification; never POST plaintext to server |

UI renders only ApiResult/capabilities/N/T/state and does not decide permissions. Remove IdentityView from state on close/logout; no logs/storage/SSR. Tung implements canonical encoding/runtime validation without requiring SDK installation on your machine to call a function.

One contract source owned by Tung generates JS fixtures tracked in Git; mock and LIVE must not independently guess field names. Tung owns bootstrap.js; load order is fixture -> mock factory -> app mount definition -> bootstrap. Load generated LIVE bundle only on HTTP(S); version mismatch stops with CONTRACT_MISMATCH. Missing bridge/config never triggers mock fallback.

## 6. API, auth, and error handling

Prefix /api/v1; every endpoint except health requires auth. Lists are paginated, at most 50 items, scoped to organization and record-level permissions.

| Method/path | Responsibility |
| --- | --- |
| GET /health | Nonsensitive liveness, no config/tokens |
| GET /me | Real session, organization, capabilities |
| GET /directory | Selectable IDs within the same org |
| GET /ideas | IdeaView[], no identity envelope |
| POST /ideas | CreateIdeaRequest, real validation/binding/idempotency/persistence |
| POST /ideas/:id/endorse | Manager, expectedVersion, actor from token |
| POST /ideas/:id/decision | Director, decision/reason/expectedVersion and decision artifact |
| POST /ideas/:id/reveal-challenges | APPROVED + consent + verified decision, recipient/purpose |
| GET /reports | Authorized records only, no public board |
| POST /reports | Multiple accused people, one-time jury selection, real persistence |
| POST /reports/:id/unmask-requests | Assigned juror, recipient/purpose/version; no reveal yet |
| GET /unmask-requests/:id | Permission-scoped view, no plaintext |
| GET /voting-requests/:id | Permission-scoped vote context/snapshot/N/T/progress, shared by both flows |
| POST /voting-requests/:id/approvals | SubmitApprovalRequest; verify proof/membership/context + transaction, shared by reveal and council change |
| POST /unmask-requests/:id/reveal-challenges | Adapter verifies evidence, then creates a real challenge |
| GET /resources/:kind/:id/identity-envelope | Valid challenge/request, correct recipient; ciphertext only, no plaintext |
| GET /council | Current roster/version/hash; no direct roster PATCH endpoint |
| GET /council/change-requests | Permission-scoped paginated CouncilChangeView list for runtime.listCouncilChanges |
| POST /council/change-requests | CreateCouncilChangeRequest; snapshot old roster, draw N/voters once, create VotingRequest |
| GET /council/change-requests/:id | Target diff/roster, N/T, vote progress, apply state |
| POST /council/change-requests/:id/apply | Valid executor; verify threshold/policy/version, outbox/QEA if required, no unchecked roster overwrite |
| POST /governance/role-change-requests | QEA adapter for whitelisted changes; council-related changes must reference a proposal with valid votes, with no shortcut |
| GET /audit | Audit role, redaction, pagination |

Resource-creation POSTs carry an Idempotency-Key UUID bound to org/scope/payload hash: same key/body returns the prior result; different body returns IDEMPOTENCY_CONFLICT. Never store submitter subject/JWT in idempotency records; persist within the same transaction so retries cannot recreate reports/assignments. Decisions, approvals, unmask/council-change/governance operations are also idempotent. Resubmitting the same council-change payload on the same base version while a proposal is active must reference the same proposal/voting assignment or be rejected; a new UUID cannot redraw voters. External calls use outbox/request IDs; do not hold DB transactions while waiting for the network.

| HTTP/code | Semantics |
| --- | --- |
| 400 INVALID_REQUEST | Invalid schema/UUID/encoding; never echo sensitive payloads |
| 401 UNAUTHENTICATED | Missing/forged/expired token or wrong issuer/client |
| 403 FORBIDDEN | Application denial; source APP, never label it Fabric |
| 404 NOT_FOUND | Missing or existence must not be disclosed; prevent cross-org disclosure |
| 409 VERSION_CONFLICT | Refresh before retrying the action |
| 409 COUNCIL_VERSION_CONFLICT | Roster changed; old proposal becomes STALE; never apply its diff/votes to the new version |
| 403 COUNCIL_VOTE_REQUIRED | Attempted direct membership/role/independent edit or voting bypass |
| 409 BOOTSTRAP_ALREADY_COMPLETED | Attempted roster reinitialization to bypass voting |
| 409 QUORUM_PENDING | Remain locked; do not repeat decryption |
| 409 IDEMPOTENCY_CONFLICT | Existing key with a different body |
| 409 INSUFFICIENT_ELIGIBLE_JURORS | Waiting for jury; do not lower threshold |
| 410 APPROVAL_EXPIRED | New request required; never reuse old votes |
| 422 INTEGRITY_MISMATCH | No reveal or verified credit |
| 403 POLICY_DENIED | FABRIC only when a real service denial is confirmed |
| 503 POLICY_UNAVAILABLE | Unverified adapter/service failure; remain locked |

A saved report without enough jurors returns 201 + AWAITING_ELIGIBLE_JURY, rather than an error suggesting it was not saved. Use the insufficient code when attempting to form a jury/request reveal for a waiting record.

### 6.1. Corrected auth snippet

This auth skeleton does not replace complete routes: B must add validation/org scoping/persistence/error mapping.

~~~typescript
import "server-only";
import { verifyTideCloakToken } from "@tidecloak/verify";
import { tidecloakServerConfig } from "./config";

export async function authenticateEmployee(req: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!match) return null;
  const payload = await verifyTideCloakToken(
    tidecloakServerConfig, match[1], ["employee"],
  );
  if (!payload) return null;
  // App-specific claims require mapper configuration/tests; do not assume Tide supplies them.
  if (typeof payload.sub !== "string" || typeof payload.organization_id !== "string") {
    return null;
  }
  return { subject: payload.sub, organizationId: payload.organization_id };
}
~~~

At M0 configure the employee role for personas allowed to submit. Director/juror/admin routes check additional permissions; allowedRoles uses OR semantics and does not replace AND conditions. A Bearer prefix is not authentication. [Verify JWT](https://docs.tide.org/Languages/NextJS/VerifyJWT).

Cookie auth requires CSRF/cookie policy. Client-side DPoP alone is insufficient; the resource server must verify corresponding proofs.

## 7. State machines and business flows

### 7.1. Ideas

~~~text
UNDER_REVIEW -> ENDORSED -> APPROVED
      |             |
      +-----------> REJECTED
APPROVED + consent + verified decision
  -> challenge -> browser decrypt/verify -> public credit under consent
~~~

MVP requires endorsement before approval; REJECTED is terminal and cannot reopen. APPROVED does not mean identity has been revealed/published. Transitions check role/org/expectedVersion inside a transaction.

1. Your UI calls submitIdea with form input; Tung's browser runtime derives org/identity from the session, generates UUID, and canonicalizes/hashes content.
2. Protected payload contains binding, authenticated author, consent, and G4 origin proof. Automatic publication on approval requires explicit consent at submission.
3. B performs real validation/hashing/persistence and returns a receipt, with no submitter FK.
4. Manager endorses separately; no PATCH of submitted authorship/ciphertext/content.
5. Director creates a decision artifact through the verified mechanism; changing status cannot create valid proof.
6. Recipient completes a challenge through Tung's browser runtime; runtime validates schema/proof/binding/hash before UI displays the name.
7. Persist public credit only with consent and a verifiable G4 artifact; never trust arbitrary names sent by the browser. Otherwise display only in a valid session and disclose that the ledger is unverified.

REJECTED creates no reveal request in MVP. UI says “Identity is not published after rejection”, avoiding “SEALED FOREVER” or “Zero Ridicule”.

### 7.2. Reports

~~~text
Report: received -> AWAITING_ELIGIBLE_JURY or INVESTIGATING -> RESOLVED
UnmaskRequest: COLLECTING -> READY -> GRANTED
                    |         |
                    +-------> EXPIRED
                    +-------> DENIED
~~~

READY indicates progress, not cryptographic authority. GRANTED follows adapter verification/real authorization. Reconcile external-call timeouts by request ID; a grant does not prove the browser viewed plaintext.

1. Your UI calls submitReport with fake evidence and multiple accused IDs; Tung's browser runtime creates the envelope and does not accept self-declared departments for CoI decisions.
2. B uses the roster fixed at initialization, resolves directory/CoI, and snapshots policy/roster. Draw N within valid bounds, then N people once; lock N, voter list, and T = ceil(2 × N / 3), or save a waiting record.
3. An assigned juror creates an UnmaskRequest linked to VotingRequest, binding resource/binding, ciphertext/assignment/roster hash/version, N/T, recipient/purpose/nonce/expiry. Reveal requests on the same report assignment do not redraw N/voters to seek a favorable council.
4. Each juror sees the same context in a separate session and approves/denies with verifiable proof. MVP: one valid DENY terminates the request; reconsideration requires a new request.
5. T distinct APPROVE votes including at least one independent create READY; adapter submits evidence. Fabric itself rejects insufficient thresholds/wrong context; abstaining/offline members never reduce denominator N.
6. The recipient reveals in the correct context/session; plaintext never goes to API/audit.
7. Expiry or assignment/policy/content changes invalidate old votes; never reuse them for a new request. When the current roster changes, pending requests become STALE and new grants are blocked under section 10.3.

## 8. SDK and TideCloak policy

### 8.1. Target permission matrix

| Persona | Business action | Reveal conditions |
| --- | --- | --- |
| An/employee | Submit records | Cannot read other people's identities |
| Binh/manager | Assigned ideas, endorsement | Cannot reveal author/reporter |
| Chi/director | Idea decisions | APPROVED + consent + proof, correct recipient |
| Dave/it_admin | Operations, permission-change proposals | No automatic decrypt permission |
| Eva/Frank/Grace/Henry/Iris | Council roster fixed at bootstrap | Random assignment with correct N/T, no CoI, sufficient proof, correct recipient |
| Proposed new member | No council permission yet | Permission only after sufficient votes and APPLIED proposal |
| Governance admins | IAM/policy changes | Not automatically jurors/recipients |

Do not grant tag decrypt roles to the entire pool/director and rely on delayed UI calls. If primitive tags cannot enforce resource policy, use a supported, proven Tide mechanism or keep reveal locked.

### 8.2. Tung's SDK wrapper in browser runtime

SDK references use item arrays. This wrapper normalizes primitive tags only; it adds no quorum/state policy and is not a complete reveal flow. Use for smoke tests or when G1/G2 confirm a suitable flow.

~~~typescript
type EncryptItem = { data: string | Uint8Array; tags: string[] };
type DecryptItem = { encrypted: string; tags: string[] };
type EncryptFn = (items: EncryptItem[]) => Promise<string[]>;
type DecryptFn = (items: DecryptItem[]) => Promise<(string | Uint8Array)[]>;

export async function encryptJson(
  encrypt: EncryptFn, payload: unknown, tag: string,
): Promise<string> {
  const values = await encrypt([{ data: JSON.stringify(payload), tags: [tag] }]);
  if (values.length !== 1 || typeof values[0] !== "string") {
    throw new Error("INVALID_CRYPTO_RESPONSE");
  }
  return values[0];
}
export async function decryptJson<T>(
  decrypt: DecryptFn, ciphertext: string, tag: string,
  validate: (value: unknown) => T,
): Promise<T> {
  const values = await decrypt([{ encrypted: ciphertext, tags: [tag] }]);
  if (values.length !== 1) throw new Error("INVALID_CRYPTO_RESPONSE");
  const value = values[0];
  const text = typeof value === "string"
    ? value : new TextDecoder("utf-8", { fatal: true }).decode(value);
  return validate(JSON.parse(text));
}
~~~

Bind functions to the correct pinned instance/hook. Validate at runtime instead of only using as T. The names selfencrypt/selfdecrypt do not establish cross-user semantics. [Next SDK](https://docs.tide.org/Languages/NextJS/tidecloak-nextjs-reference), [JS types](https://docs.tide.org/Languages/JavaScript/tidecloak-js-reference).

### 8.3. Tung's policy adapter

Internal interfaces to implement/verify; these names do not assert existing Tide APIs:

~~~text
verifySubmissionOrigin(protectedPayload/proof, binding)
verifyIdeaDecision(decisionArtifact, binding, ciphertextHash, recipient)
verifyVotingAssignment(assignmentArtifact, org, councilVersion, rosterHash, N, T, policyVersion)
verifyApproval(proof, ApprovalContext, authenticatedJuror)
createRevealChallenge(verifiedContext, verifiedProofs)
verifyCouncilChange(changeArtifact, baseVersion, candidateRosterHash, verifiedVotes)
applyCouncilChange(verifiedProposal, expectedCouncilVersion)
requestGovernedRoleChange(whitelistedChange, approvedCouncilProposalIfRelevant)
~~~

The cryptographic service itself must verify the full canonical context, distinct approvers, membership/roster snapshot, drawn and locked N/T, independent/CoI, operation/payload/recipient/expiry/policy. It must not trust row counts/status. Prevent votes for A being used for B, ciphertext/recipient/purpose changes after signing, and grants used outside their allowed scope/session.

Assignment/directory require appropriate authenticated sources. A backend editing an assignment and signing it with its own secret does not defend against that backend. Missing adapters return POLICY_UNAVAILABLE, never fake artifacts.

If using Forseti, record contract hash/ID/version and validation stages actually executed. Hooks vary by policy mode; do not assume all hooks execute in the same request. [Forseti](https://docs.tide.org/Core-Concepts/forseti-engine).

### 8.4. QEA differs from case quorum

QEA protects IAM/policy changes; it does not automatically convert vote rows into cryptographic approval for reports or council changes. Governance admins and council members are separate sets. Every council roster/role change first requires section 10.3 business votes; QEA, where applicable, is an additional technical application step, not a substitute for voting or a way to trigger bootstrap/roster edits independently.

QEA documentation specifies max(1, floor(0.7 * N_admins)): one or two admins may require one approval; three require two. The master realm is outside QEA. B must test actual admin/configuration paths, account for this exception, and never infer that master can read plaintext. [QEA](https://docs.tide.org/Core-Concepts/iga-workflow).

A governance demo uses three real admin accounts and a real request still pending after one approval. Do not force admins to be jurors merely to match vote counts.

## 9. Hashing and authorship evidence

Shared encoding in src/contracts/contentEncoding.ts: validate strings, Unicode NFC, CRLF to LF, preserve other whitespace; fixed-order JSON. Store/display the canonical content itself. Never stringify arbitrary objects or spread input.

~~~typescript
type IdeaContentV1 = {
  organizationId: string; resourceId: string; contentVersion: number;
  title: string; description: string; category: string;
};
const normalizeText = (v: string) => v.normalize("NFC").replace(/\r\n?/g, "\n");

export function encodeIdeaV1(v: IdeaContentV1): Uint8Array {
  // Input already validated; fixed field order is shared by client/server.
  return new TextEncoder().encode(JSON.stringify({
    schema: "voicevault.idea.content.v1",
    organizationId: v.organizationId,
    resourceId: v.resourceId,
    contentVersion: v.contentVersion,
    title: normalizeText(v.title),
    description: normalizeText(v.description),
    category: normalizeText(v.category),
  }));
}
~~~

Apply SHA-256 to these bytes. The title/description pairs ("a||b","c") and ("a","b||c") must have different hashes; the old delimiter concatenation produced identical bytes, which is not a SHA-256 break.

Report encoding includes schema/org/UUID/version/title/evidence and deduplicated/sorted accused IDs. Assignment/ApprovalContext also fix key/array order. Specify whether ciphertext hash covers raw ciphertext bytes or UTF-8 serialization, with shared test vectors; each side must not choose independently.

Origin proof contains binding, authenticated author, and consent. G4 identifies issuer/signer/trust root/verifier. A name in JSON/content hash/ciphertext does not establish authorship. During blind review, do not publish proof/public keys linkable to employees; place identifying receipts/proofs in an appropriate protected layer and assess metadata too.

Test replacing label/content/ciphertext/whole records and replaying under another UUID/org. Detecting a mismatch does not recover correct data; verified receipts/originals and backups are required. Server timestamps are operational only; priority evidence against a DBA requires independent attestation/receipts, beyond hashes and timestamps in the same DB.

## 10. Conflicts of interest and council selection

### 10.1. Fix the council roster at initialization

Distinguish **council roster** (the base council membership for each version) from **voting assignment** (N members selected for a report/proposal). Do not construct a council from all employees for each report, automatically add the signed-in user, or draw voters from an unapproved target roster.

Bootstrap once, before the first record:

1. Both implementers agree specific members and verify stable subject ID, organization, active status, membershipRole, and independent status. The sole demo pool is Eva, Frank, Grace, Henry, Iris; Grace is independent.
2. Lock initial policy: minVoters=3, maxVoters=5, ratio 2/3, and independent requirement. The N range is a design default because requirements did not specify it; changing min/max within 3..5 requires a voted proposal, just like roster changes. The 2/3 ratio and independent requirement are fixed protocol v1 rules, with no direct editing option.
3. Create immutable CouncilSnapshot version=1, rosterHash, policyHash, bootstrap receipt, and policy-authenticated bootstrapCompleted marker. Roster requires at least three members and one independent; the prototype caps it at 12 to keep the sampling algorithm finite.
4. Obtain initial members' participation confirmation and store a nonsensitive manifest. Bootstrap is a disclosed initial governance decision, not a roster generated by cryptography.
5. After bootstrap, no direct add/remove/edit endpoint remains; seed never overwrites the roster and app/DB resets never reenable bootstrap. Policy rejects old versions/hashes as the current roster; backup restoration must reconcile against a trusted checkpoint.

The personnel directory does not confer council membership: new employees, renames, or department changes do not automatically create voters. Invalid/inactive subjects are excluded under CoI/eligibility, but council membership/role/independent changes still require a voted proposal.

### 10.2. Randomly draw the count, then the people

Client sends accusedPersonIds only. Server resolves a trusted/versioned directory, rejects unknown/cross-org IDs and management-graph cycles. CoI excludes accused people, known relevant management chains, and verified conflicts. Never use self-declared client departments or display names as keys.

Let E be the eligible members remaining in the current roster:

- Valid N ranges from minVoters=3 to min(maxVoters=5, |E|), with at least one independent selectable.
- Draw N uniformly among valid integers, then draw uniformly an N-member subset meeting the independent requirement. This is uniform by size and then among subsets of that size; it does not claim equal probability for every subset across all sizes.
- T = ceil(2 × N / 3), based on selected N, not votes cast or online members. N=3 → T=2; N=4 → T=3; N=5 → T=4.
- Only one size may be available: if E has three members, N=3. Never draw beyond the pool or lower minVoters to manufacture apparent randomness.
- Store N/T, voter IDs, exclusions, council/directory/policy version/hash, and selection proof with the request. Retries/idempotency never redraw; do not add/remove voters after votes exist.
- Fewer than three eligible members or no independent: AWAITING_ELIGIBLE_JURY; do not use people outside the roster or lower thresholds.

Illustrative Node function after CoI calculation; G3 must still verify roster/selection sources:

~~~typescript
import { randomInt } from "node:crypto";
type EligibleVoter = { id: string; independent: boolean };
type VoterPolicy = { minVoters: number; maxVoters: number };

export function selectVotingAssignment(
  eligible: EligibleVoter[],
  policy: VoterPolicy = { minVoters: 3, maxVoters: 5 },
  drawInt: (min: number, maxExclusive: number) => number = randomInt,
) {
  if (!Number.isInteger(policy.minVoters) || !Number.isInteger(policy.maxVoters)
      || policy.minVoters < 3 || policy.maxVoters < policy.minVoters
      || policy.maxVoters > 5) throw new Error("INVALID_VOTER_POLICY");
  if (eligible.length > 12) throw new Error("COUNCIL_SIZE_LIMIT_EXCEEDED");
  if (new Set(eligible.map(v => v.id)).size !== eligible.length) {
    throw new Error("INVALID_DIRECTORY");
  }
  const maxN = Math.min(policy.maxVoters, eligible.length);
  if (maxN < policy.minVoters || !eligible.some(v => v.independent)) {
    throw new Error("INSUFFICIENT_ELIGIBLE_JURORS");
  }
  const voterCount = drawInt(policy.minVoters, maxN + 1);
  const candidates: EligibleVoter[][] = [];
  function collect(from: number, selected: EligibleVoter[]) {
    if (selected.length === voterCount) {
      if (selected.some(v => v.independent)) candidates.push([...selected]);
      return;
    }
    const remaining = voterCount - selected.length;
    for (let i = from; i <= eligible.length - remaining; i++) {
      selected.push(eligible[i]);
      collect(i + 1, selected);
      selected.pop();
    }
  }
  collect(0, []);
  if (candidates.length === 0) throw new Error("INSUFFICIENT_ELIGIBLE_JURORS");
  return {
    voterCount,
    quorumRequired: Math.ceil(2 * voterCount / 3),
    voters: candidates[drawInt(0, candidates.length)],
  };
}
~~~

Inject deterministic drawInt only in unit tests; production uses node:crypto.randomInt. CSPRNG prevents modulo bias but does not prove the backend never redraws; G3 must verify assignment and prevent discarding unfavorable results. [Node randomInt](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback).

A demo accusing Eva/Binh derives eligibility from the real roster/directory and displays actual N/T and voters. Never promise Frank–Grace–Henry every time, since Iris may also be selected; fixed fixtures must be labeled simulated.

### 10.3. Council changes require voting like report approval

Every addition, removal, replacement, chair/independent change, membership activation/deactivation, or min/max change creates a CouncilChangeRequest. No “quick IT fix” exception exists; IAM/DB/seed/console must not be shortcuts. Protocol v1 fixes the 2/3 ratio and rejects proposals lowering it.

Use the **same VotingService, N/voter selection algorithm, T/independent checks, signed context, expiry, idempotency, DENY, and audit** as report approval; only operation/payload and the final action differ:

~~~text
Propose target roster/policy against CouncilSnapshot v
  -> filter CoI from currently effective roster v
  -> draw N + N voters, lock assignment and T
  -> COLLECTING -> READY after T valid APPROVE votes including an independent
  -> verify proof/policy -> APPLYING -> APPLIED
COLLECTING/READY -> DENIED / EXPIRED / STALE
Insufficient eligible members -> AWAITING_ELIGIBLE_JURY
~~~

1. Proposal contains immutable baseCouncilVersion/hash, complete target roster/policy, diff, reason, expiry, nonce, and payloadHash. Validate target roster: unique/verified/same-org subjects, at most 12 members, sufficient active members for minVoters, and an active independent; target policy 3 <= minVoters <= maxVoters <= 5. Context operation=CHANGE_COUNCIL, never mixed with REVEAL_REPORT_IDENTITY.
2. Draw voters from the **old, currently effective roster**, excluding members being added/removed/having permissions changed and anyone with CoI concerning the change. Unapproved new members cannot vote on their own appointment.
3. Insufficient eligible/independent members means waiting, never lowering N/T or adding people outside the roster. Replacing the sole independent may first require an approved proposal adding another independent, followed by a proposal removing the old member.
4. Every voter signs in separately and signs the exact proposal hash/base version/assignment/N/T/purpose/expiry; use the same ceil(2N/3), distinctness, and independent requirements as reports. One valid DENY terminates the proposal under shared rules.
5. Sufficient votes create READY only. Adapter verifies evidence, performs required IAM/QEA changes through outbox, then reconciles; the old roster remains effective until completion, with no early permissions.
6. Publish v+1 through compare-and-swap expectedVersion=v, retain version-v history, and record audit/proof. IAM projection is not the only membership source; API/Fabric also check the published version so prepared roles cannot grant permission early.
7. If another proposal publishes first, this proposal becomes STALE; never automatically rebase its target roster or reuse votes. Pending voting requests/reveal challenges on the old roster become STALE, preventing new grant/apply operations; a new assignment requires a recorded process, never silent redrawing.
8. Policy must check the version of existing authorization when used. If the Tide adapter cannot revoke/block old artifacts, disclose the limitation and lock change flows failing G3/G5. Never claim revocation of plaintext already seen.
9. BootstrapCompleted cannot be reset to evade voting. Duplicate proposals on the same payload/base version never redraw; cancellation/resubmission must not “hunt” for favorable voters without a reconciliation process.

This is council business governance. Realm-administration QEA is a separate technical layer and does not replace these votes.

## 11. Database, transactions, and migrations

### 11.1. Logical schema

B converts this table into a Prisma schema for the pinned version; this is not a complete copy-and-run schema.

| Entity | Fields/semantics | Constraints |
| --- | --- | --- |
| Idea | Org/UUID, canonical content/version/hash, envelope, consent, policy, state/version | Immutable after submission, no submitter FK |
| IdeaEndorsement | ideaId, endorserSubject, artifact | Actor from token; no author changes |
| IdeaDecision | decision/director/context/proof | Verify artifact; row is not sole authority source |
| PublishedCredit | ideaId, public name, artifact | Consent + G4 only; no equivalent reporter table |
| Report | Org/UUID, fake evidence/content hash, envelope, state/version | No createdBy/reporterId/revealedReporter plaintext |
| ReportAccused | reportId/personId | Unique(reportId, personId), same org |
| CouncilSnapshot | org/version, roster/policy hash, bootstrap receipt, publishedAt | Unique(org, version), immutable; trusted checkpoint for current version |
| CouncilMember | snapshotId/subject/role/independent/active | Unique(snapshotId, subject), no direct edits after publication |
| CouncilChangeRequest | UUID/org/base version/hash, target roster/policy/diff/hash/reason, votingRequestId, applyState/version | Immutable payload; duplicate active proposal with same payload/base never redraws |
| VotingRequest | operation/resource/binding, council version/hash, payloadHash, nonce/expiry/state/version | Shared by reports/council changes; votes never reused across operations |
| VotingAssignment | votingRequest/report, version, roster/directory/policy version/hash, voterCount/quorumRequired, hash/artifact | One selection per fixed round/resource, immutable N/T |
| VotingAssignmentMember | assignment/member/independent snapshot | Unique(assignmentId, memberSubject), matching drawn voterCount |
| VotingExclusion | person/reason/directory version | Verified reasons |
| UnmaskRequest | report/assignment/votingRequestId/context/ciphertext hash/recipient/purpose/expiry/state/version | Immutable context, shared VotingRequest, no separate vote counting |
| VoteApproval | votingRequestId/voterSubject/decision/reason/proof/hash/verifiedAt | Unique(votingRequestId, voterSubject), verified snapshot/N/T/context |
| RevealAuthorization | request/opaque artifact/context/expiry/state | No plaintext; DB cannot issue authority itself |
| IdempotencyRecord | org/scope/key/payload hash/response reference | Unique(org, scope, key), no JWT/submitter |
| OutboxOperation | request/type/context/state/attempts | Idempotent retries and external-call reconciliation |
| AuditEvent | action/resource/request/source/result/time, selectively recorded actor | Redacted; not assumed tamper-evident against a DBA |

Reporter plaintext stays in client memory and is cleared on close/logout; no localStorage/analytics/SSR/cache. API selects fields and never returns complete envelope/proof-bearing objects in lists.

### 11.2. Transactions

- Create report + accused people + roster snapshot reference + N/T/assignment selection or waiting state + idempotency in one transaction. Council proposal + VotingRequest + selection is also atomic.
- Verify proof before persistence; at commit recheck state/version/expiry/membership snapshot, perform unique insert, and compute progress. Row counts never replace proof.
- Approvals are not edited in place; DENY terminates a request; reconsideration needs a new request.
- Optimistic versions prevent reviving EXPIRED/DENIED; external grants use outbox, never hold DB transactions across network calls.
- On timeout, reconcile request IDs before retries to avoid duplicate grants/roster apply. Publish council using expectedVersion; only one concurrent proposal can publish and the other becomes STALE. No long DB transaction while waiting on QEA/network.
- SQLite prototype runs one app instance; never share an actively written file over the network.

### 11.3. Single migration writer

Only B creates schema/migrations; A requests fields through contract changes, never db push or DB commits.

B's machine with Prisma 6.19.0:

~~~powershell
npm run db:migrate:dev -- --name add_unmask_requests
npm run db:validate
npm run db:generate
git diff -- prisma/schema.prisma prisma/migrations
~~~

Integration checkout on Tung's machine after merge; your machine does not run these two commands:

~~~powershell
npm run db:migrate:deploy
npm run db:generate
~~~

Never edit applied migrations; reconcile through forward migrations. For drift/reset prompts, verify DB/version/checksum instead of resetting merely to pass. New CLI majors may differ; do not apply latest-version guidance blindly to Prisma 6.

## 12. Parallel development and detailed Git merges

Individual commands/checklists: [you](./architecture_toi.md#7-git-and-handoff-to-tung), [Tung](./architecture_tung.md#8-git-and-merge).

### 12.1. Environment-appropriate milestones

| Milestone | You, without toolchain | Tung, with toolchain | Condition |
| --- | --- | --- | --- |
| M0 | Agree UI/runtime contract, open mock file | Bootstrap/fixtures, shell, contract, platform baseline | Working file://, same SHA |
| M1 | Mock layout/forms/lists | Next static hosting/API skeleton/LIVE bridge | No React UI conversion at merge |
| M2 | Review idea/vote/council views and states | Real SDK/crypto/proof/API/DB, G1–G4 | Matching runtime interface, shared security preserved |
| M3 | Responsive/error/loading/empty, manual N/T cases | Council/random N/shared voting/QEA, G3/G5 | READY differs from APPLIED; no early grant |
| M4 | UI handoff and LIVE review via URL/screen share if available | Merge, browser file/local/LIVE, migration/fresh checkout | One UI with two runtimes; mock never hides errors |
| M5 | Demo/storytelling/UX review | Tests/gates/SHA/runbook and accurate README | Mock is never claimed as live evidence |

Tung owns more toolchain work; you cover all screens, states, mock, manual QA, and demo content so he can focus on platform/policy. UI work does not wait for the complete real system.

### 12.2. Branches and ownership

The base branch is currently master, remote origin. Tung creates integration/voicevault and one baseline from a clean working tree. You create work/ui-static and Tung creates work/server-policy from the same SHA.

Stage only public/ui and your handoff. Tung owns public/integration, dependencies/lockfiles/contracts/migrations/build/tests. If Git is unavailable, send a public/ui ZIP preserving relative paths + baseline SHA; Tung imports into a separate branch and reviews the diff, never overwriting the repository.

After baseline, do not run npm ci/db generate/migrations even if the repository contains package.json. Tung runs all dependency/build/test work in his checkout.

### 12.3. Merge small slices on Tung's machine

1. Both commit/push individual branches and hand over files/contract version/SHA/prerequisites. You report manual browser results; Tung reports automated/LIVE separately.
2. Tung fetches, switches to integration/voicevault, pulls --ff-only, and verifies a clean working tree.
3. Merge the incoming branch with --no-ff --no-commit; merge contract/runtime before consumers for breaking changes.
4. Review conflicts with the correct owner; never Accept All for contracts/lockfiles/migrations or silently change UI.
5. Tung runs npm ci, fixtures/bridge build, validate/migrate/generate, check, test:ui:file, and integration on the merged tree.
6. Set up app/realm/test DB, then run test:ui:live, live security, and milestone-appropriate E2E.
7. Commit merge/push integration only after passing, then send SHA/results. For Already up to date, verify handoff instead of creating an empty commit.
8. You fetch/merge integration into work/ui-static and reopen index.html; no npm/DB step.

### 12.4. Conflicts and rollback

- You resolve public/ui conflicts; Tung resolves runtime/API/server. Agree contract semantics together before changes.
- Tung deliberately reconciles dependencies/lockfiles, using npm install when lock generation is needed, then verifies npm ci with the pinned npm version.
- Tung is Prisma's single writer; never edit applied migrations or reset DB merely to pass. Create forward migrations and check drift/checksums.
- git merge --abort discards only an uncommitted merge, not DB/realm changes. Preserve unique repairs before aborting.
- For a broken pushed merge, revert the verified merge commit on shared history instead of reset/force-push; roll back DB/policy/grants separately.
- Open PR integration -> master only after M5 passes; the teammate reviews UX/contracts/gates. Two separately working branches are insufficient evidence of the combined system.

Copy/paste commands for Tung's machine are in architecture_tung.md; your machine uses only Git/browser as in architecture_toi.md.

## 13. Running the system after merge

Tung runs this entire section. Your machine only opens mock HTML or an existing test URL; no second instance is needed.

1. Compare integration SHA/contract and toolchain/image/policy manifest on Tung's machine.
2. Tung sets up realm/client/callback/roster, .env, and a separate DB; never copy tokens to switch personas.
3. Run npm ci, build:fixtures, build:bridge, DB validate/migrate/generate/seed, and check. Agree unexpected fixture/build diffs with your teammate.
4. Start Next and open /ui/index.html over HTTP(S); file:// cannot demonstrate LIVE. Root host may redirect; do not duplicate the static route.
5. Check relative assets, bootstrap mode, contract version, SDK assets/callback/CSP, and same-origin API.
6. test:ui:file opens file:// without server/SDK; test:ui:live uses real APIs through Next. Unit/integration/live/E2E run against test DB/realm according to prerequisites.
7. Create new records, refresh/restart and read again, attempt direct bypass, and inspect DB/log/storage; fake seeded proofs never replace testing.
8. Tung sends SHA, results, and video/screen share or an existing test URL for UX review. His localhost is not automatically accessible from your machine.

Seed never overwrites a bootstrapped roster or creates fake approvals/grants. N/T/roster and policy still follow section 10. Runtime/build errors report unavailable and never switch LIVE to mock.

### 13.1. Integration triage

| Failure | Check first | Owner |
| --- | --- | --- |
| Blank file:// or local-script failure | Relative paths, classic defer, no JSON fetch/ES modules | You + Tung's bootstrap |
| Missing fixture/bootstrap | Baseline handoff omitted tracked files | Tung |
| UI field/state mismatch | Runtime/fixture contract version, ApiResult | Agree together; owner fixes |
| LIVE bundle missing/404 | Bridge build before Next build, static path | Tung |
| Token/SSO/login loop | Issuer/client/algorithm/callback/origin/port | Tung |
| An can encrypt but Chi cannot reveal | G1/sharing/key/recipient; no broad-role workaround | Tung |
| Still locked after T | Proof/context/N/T/independent/roster version/expiry/outbox | Tung |
| Council changes before vote/apply | Stop demo; inspect IAM/DB/seed/bootstrap/version | Tung |
| DB drift/lock | Correct checkout/process/DB/migration/checksum | Tung |
| UI claims Fabric denial without a real request | Mock/provenance and runtime adapter | You + Tung |

## 14. Privacy and audit

Never log Authorization/cookies/bodies, pre/post-crypto payloads, email/employee IDs, or proofs identifying submitters. Inspect SDK errors/proxy/tracing/error tracker/browser console. User/IP rate limiting creates identity links: disclose retention/scope. Never add submittedBy for debugging while still promising anonymity.

Content/style/timing/file metadata may reveal authors. MVP accepts no real attachments; uploads require separate metadata/ACL handling. Omitting sub in DB does not defend against a backend actively recording JWTs/requests; anonymous-credential design is outside MVP.

| Result | Correct label |
| --- | --- |
| API blocks edit | APP / FORBIDDEN |
| Browser detects mismatch | CLIENT / INTEGRITY_MISMATCH; unverified telemetry if client-reported only |
| Real policy denial | FABRIC / POLICY_DENIED + reconciled request ID |
| QEA not yet applied | QEA / PENDING |
| Mock | SIMULATED, never live evidence |

A browser cannot write “Fabric blocked it” and make it trusted server evidence. An endpoint merely recording blocked does not demonstrate a real operation.

A hash chain in the same DB does not prevent rewriting the entire chain. Tamper evidence against a DBA requires independently checked checkpoints/signatures and tests; a backend-held HMAC does not defend against that backend. Detecting tampering does not establish recoverability.

Remove “absolutely secure”, “mathematically safe”, “locked forever”, and “recover the author” from README/UI unless supported by appropriate evidence; distinguish confidentiality/integrity/availability/recovery.

## 15. Prompts and handoff templates

Full prompts are separated to avoid assigning the wrong environment:

- [Prompt for your machine](./architecture_toi.md#9-prompt-for-the-coding-agent-on-my-machine): classic HTML/CSS/JS and mock UI only; no Node/Next/Docker requirement.
- [Prompt for Tung's machine](./architecture_tung.md#10-prompt-for-the-coding-agent-on-tungs-machine): platform, browser LIVE runtime, SDK/policy, build/test/merge; preserve static UI.

Shared handoff:

~~~text
Milestone / baseline SHA / commit SHA or ZIP:
Runtime contract version:
Changed files/endpoints/methods and owners:
Fixture/bootstrap/dependency/migration changes:
Your machine: browser/manual MOCK result, screenshots, steps:
Tung's machine: commands actually run + results, G1–G5 PASS/FAIL/NOT RUN:
Prerequisites / test URL or screen share:
Remaining limitations/failures / files to hand over:
~~~

Manual mock results are not live proof. Recipients need the exact SHA, runtime mode, and safe configuration to reproduce results without guessing console settings.

## 16. Tests, demo, and completion criteria

| Case | Required result | Evidence |
| --- | --- | --- |
| Forged/expired/wrong issuer/client token | 401, no new record | API |
| Correct role/different org | No cross-org reads/writes | API |
| SDK round trip/cross-user | Correct types; different recipient reveals through correct mechanism | G1 live |
| Director directly opens UNDER_REVIEW/REJECTED | Cryptographic service denies, beyond UI blocking | G2 live |
| Changed label/self-declared name | No verified credit | G4 |
| Swapped content/ciphertext/UUID/org | Mismatch/policy denial | G2/G4 |
| Delimiter/Unicode/newline/order | Matching canonical client/server; old ambiguous pairs produce different bytes | Contract vectors |
| Multiple accused/management conflict | Correct exclusions for directory version | Unit/API |
| 0/1/2 eligible/no independent | Wait; never lower minVoters or locked N/T | Unit/API |
| Draw N with 3/4/5 eligible | N within configured range; T=2/3/4 for N=3/4/5 | Unit with test drawInt |
| Repeat roster bootstrap/seed | No overwrite/rebootstrap/automatic employee addition | API/policy G5 |
| Council additions/removals/role changes | Proposal + vote only; current roster unchanged while pending/READY | API + G3/G5 |
| New member votes on own appointment | Denied; only eligible old-roster members vote | G3 live |
| Two council proposals with same base version | One APPLIED, other STALE; no vote rebase | Transaction/policy |
| Roster/direct IAM/DB/console change without proof | No valid version/permission publication | Adversarial G5 |
| Retry create/proposal | One resource/assignment, same N/T/voters; new keys/UUIDs cannot redraw | Transaction/policy |
| Juror approves twice | Count one distinct voter only | Unique + proof |
| T approvals without independent | No grant/council apply | G3 |
| Outside jury/CoI | Cannot approve/reveal, including direct calls | API + G3 |
| T valid APPROVE votes | Correct operation/context: recipient reveals or proposal applies; no cross-use | G3 live |
| Votes for A used for B/another recipient | Denied | G3 live |
| Expiry/policy/assignment change | Old proofs/grants no longer apply | G3 live |
| Edited status/vote/assignment rows | Cannot create valid cryptographic authorization | Adversarial G2/G3 |
| Concurrent approvals/adapter timeout | No duplicate grant or terminal-state revival | Integration |
| IT self-grants role | Real QEA request remains unapplied below threshold | G5 live |
| Logout/reload/DB/log/storage | No reporter plaintext/token outside allowed scope | Privacy |
| Fresh checkout/empty DB | Install/migrate/generate/seed/build according to runbook | Reproducibility |
| Local machine without toolchain | Open file:// index.html, working fixtures/classic assets, no API/SDK | test:ui:file + manual |
| After merge | Same static UI through Next, real LIVE runtime/API at same commit, no fallback | test:ui:live + E2E |

Mock/unit tests never replace live tests; missing configuration or unrun cases are NOT RUN, and skips are not PASS.

### 16.1. Two-minute demo

1. An submits an idea and reviewers cannot see the name; a real premature reveal request is denied at the correct layer.
2. Reveal/verify credit only after APPROVED + consent and a passing G4; REJECTED never publishes identity.
3. Show the roster fixed at initialization; submit a report, draw actual N/voters, and display T. Label fixtures clearly.
4. CEO/excluded people are blocked; remain locked below T; reveal only with sufficient valid votes including an independent. N=4 requires three votes, never a default two.
5. Propose a council change: old roster stays effective while pending; only enough votes and apply publish a new version. Demo real QEA if time allows; label audit sources correctly.

If time is short, choose the strongest proven flow and disclose the rest; never build an endpoint that only records blocked. Check video/submission rules against Hackathon.md and official sources at submission time.

### 16.2. Definition of Done

- [ ] Tung pins dependencies/config; both use the same SHA/runtime contract; your machine opens mock files and Tung's runs LIVE.
- [ ] DTO/schema/fixture/runtime/UI match; one static UI supports MOCK/LIVE without React rewrite; Tung is migration single writer.
- [ ] Roster fixed once at initialization, no bootstrap/seed overwrite; random N/voters and immutable T per round.
- [ ] Council changes use the same VotingService as reports; new version is APPLIED only after proof, with STALE/old-vote handling.
- [ ] Auth/create/persist/reload/state/transactions run for real.
- [ ] G1–G5 have separate results; unmet parts are locked or clearly disclosed.
- [ ] Mock disabled for LIVE; denial sources correctly labeled APP/FABRIC/QEA/client.
- [ ] No persisted/logged reporter plaintext/tokens; anonymity limits disclosed.
- [ ] Bypass/E2E/fresh-checkout checks pass for submission scope.
- [ ] README/Idea.MD match implementation, with no unproven absolute/permanent promises.
- [ ] Handoff, demo SHA, runbook/video meet confirmed requirements.

## 17. Technical sources

Check against the pinned M0 versions; illustrative interfaces are not assumed to be existing Tide APIs.

- [TideCloak Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart).
- [Next SDK](https://docs.tide.org/Languages/NextJS/tidecloak-nextjs-reference).
- [JS SDK](https://docs.tide.org/Languages/JavaScript/tidecloak-js-reference).
- [Verify JWT](https://docs.tide.org/Languages/NextJS/VerifyJWT).
- [QEA](https://docs.tide.org/Core-Concepts/iga-workflow).
- [Forseti](https://docs.tide.org/Core-Concepts/forseti-engine).
- [Hermetic E2EE](https://docs.tide.org/Core-Concepts/hermetic-e2ee).
- [Prisma 6.19.0 release](https://github.com/prisma/orm/releases/tag/6.19.0) — selected SQLite/CLI version here, not a claim of latest version.
- [Node randomInt](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback).
- [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).
- [Git merge](https://git-scm.com/docs/git-merge).
- [Next.js public folder](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder) — serves static UI within the same application.
- [esbuild browser bundling](https://esbuild.github.io/api/#bundle) — Tung builds the bridge; the UI machine need not install a bundler.
