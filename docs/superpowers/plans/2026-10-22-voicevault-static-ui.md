# VoiceVault Static UI Implementation Plan

> **For agentic workers:** Use executing-plans to implement task-by-task. This task implements the user's local UI architecture; no platform deployment or live crypto is included.

**Goal:** Deliver an offline, accessible VoiceVault UI with the v1 runtime interface and meaningful mock workflows, ready for Tùng's LIVE adapter.

**Architecture:** Classic scripts and local CSS in public/ui. A minimal fixture/bootstrap baseline in public/integration makes file:// preview immediately usable; HTTP(S) fails closed until a compatible LIVE runtime exists. All UI actions go through the same high-level runtime interface.

**Tech Stack:** HTML, CSS, browser JavaScript; dependency-free Node built-in tests through the existing VS Code embedded runtime, and Chrome DevTools Protocol for browser verification. No installation required.

**Spec:** architecture_toi.md; voicevault_technical_architecture.md sections 5.4, 7, 10, 14.

## Global Constraints

- No npm, framework, module import, CDN, server, or Docker needed to open public/ui/index.html.
- Classic defer scripts; safe DOM construction; no sensitive localStorage, network mock fallback or fabricated crypto proof.
- Roster fixed initially, random N and voters after conflict exclusions, T=ceil(2N/3), independent approval required.
- Council changes use the same vote lifecycle and apply only after READY; stale proposals cannot overwrite a newer roster.
- Every mock result is labeled SIMULATED; no claim that mock implements TideCloak protection.
- Retain v1 method names; expose persona/scenario controls only on the mock implementation.

## Review Focus

- Size N=4 or 5 must not unlock after two votes; duplicate and nonmember votes must fail.
- User strings must stay literal text, including malicious HTML-looking input.
- Proposal READY must not change the roster; apply invalidates older pending votes.
- Closing a revealed-identity view or logging out removes plaintext from the UI state/DOM.
- HTTP(S) missing LIVE runtime must remain unavailable, never instantiate the mock.

## Task 1: Runtime baseline and domain simulation

**Files:** public/integration/contract-fixtures.js; public/ui/mock-runtime.js; public/ui/tests/runtime.test.cjs; public/ui/tests/run.ps1.

**Interfaces:** createVoiceVaultMock(fixtures), v1 Promise<ApiResult<T>> methods from the spec; seeded synthetic people, ideas, reports and vote rounds. Additional mock-only simulation controls support persona/error scenarios.

- [x] Write and run failing runtime tests: no factory initially; then quorum, independent, permissions, validation, sensitive views, idempotent requests, roster application, stale/expired/errors.
- [x] Implement fixture baseline and mock runtime with memory-only state and defensive copies.
- [x] Run the runtime suite; expected no failures.

## Task 2: Static UI and interaction flows

**Files:** public/ui/index.html; styles.css; app.js; views/helpers.js; views/dialogs.js; views/pages.js; public/ui/tests/browser.test.cjs; cdp.cjs.

**Interfaces:** VoiceVaultUI.mount(runtime); safe DOM helpers; page and dialog views consume v1 results/capabilities and never raw tokens/API calls.

- [x] Write failing browser tests for six pages, submission, variable quorum, council state, errors, literal rendering, dialogs and mobile navigation.
- [x] Build the responsive dashboard, forms/detail dialogs, shared vote panel, council proposal editor and audit feed.
- [x] Verify browser flows, keyboard/focus behavior and screenshots with Chrome.

## Task 3: Bootstrap and fail-closed LIVE handoff

**Files:** public/integration/bootstrap.js; existing browser tests.

**Interfaces:** classic-script loader initializes exactly one compatible runtime. file:// uses MOCK; HTTP(S) loads integration/runtime.generated.js and accepts only LIVE v1.

- [x] Add failing browser cases for local boot, version mismatch and HTTP missing runtime with no mock fallback.
- [x] Implement bootstrap and visible, actionable startup errors.
- [x] Run runtime and browser suites together; verify no external requests from local preview.

## Task 4: Verification and handoff

**Files:** public/ui/README.md; docs/integration/static-ui-handoff.md; progress ledger; review package.

- [x] Run the full dependency-free suite and inspect desktop/mobile screenshots.
- [x] Fresh-context code review; reproduce and fix important findings, then rerun tests.
- [x] Record commands/results, interface decisions, baseline ownership and G1–G5 NOT RUN for LIVE.
- [x] Link public/ui/index.html and explain local usage; no commit/push/merge in this restricted Git environment.

## Completion evidence — 2026-10-22

- Final `& ./public/ui/tests/run.ps1 -Suite all`: **27 passed, 0 failed** (15 runtime, 12 browser).
- Native-dialog keyboard smoke: focus moves inside, Escape closes, focus returns to opener.
- All six routes checked at 768/390px: no horizontal overflow; no browser exceptions.
- Ten JavaScript files parsed; UTF-8/trailing-whitespace/conflict-marker check: 19 files, zero issues.
- `git diff --check`: clean. Source files are untracked; separate file check covers them.
- Taste skill installed as `design-taste-frontend`, 38 source/destination checksums match.
- Style: Achromatic ledger, seed 22102026, Segoe UI kept for offline use, no redraws.
- Taste inspector at 1440/768/390: before 7 FAIL; final overview and voting each **0 FAIL, 1 WARN**
  (metadata size ratio, rationale in docs/design/voicevault-taste.md). Screenshots visually inspected.
- Taste source lint: **0 FAIL, 4 WARN** (context label and actual dialog/toast overlay shadows).
- Fresh-context review: three Important findings, each reproduced RED and fixed GREEN:
  late reveal after session/navigation cancellation, anonymous submitter in audit, expired council apply.
- Added assigned-juror unmask initiation and immutable assignment coverage after integration-flow review.
- Handoff/usage/design notes complete; root README distinguishes current MOCK from product vision.
- LIVE runtime, backend, TideCloak, G1–G5: **NOT RUN / not implemented in this UI deliverable**.
- No commit/push/merge; Git ref creation is denied in this environment. User-supplied skill ZIP preserved.
