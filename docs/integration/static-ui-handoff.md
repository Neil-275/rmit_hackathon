# Static UI handoff for Tung

Architecture documentation baseline: `8725f1a`; existing UI baseline: `4eb5305`.
The English/color revision is currently in the working tree without a new commit/merge/push.
An earlier attempt to create `work/ui-static` was blocked by this environment's Git-ref permissions.
Implemented scope: the UI portion of `architecture_toi.md` and the MOCK v1 runtime.
Backend, database, IAM and TideCloak LIVE from `architecture_tung.md` are not implemented in this deliverable.

## Ownership and merge order

| Path | Owner | Notes |
| --- | --- | --- |
| `public/ui/` | You | HTML, CSS, views, mock runtime and tests |
| `public/integration/bootstrap.js` | Tung | Minimal baseline created to open the UI; review before importing |
| `public/integration/contract-fixtures.js` | Tung | Shared synthetic fixtures; retain globals and contractVersion |
| `public/integration/runtime.generated.js` | Tung | Not yet present; LIVE bundle as a classic script/IIFE |
| Contract/API/schema/dependency/migration | Tung | The UI does not change these areas |

1. Tung creates/checks the `integration/voicevault` baseline against the shared architecture and records its SHA.
2. When Git becomes writable, put this deliverable's files on `work/ui-static`. Stage only relevant files;
   do not stage `taste-skill-main.zip`, downloaded skill directories, logs or browser profiles.
   Do not switch branches while changes remain unpreserved. Do not reset or overwrite the entire repository.
3. Tung compares the two integration files in the table with his baseline. If he has his own versions,
   merge selectively; preserve the script order and file/HTTP rules below.
4. Fetch both branches and create a temporary integration branch from `integration/voicevault`. Merge `work/server-policy`
   followed by `work/ui-static` using `--no-ff --no-commit`; review, resolve conflicts and test the merged tree
   before creating the merge commit. Even without conflicts, Git stops before the commit for review.
5. Run local tests and Tung's LIVE tests. Record the UI SHA, server SHA and G1–G5 results in the handoff.
   Update integration only after the required checks pass.
6. Your machine receives the integrated version and opens `public/ui/index.html`; npm and migrations are unnecessary.

If using ZIP: send only `public/ui/`, handoff documentation and the two integration files for Tung to **review separately**.
Preserve relative paths; exclude `.git`, `.env`, databases and credentials.
Tung imports the ZIP on an import branch from the recorded baseline SHA, inspects the diff and then merges.

## LIVE bootstrap

`index.html` uses classic `defer` scripts in this order: fixtures → mock → helpers → dialogs → pages → app → bootstrap.
There are no ES module imports, CDNs or JSON fetches when opening the file.

- `file://`: factory `window.createVoiceVaultMock(window.VoiceVaultFixtures)`.
- HTTP(S): bootstrap loads `../integration/runtime.generated.js` and calls
  `await window.createVoiceVaultLiveRuntime()`. The factory must return `{mode:'LIVE', contractVersion:'v1', ...methods}`.
- Every mount calls `init()`; `init.data` is SessionView. Missing/incompatible LIVE bundles or missing policy
  must produce errors. Never attach a MOCK runtime under a LIVE label.
- The LIVE factory is a browser adapter only. Do not embed server secrets, refresh tokens or private keys in the bundle.

## Data shapes consumed by the UI

Every method returns `Promise<ApiResult<T>>`:

```js
{ ok: true, data, requestId, contractVersion: 'v1' }
{ ok: false, error: { code, message, enforcement, retryable }, requestId, contractVersion: 'v1' }
```

This is the static UI handoff shape and must be compared/agreed with Tung's LIVE schema;
it does not claim that a LIVE adapter or API has been tested.

| View | Required UI fields |
| --- | --- |
| Session | `authenticated, subject, displayName, role, capabilities.canSubmit` |
| Page | `items, nextCursor`; the UI currently fetches at most 50 records, without LIVE pagination |
| Idea | `id,title,description,category,status,version,createdAt,publicCredit,capabilities` |
| Idea capabilities | `canEndorse,canDecide,canReveal`; publicCredit appears only when permitted |
| Report | `id,title,evidenceDetails,accusedPersonIds,createdAt,status,version,voters,voterCount,quorumRequired,votingRequestId,voting,capabilities.canRequestUnmask` |
| VotingRequest | `id,resourceId,operation,voters,voterCount,quorumRequired,councilVersion,status,approvalCount,validApprovals,independentApproved,expiresAt,recipientSubject,canVote,canReveal` |
| Voter / Vote | Voter: `id,displayName,independent`; Vote: `voterId,decision,reason` |
| Council | `version,selectionPolicy,members,capabilities.canPropose`; member: `subject,displayName,title,active,independent,membershipRole` |
| CouncilChange | `id,reason,baseCouncilVersion,status,proposedMembers,proposedSelectionPolicy,voting,capabilities.canApply` |
| Directory | `people:[{id,displayName,title,department}]` |
| Audit | Page; event: `action,actor,targetId,enforcement,createdAt`; no identity/contact/token |
| Reveal | `displayName,contact?`; MOCK adds `simulated:true`. Pass only to the dialog; do not retain in page state |

The method list in architecture §5.4 is unchanged. Current mutation inputs:

```js
submitIdea({ title, description, category, publishCreditOnApproval })
endorseIdea(ideaId, expectedVersion)
decideIdea(ideaId, { decision, reason, expectedVersion })
submitReport({ title, evidenceDetails, accusedPersonIds, contact, consent, clientRequestId? })
createUnmaskRequest(reportId, { recipientSubject, purpose })
getVotingRequest(votingRequestId)
castVote(votingRequestId, { decision, reason })
submitCouncilChange({ expectedCouncilVersion, reason, proposedMembers, proposedSelectionPolicy })
applyCouncilChange(changeId, baseCouncilVersion)
revealIdentity(kind, resourceId, votingRequestId?) // kind = IDEA | REPORT
```

`createUnmaskRequest` returns `{id,votingRequestId,voting}`. A new report has an assignment but `voting:null`;
an assigned juror opens its details and creates the request. `listReports`/`listCouncilChanges` return nested
voting summaries for rendering. The UI does not poll; the adapter should return current state on refresh,
or add subscriptions later. Three seeded reports already have requests to demonstrate N=3/4/5 immediately.

Capabilities support UI presentation only; the server and Tide mechanisms must independently verify every operation.
MOCK creates no real cryptographic proof, binding hash or authorization.
DENIED/EXPIRED requests cannot automatically reopen in the current UI; do not change N/voters to obtain a favorable outcome.
The flow for creating a new request after a completed round, and pagination, need further agreement during LIVE integration.

## Verification evidence

- `& ./public/ui/tests/run.ps1 -Suite all`: runtime and browser suite; final results are recorded in the plan.
- Tests execute the mock implementation, real DOM through Chrome, and HTTP startup with the LIVE bundle absent.
- Regression coverage includes N=4/5, duplicate/unassigned votes, missing independent approval, consent, multiple-accused CoI,
  assignment preservation on retry/request creation, READY/APPLIED/STALE/expiry, XSS and late reveal after logout/navigation/persona changes.
- Independent review found three important bugs; each was reproduced with a failing test, fixed and retested:
  identity race, submitter leakage in audit, and council application after expiry.
- Headless Chrome tests need `--no-sandbox` in a temporary profile on this machine; normal HTML opening does not need that flag.
- VS Code's embedded Node may print a Crashpad `Access is denied` warning; test results and exit code are collected separately.

**G1, G2, G3, G4, G5: NOT RUN.** No LIVE adapter/TideCloak/backend is available to verify them.
MOCK results or visual inspection cannot establish that these gates have passed.

## English / Swiss Cobalt revision

Existing UI baseline: `4eb5305277d754742e8f2aa33d188a037ee6e76d` (`UI`), after architecture commit `8725f1a`.
The English and color changes are in the working tree and have not been committed by this agent.
The interface, validation messages, fixtures, source comments, tests and project documentation now use English.
Keep API names, subject IDs and contract v1 unchanged when integrating; the displayed demo names are transliterated.
Native field validation uses explicit English messages, independent of browser locale.

The refreshed palette is described in [the design notes](../design/voicevault-taste.md).
The earlier English/color suite had 28 tests (15 runtime and 13 browser). LIVE/backend/TideCloak and G1–G5 remain NOT RUN.

## Capability and LIVE presentation polish

The overview's personal voting count is derived from `voting.status === 'COLLECTING' && voting.canVote === true`.
Visible report/council activity is presented separately. Adapters must return `canVote` for the authenticated
SessionView, including duplicate-vote, expiry and council-version restrictions; UI labels do not confer authority.

The simulation-controls container is explicitly hidden in LIVE even if an adapter accidentally exposes a
`simulation` property. Session identity comes from SessionView, and the banner changes from checking the
session to green **LIVE — Runtime connected**, or **Sign in required** after sign-out. This reports adapter/session
availability, not Fabric proof or G1–G5 completion. No new connection-status fields were added to contract v1.

The LIVE presentation test uses an isolated adapter stub; it does not establish a real TideCloak connection.
After this polish, the full local suite passes **31/31** tests (15 runtime, 16 browser).
