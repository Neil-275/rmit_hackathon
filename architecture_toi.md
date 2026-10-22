# Architecture — My role: UI without Next.js or Docker

> Your deliverable: a plain HTML/CSS/JavaScript interface that opens directly in a browser.
> Your machine does not need Node.js, npm, Next.js, Docker, a database, or the TideCloak SDK.
> Tung has confirmed that Next.js and Docker work on his machine; Tung owns the entire production build/runtime.
> This is an implementation guide. The current application uses MOCK only; LIVE and G1–G5 have not been run.

Read this together with [Tung's architecture](./architecture_tung.md) and the [shared business/security design](./voicevault_technical_architecture.md). This document defines the workflow on your machine; the npm/Docker commands for Tung do not apply to it.

## 1. What do you and Tung each do?

| You | Tung |
| --- | --- |
| HTML, CSS, JavaScript interface | Next.js server, API, DB, Docker |
| Idea and report forms | Auth, TideCloak SDK, and browser crypto |
| Display council, N/T, voter list, and progress | Bootstrap roster, randomly select N and N voters, verify votes, change roster |
| Mock behavior to exercise screens | LIVE runtime with the same interface, proof, policy, QEA |
| Error/loading/empty states, responsive design | Build, migration, unit/integration/live/E2E tests |
| Acceptance scenarios, error screenshots, demo content | Merge, run the real application, provide verification results |

Build an interactive UI that can be reused directly in the final application. You do not need to write React/TSX or hand over screenshots for Tung to rebuild.

## 2. Files you own

~~~text
public/
├── ui/                             entirely owned by you
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── mock-runtime.js
│   ├── views/                      plain JS; split only as needed
│   └── assets/                     local images/icons/fonts, no real data
└── integration/                    owned by Tung; do not edit
    ├── bootstrap.js                 runs locally and in LIVE
    ├── contract-fixtures.js         fake fixtures + contract version
    └── runtime.generated.js         built by Tung; local mock does not need it
~~~

Tung supplies minimal bootstrap and fixtures first so you can open index.html. If they are missing, record the pending handoff; do not substitute an npm installation on your machine.

Technical rules:

- Plain HTML/CSS/JS; no React, JSX/TSX, Tailwind requiring a build, npm imports, or libraries that require a bundler.
- Use plain CSS and local assets/fonts; offline preview must not depend on a CDN.
- Use deferred classic scripts and the window.VoiceVaultUI namespace; no ES modules/imports on file://.
- Do not fetch JSON fixtures on file://. Tung provides JavaScript fixtures assigning window.VoiceVaultFixtures.
- Use relative asset/script paths that work on both file:// and /ui/index.html.
- Render user input using textContent or safe DOM APIs; never use innerHTML with user content.
- Mock stores fake data in memory only; reload resets it. Do not put identities in localStorage.

## 3. Open the UI without installing anything

1. Receive a baseline/ZIP containing public/ui and public/integration/bootstrap.js + contract-fixtures.js.
2. Open public/ui/index.html in a browser. If local policy blocks local scripts, send the Console error to Tung so he can prepare a self-contained HTML mock.
3. Check the banner: “Simulated data — not connected to TideCloak”.
4. Edit HTML/CSS/JS, save, and refresh the browser.
5. Use DevTools Console to find UI errors, but never enter real tokens or employee data for testing.

No local server, Python, npm install, npm run dev, or Docker is required. Do not sign in to real TideCloak from file://.

Agree on this script load structure with Tung:

~~~html
<link rel="stylesheet" href="./styles.css">
<script defer src="../integration/contract-fixtures.js"></script>
<script defer src="./mock-runtime.js"></script>
<script defer src="./app.js"></script>
<script defer src="../integration/bootstrap.js"></script>
~~~

app.js defines VoiceVaultUI.mount(runtime); it must not run before bootstrap. Report runtime/contract mismatches instead of silently converting a LIVE failure into mock mode.

## 4. Connect the UI to the real system

Call only the VoiceVaultRuntime v1 interface in section 5.4 of the shared document. There are two implementations:

- MOCK: you implement mock-runtime.js using Tung's fixtures, without real crypto/API calls.
- LIVE: Tung implements and builds it; it handles login, tokens, canonical hashes, proofs, browser encryption, API calls, and validation.

Example submission flow:

~~~text
You: form -> runtime.submitReport(formInput) -> render ApiResult
Tung: LIVE runtime -> authenticate session -> encrypt in browser -> POST API
~~~

Do not create reporterCiphertext, verify tokens, or sign approvals in the UI. Tung must not route plaintext identity through the server as a replacement for browser crypto.

The UI does not fetch endpoints directly or read tokens. For a new action, propose its name/input/output so Tung can update the contract first.

## 5. Screens and deliverables

| Screen | Your deliverable |
| --- | --- |
| Overview | Navigation/tabs, active persona, MOCK/LIVE banner, loading/error |
| Ideas | List/detail, submission form, public-credit consent, capability-based endorsement/decision actions |
| Reports | Multiple accused IDs, permission-scoped list/detail, waiting-for-jury state |
| Voting | N, T, voter list, independent badge, valid votes, expiry; one shared VotePanel |
| Council | Current roster/version, proposal/roster diff, create-proposal action, pending/applying/applied |
| Audit | Distinguish APP/FABRIC/QEA/CLIENT/SIMULATED; no sensitive content |

Mock these states: loading, empty, validation error, 401, 403, quorum pending, insufficient eligible members, stale version, expired, integrity mismatch, POLICY_UNAVAILABLE, and success. Cover more than the happy path.

Fake scenarios to exercise:

- N=3, T=2; N=4, T=3; N=5, T=4.
- Members outside the voter list have no vote button.
- READY does not mean that the new council is APPLIED.
- The old roster remains effective until the proposal is APPLIED.
- New members cannot vote on their own appointment.
- Replacing the only independent member may require approving another independent member first if eligibility would otherwise be insufficient.

Display runtime-provided N/T. Do not hard-code two votes as sufficient or redraw the assignment on refresh. Capabilities guide presentation; the API/policy enforces actual permissions.

## 6. Work order without waiting for Tung

| Milestone | Your work | Required handoff from Tung |
| --- | --- | --- |
| U0 | Layout, tabs, basic cards/forms | Runtime interface + fixtures + file:// bootstrap |
| U1 | Idea/report forms, mock-runtime matching the interface | Agreed success/error fixtures and view models |
| U2 | VotePanel/council proposal, N/T/state UX | Fixtures for sizes, stale/apply/error states |
| U3 | Responsive design/accessibility, error/empty/loading, demo scenarios | Capability notes and official enums |
| U4 | UI handoff, browser review of LIVE if a URL exists | Tung merges/builds and sends test results/URL or screen share |

U0–U3 do not need a finished API. When Tung changes a view/contract, receive the new fixtures and update the consumer; do not guess types.

## 7. Git and handoff to Tung

Your branch: work/ui-static, based on the agreed integration/voicevault SHA. Use Git only if available; there is no npm/DB step.

~~~powershell
git fetch origin
git switch -c work/ui-static --track origin/integration/voicevault
git push -u origin work/ui-static
~~~

If the branch already exists, switch to it instead of rerunning switch -c. Save/commit unfinished work and ensure a clean working tree before switching branches.

For each milestone:

1. Open index.html, exercise screens, and check Console.
2. Run git status --short; review the diff and stage only public/ui and your handoff.
3. Commit/push work/ui-static; send the SHA, file list, and browser results.
4. Do not merge master/integration yourself or edit public/integration or package/lockfiles.
5. After Tung successfully merges, receive integration on your branch:

~~~powershell
git fetch origin
git merge origin/integration/voicevault
~~~

Reopen index.html to verify. Do not run npm ci or migrations even if package.json has been added.

If Git is unavailable, send a ZIP containing public/ui + handoff, excluding .git/env/database. Preserve relative paths and record the baseline SHA; Tung imports it into a separate branch, reviews the diff, then merges. Never overwrite the whole repository.

## 8. Acceptance checklist on your machine

- [ ] index.html opens on file:// without installing dependencies.
- [ ] CSS/assets/classic scripts load without network/CDN access.
- [ ] No JSON fetch or ES module breaks local preview.
- [ ] Initial mode says MOCK; LIVE errors never become fake successes.
- [ ] Forms support validation, submit/loading/error/retry states.
- [ ] UI uses runtime N/T and roster version, covering 3/4/5 voters.
- [ ] Pending/READY/APPLYING/APPLIED/STALE are visually distinct.
- [ ] No token, plaintext reporter identity, or real data is stored/logged.
- [ ] Responsive layout, keyboard, focus, labels, and safe rendering prevent HTML injection from user content.
- [ ] Handoff includes SHA/baseline, error screenshots/steps, and browser results.

Mock UI tests do not prove real auth, crypto, quorum, or policy enforcement. Record these as “not verified on my machine”; Tung performs LIVE verification.

## 9. Prompt for the coding agent on my machine

~~~text
Read architecture_toi.md and the runtime contract in shared-document section 5.4.
This machine cannot run Node.js/npm/Next.js/Docker; do not ask to install them.
Create/edit only public/ui using classic HTML/CSS/JavaScript and local assets.
Opening index.html directly in a browser must display the mock UI.

Define window.VoiceVaultUI.mount(runtime) and a v1-compatible mock runtime.
Use Tung's JS fixtures; no JSON fetch, ES module imports, npm, or CDN.
Do not write React/TSX, backend, SDK crypto, API fetches, or token readers.
Call high-level runtime methods and render ApiResult and capabilities.
Display runtime-provided random N/T, council version, and proposal state.
Label mock data; never fake Fabric proof/deny or fall back after LIVE errors.
Do not hard-code two votes as sufficient or allow direct roster edits.

Complete the assigned milestone; check browser/Console when tools exist.
Do not claim browser tests ran unless they actually ran. Hand over files/SHA/steps.
~~~

## 10. Handoff template

~~~text
Milestone / baseline SHA / commit SHA or ZIP:
Runtime contract version:
Files changed (public/ui only):
Screens/states completed:
How to open index.html:
Browsers tested / viewport sizes:
Manual mock results / error screenshots / steps:
Methods or fixtures Tung needs to add:
Items not verified in LIVE:
~~~
