# Core continuation — 22 October 2026

Branch: `work/core-continuation`, based on `master` `b8a835d`.
Read together with [the original handoff](HANDOFF-2026-10-22.md).

## Work split

- Tam owns `public/ui/**`: code-review fixes and exploratory council/unmask/error/keyboard/mobile testing, according to `origin/work/ui-static` at `ba3466e`.
- This branch changes services, browser runtime/adapter, bridge packaging and backend tests. It does not merge or modify Tam's UI.
- Shared contract decisions remain joint work. The UI branch's reconciliation document compares an older backend baseline; reconcile against current master before changing fixtures or UI.

## Implemented

- Create the empty SQLite file in each newly allocated temporary test directory before Prisma pushes the schema. No application database is touched.
- Claim the report's version and current-round pointer inside the transaction before creating an unmask round. A concurrent loser returns `VERSION_CONFLICT` without creating an orphan round.
- Require the supplied voting request to match the report's current pointer before releasing an envelope at the service layer. HTTP envelope endpoints remain locked.
- Return each voter's actual APPROVE/DENY decision; leave the decision absent for a voter who has not voted.
- Preserve API authentication failures instead of turning stale adapter sessions into successful authenticated views. HTTP 401 is rejected even if its body claims success; login retrieves server capabilities.
- Export the bootstrap's `window.createVoiceVaultLiveRuntime()` and wrap the core runtime with the UI adapter. The browser bundle exports no raw factory or stub helpers.
- Require the host to install `window.VoiceVaultLiveConfig = { auth }` before bootstrap runs. `auth` implements `AuthAdapter` in `src/integration/browser-runtime.ts`; all five methods are checked. The API base is fixed to the same-origin `/api/v1`. Missing configuration throws `POLICY_UNAVAILABLE`.
- Keep submit/reveal unavailable in the UI adapter and disable submission capabilities, matching the existing HTTP policy lock. The bridge has no working crypto adapter. No real Tide auth adapter is installed by this change.
- Preserve voting purpose for the UI branch's vote context display.
- Exclude `tests/` from the production TypeScript project; tests retain their dedicated strict check at `tests/p1/tsconfig.json`. No production type-check bypass is enabled.

## Validation

The DB setup error, four existing service regressions, three session regressions and missing bootstrap factory were observed failing before their fixes. A purpose-mapping assertion also failed before the mapper fix.

Commands (using a temporary Node 22 portable installation on this machine):

- `node --test "tests/p0/*.test.mjs"`: 61/61 pass.
- `node node_modules/vitest/vitest.mjs run --config tests/p1/vitest.config.mjs --reporter=dot`: 117/117 pass, including the DOM integration test.
- `node node_modules/typescript/bin/tsc -p tests/p1/tsconfig.json`: pass.
- `node scripts/build-bridge.mjs --check`: pass; normal bridge output also generated locally.
- `& ./public/ui/tests/run.ps1 -Suite all`: 31/31 pass with the generated bundle present.
- `node node_modules/next/dist/bin/next build`: pass, with the existing dynamic-filesystem tracing warning in `src/server/roster.ts`.
- A new integration test renders actual SQLite-backed service payloads through the HTTP dispatcher and UI adapter into the static DOM. It verifies DENY remains a denial, approval progress remains zero and no reveal/vote controls or ciphertext leak through.

The browser test named “HTTP startup without a LIVE bundle” depends on generated output: without the bundle it fails its `POLICY_UNAVAILABLE` expectation because bootstrap correctly reports `LIVE_RUNTIME_UNAVAILABLE`; after generation it tests missing auth configuration and passes. P0 separately covers an actually missing bundle. Coordinate a test isolation fix with Tam; no `public/ui` edits were made here.

Independent read-only review found no Critical/Important issues in this scope. Its minor finding about missing voting purpose was fixed and included in the final passing suite.

## Still deferred

- Actual Tide auth/crypto wiring, realm claims, license/provisioning and G1–G5 remain unverified. HTTP is not an operational LIVE deployment.
- Endorsement before idea approval, council-change service, report assignment detail before its first round, category/status reconciliation, public-credit verification, pagination and the UI policy for reopening rounds require the shared contract pass.
- The build's roster filesystem tracing warning remains; address it before deployment packaging.
- The user requested integrating this continuation into `master` and pushing it. See [PROJECT_STATUS.md](../../PROJECT_STATUS.md) for the current project checklist and the Git result reported with delivery.
