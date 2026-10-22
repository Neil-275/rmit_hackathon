# Codex -> Claude handoff — 2026-10-22

User explicitly paused development for quota handoff. Do not interpret this as completion.
Continue on work/full-stack-fixes, preserve the WIP, and keep a done / in-progress / next / not-done ledger.
Commit and push each finished unit with its Markdown status, as the user requested.

## Correct checkout — important

- Full-stack: /Users/tam/.codex/worktrees/bd01/RMIT_HACKATHON
- Branch: work/full-stack-fixes (origin/work/full-stack-fixes)
- UI-only: /Users/tam/Code/RMIT_HACKATHON-master, branch work/ui-static.
- Original task cwd: /Users/tam/Downloads/Code/RMIT_HACKATHON, branch main.
  That checkout contains unrelated notebooks/Kaggle files. Do NOT do the app work there.
- Latest master baseline: b8a835d, fetched at session start. Master was NOT changed.
- Check git status before editing and fetch remote before merging anything.
- User explicitly authorized backend work as well as UI, overriding the older UI-only division.
  Preserve Tung's branches; use this separate full-stack branch.

## Commits already pushed

- UI 279d53c: finish error states, protect persona data, council/mobile fixes; 57/57 UI tests passed.
- Full-stack b778f73: claimed work and initial full-stack-status.md.
- Full-stack 3a62610: API 401 no longer becomes a stale authenticated session; bridge exports
  createVoiceVaultLiveRuntime, wraps API in the UI mapper and requires explicit auth/crypto adapters.
- Full-stack cacca89: merged work/ui-static into full-stack branch, no conflicts.
- Full-stack 51f2ef6: backend integrity, transaction/audit fixes, voter/assignment mapping and auth log privacy.
- Handoff commit after 51f2ef6 preserves unfinished session-UI changes and this document.
  It is WIP, not a green release.

## Done and verified before the final WIP

UI fixes:
- Search cannot redraw another persona's reports during a delayed refresh.
- Retry follows error.retryable; failed dependent sections do not masquerade as empty lists or zero metrics.
- Council confirmation/cancel, single submit, APPLYING vs APPLIED success messages.
- Compact member editor, checkbox focus, production 64-hex roster hash wraps at 390px.
- Missing optional voter summaries do not crash report detail.
- Vote reason, decision reason and unmask purpose use API's 1000-character maximum.
- Regression tests were observed failing before their respective fixes.
- Fresh full UI suite on UI-only branch: 57/57 (42 browser + 15 runtime).
- Existing mock preview was reloaded and visually inspected in native Chrome at
  http://127.0.0.1:4173/ui/__mock.html#overview.
  The Chrome extension browser API was unavailable; native app automation worked.
  Headless Chrome provides automated browser coverage. Do not claim Tide end-to-end passed.

Backend:
- Concurrent unmask creation uses CAS on report version/current pointer; loser creates no orphan request.
- Voting claims the round version and writes ballot/tally/audit in one SQLite transaction.
- Votes, decisions and request creation roll back on audit write failure.
- Report identity-envelope service checks the report's current votingRequestId.
- ReportView includes optional assigned-voter summaries; voting views include individual APPROVE/DENY.
- UI adapter preserves assignment, nested retryable errors, purpose, category casing and audit OK -> ALLOWED.
- Proxy/legacy API no longer log bearer credentials, callback context or raw verifier exceptions.
- Temp SQLite helper pre-creates its own test.db for Windows compatibility.
- HTTP encrypted submissions and envelope release remain intentionally locked until real policy/provenance exists.

Exact checks:
- node --test 'tests/p0/*.test.mjs': 61/61 pass after UI merge.
- npm run test:p1: 124/124 pass (9 files), after backend/adapter/logging changes.
- node node_modules/typescript/bin/tsc -p tests/p1/tsconfig.json: pass.
- node scripts/build-bridge.mjs --check: pass.
- git diff --check: pass at handoff.
- New service/adapter/logging regressions were RED -> GREEN (9 + 3 + 2).
- Real Windows execution and G1–G5: NOT RUN.

## Unfinished WIP saved for continuation

Files: public/ui/app.js and public/ui/tests/browser.test.cjs.
Goal: distinguish retryable getSession outage from real UNAUTHENTICATED, and show failure feedback for
logout, both login buttons and mock-persona switching.

Latest full UI run on this WIP: 62/63 pass, exit 1.
- Remaining failure is a malformed browser-evaluation expression at browser.test.cjs around line 583:
  escaped quotes in the Sign out selector. Fix the test expression, do not weaken its assertion.
- Actual UNAUTHENTICATED characterization passes.
- Outage/recovery, both failed-login and failed-persona checks passed.
- Review app.js controls(): replaceChildren(..., unavailable ? null : button) can render literal "null"
  because this is native DOM. Append the button conditionally or use a fragment.
- Rerun the FULL UI suite and record results before calling this unit complete.
- No UI test session remains running.

## Production build is NOT green

npm run build:
- Prisma generate: pass.
- Generated bridge: pass.
- Next 16.4.2/Turbopack compilation: pass.
- Next TypeScript phase: FAIL TS7016 in
  tests/p1/api-contract.test.ts,
  tests/p1/browser-runtime.test.ts,
  tests/p1/services.integration.test.ts
  for imports from ./helpers/contract.mjs.
- Dedicated tests/p1/tsconfig.json type-check passes; root Next tsconfig includes the tests with different options.
- Fix the root/test TypeScript boundary or provide accurate module declarations.
  Do not suppress errors with ignoreBuildErrors or weaken type checking.
- Warning: src/server/roster.ts loadRoster(file) dynamic readFileSync causes tracing of the whole project.
  Review whether to constrain production config path; do not add an ignore comment without understanding deployment needs.
- No dev server for this integrated worktree was launched.
- Do not claim a production-ready/full LIVE app yet.

## macOS + Windows requirement — still needs finishing

User insists both OSes can run after merge, with explicit instructions in Markdown.
- UI already has tests/run.sh and tests/run.ps1, and Chrome/Edge path detection for both.
- Full-stack package.json test:ui currently runs only runtime.test.cjs, NOT browser.test.cjs.
  Add a portable full UI command and document the difference.
- Write an integrated runbook and link it from root README.
- Suggested common sequence: npm ci, npm run db:generate, npm run test:p0, npm run test:p1,
  node node_modules/typescript/bin/tsc -p tests/p1/tsconfig.json,
  npm run build:bridge, full UI suite, npm run build.
- PowerShell can use npm.cmd/npx.cmd when npm.ps1 is blocked. Do not tell users to disable execution policy.
- Document SQLite DATABASE_URL=file:./local/dev.db (relative to prisma/schema.prisma);
  preserve existing .env and databases. Tests use disposable temp databases.
- Consider a Mac/Windows CI matrix; not created in this session.
- Node 26.3.0/npm 11.16.0 were installed here. npm ci took ~13 minutes due slow package downloads.
  npm warned some install scripts were not approved. Inspect required scripts before approving;
  do not blanket-approve dependencies. Prisma generation and bridge worked explicitly.
- node_modules, generated bridge, .next and tidecloak.json are local/ignored; do not commit them.
- Local tidecloak.json is {}, not a real realm config.

## Docker / organizer registration — requested, not completed

User supplied the official Quickstart:
https://docs.tide.org/get-started/Tidecloak%20Quickstart
Read it again if details change.
- Official dev image: tideorg/tidecloak-dev:latest.
- docker ps showed NO running containers. No Tide image/container/volume was created in this session.
- docker manifest inspect succeeded: image supports linux/amd64 and linux/arm64
  (suitable for Windows Docker Desktop Linux containers and Apple Silicon).
- User authorizes Docker if needed. Use a dedicated named volume and loopback-only :8080 mapping;
  do not mount the entire repository as the Keycloak DB directory or destroy existing volumes.
- Quickstart initializer creates realm/clients, activates license, assigns first admin and enables governance.
- It prints an enrollment URL and waits for the first admin to enroll. That human browser step is required.
- Existing repo already has init/tcinit.sh; do not scaffold another Next app over this repository.
- init/.env.example currently has SUBSCRIPTION_EMAIL=test@demo.org and placeholder realm/client defaults.
  Do not register with fake email or infer the user's license email. Get the actual deployment email/config.
- Realm license acceptance, account credentials and any legal consent need the user at the appropriate step.
- No Tide account/realm/app registration was attempted, and no organizer submission form was sent.
- Requests for existing tidecloak.json location and failing backend flow were sent; no answers received before pause.
- This is separate from competition submission. Hackathon.md contains the competition form/checklist;
  read official organizer instructions before claiming submission readiness.

## Remaining product/contract gaps

- Real Tide AuthAdapter/CryptoAdapter still missing; no automatic stub defaults.
  Bridge expects trusted code to set globalThis.VoiceVaultLiveConfig with explicit adapters.
- API endorsement and council-change services remain unavailable; UI mock supports them.
  P1 idea status lacks ENDORSED. Do not fabricate endorsement to make the UI approve button appear.
- Public-credit artifacts and policy/quorum proof remain unverified. Do not unlock sensitive endpoints
  because APP-only tests passed.
- Existing docs/integration/contract-reconciliation.md and older status files predate latest master;
  reconcile their stale statements with the integrated mapper and this handoff.
- Existing architecture docs wrongly assume Tam cannot run Node/Docker; user confirmed Docker is available.
- README/runbook and deployment setup must describe actual behavior, not promise completed LIVE protection.

## Next sequence for Claude

1. Read this handoff, git status and both changed WIP files; do not redo completed fixes.
2. Fix remaining session test expression and literal-null UI detail. Run full static UI suite.
3. Fix Next root TypeScript build failure and rerun build.
4. Finish portable scripts/runbook, review cross-platform paths and execute all checks.
5. Commit/push completed units with full-stack-status.md updated each time.
6. Prepare isolated Tide Docker/setup and follow official enrollment flow with the user.
7. Verify real auth, claims, crypto/provenance and G1–G5; keep blocked operations blocked until proven.
8. Report exact results, remaining blockers and branch/commit links. Never merge master implicitly.

All Codex-owned test/build/download tool sessions completed before handoff; no background job needs resuming.
The old Claude mock harness on :4173 predates this session and was left running.
