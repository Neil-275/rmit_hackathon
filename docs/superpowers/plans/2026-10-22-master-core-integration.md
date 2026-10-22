# Master UI and P1 Core Integration Plan

**Goal:** Integrate the current static UI, Next.js shell and license-independent P1 services on master, verify them, and push master.

**Architecture:** Preserve `public/ui/` as the UI implementation. Keep the P1 API contract internally and translate its views at the browser boundary. Verify JWTs server-side; keep identity release and browser crypto unavailable until real Tide adapters and policy have been verified.

**Tech stack:** Next.js 16.4.2, Node 22, TypeScript, Prisma 6.19/SQLite, esbuild and Vitest.

## Constraints

- No realm provisioning, license bypass, fake Fabric proof or production stub authentication.
- No overwrite of unrelated local Markdown files.
- UI stays usable from file:// in clearly labelled MOCK mode.
- HTTP never falls back to MOCK.
- Both successful and denied business operations must be tested.

## Tasks

1. Merge `origin/work/server-policy` and `origin/work/p1-core` into master; resolve UI conflicts using master's UI and combine dependency manifests.
   - Verify: `git diff --check`, inspect all unmerged paths and preserve secret/data ignore rules.
2. Reproduce and fix P1 voting expiry and concurrent request creation.
   - Files: `src/server/domain/voting.ts`, `src/server/services/index.ts`, corresponding P1 tests.
   - Verify RED then GREEN: `npm run test:p1` with READY expiration and concurrent request regressions.
3. Add a UI adapter and configured bridge factory; make invalid sessions signed out and unavailable policy fail closed.
   - Files: `src/integration/ui-runtime.ts`, `bridge-entry.ts`, `browser-runtime.ts`, integration tests.
   - Verify: server-shaped session, voting, council and audit payloads render in the current UI without identity release or stub crypto.
4. Mount authenticated P1 routes through one dispatcher.
   - Files: `src/server/http.ts`, `src/server/auth.ts`, `app/api/v1/[...path]/route.ts`, P1 HTTP tests.
   - Verify: missing/invalid credentials denied; subject/org/roles never taken from request body; identity-envelope routes return POLICY_UNAVAILABLE.
5. Align P0 contract tests with the current UI contract, preserving file://, no-network MOCK and fail-closed HTTP coverage. Keep existing UI browser tests.
   - Verify: `npm run test:p0`, `npm run test:p1`, `npm run test:ui:file`, UI browser suite, `npm run build`.
6. Update README and handoff with actual scope, review changes, commit and push master without force.
   - Verify: final test/build results, no secrets/generated assets staged, remote master SHA equals local HEAD.

Execution is authorized by the user's instruction to proceed jointly with master and push. Tide LIVE gates remain unverified until the deferred license/policy work resumes.
