# Architecture — Tung's role: platform, browser runtime, and integration

> Tung can run Next.js and Docker; the other teammate cannot run either tool.
> Tung owns the entire real toolchain/runtime. The other teammate writes plain HTML/CSS/JS in public/ui and previews it on file://.
> Preserve the council roster, random N/voter selection, and council-change voting requirements in the shared document.
> This is an implementation guide. The current application uses MOCK only; LIVE and G1–G5 have not been run.

Read [your teammate's architecture](./architecture_toi.md) and the [shared design](./voicevault_technical_architecture.md). This is Tung's runbook; it does not require npm/DB on the other machine.

## 1. Selected integration design

~~~text
Teammate's machine:
  public/ui/index.html + classic CSS/JS
    -> MOCK runtime + JS fixtures -> browser, no server/dependencies

Tung's machine:
  Next.js serves /ui/index.html
    -> the same UI
    -> LIVE browser runtime built by Tung
    -> browser TideCloak SDK / crypto
    -> API /api/v1 -> services -> SQLite / policy / QEA
~~~

Do not convert the UI to React during merge. Next.js serves public files at their corresponding root-relative URLs, allowing the original HTML/CSS/JS to be used directly. The root page may redirect to /ui/index.html; do not create another page at the same static path. [Next.js public folder](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder).

The public folder contains only public code/config and fake fixtures, never databases/secrets/real identities. Static UI is not an auth layer; API and policy still protect the data.

## 2. Files owned by Tung

~~~text
architecture_tung.md
package.json / package-lock.json / tsconfig / next.config / CI
.env.example / config/ / prisma/ / tests/ (automated)
public/integration/
  bootstrap.js                    classic JS, local mock and LIVE selection
  contract-fixtures.js             public JS, fake data, tracked in Git
  runtime.generated.js             generated bundle, gitignored, LIVE only
public/auth/
  callback / silent-SSO assets     according to pinned, smoke-tested SDK
src/
  app/                            host/redirect + API, no UI rewrite
  contracts/                      DTO/schema/encoding + fixture source
  integration/browser-runtime.ts  browser SDK bridge, no server crypto
  server/                         auth/domain/DB/council/voting/policy/audit
scripts/                          bridge build, fixture export, smoke tests
docs/integration/                 baseline/gates/handoff/test results
~~~

The other teammate owns public/ui, including index/styles/app/mock-runtime/views/assets. Request and receive an ownership handoff before changing HTML/script tags; do not edit UI to hide runtime mismatches.

Tung owns all automated tests, including file:// UI smoke and LIVE browser tests. The teammate only needs manual UI testing, without installing a test runner.

## 3. First baseline: hand over early

Do not wait for a complete API/policy before enabling UI work. The minimal foundation commit includes:

1. Agreed runtime v1 contract and view fixtures.
2. public/integration/contract-fixtures.js as plain JS assigning window.VoiceVaultFixtures, without JSON fetches.
3. public/integration/bootstrap.js with no browser dependency on Node.
4. public/ui/index.html shell and app.js mount hook, then hand ownership to the teammate.
5. A minimal mock runtime or factory instructions enabling file:// preview.
6. Browser verification: index.html opens through file:// without a server or Console errors.

Then Tung scaffolds/pins Next.js/React/Tide SDK/Prisma/tooling on his machine. Keep the existing repository root; do not create a nested repository. Commit packages/config and the baseline manifest without requiring the teammate to install them.

## 4. Bootstrap and two runtime modes

The load order in architecture_toi.md is fixture JS -> mock-runtime.js -> app.js -> bootstrap.js, all deferred classic scripts.

Bootstrap responsibilities:

- file://: instantiate only the mock factory, set mode=MOCK, enable the banner, and call VoiceVaultUI.mount(mockRuntime). Do not load the SDK/generated bundle, call APIs, or start Tide login.
- HTTP(S): instantiate only the LIVE runtime, call init, then mount. Bundle/config/service failures must display a connection error without switching to mock.
- Contract version mismatch: stop with CONTRACT_MISMATCH; do not run UI against guessed shapes.
- Mount UI once with a loading/error lifecycle; SDK init/login redirects must not loop.
- User query strings must not enable mock in LIVE or label a result FABRIC-denied. The backend does not trust client mode/capabilities.

Mock may remain a public asset; opening it grants no server permissions. LIVE security tests must verify real requests and mode=LIVE, beyond checking the badge.

## 5. LIVE runtime: Tung owns the difficult integration

The exact interface is in shared-document section 5.4. Tung implements the same surface as mock:

- Session/login/logout with the pinned SDK; never expose raw tokens to the UI.
- Lists/views through an API adapter and ApiResult; validate responses at runtime.
- submitIdea/submitReport: receive form input in the browser, generate UUID/canonical hash, derive identity from the real session, create proof/encryption, and send ciphertext DTOs to the server.
- castVote: obtain immutable context, create a real proof, and submit against the correct votingRequestId; reject self-asserted votes.
- revealIdentity: verify policy/challenge/binding/proof; return plaintext only to a temporary browser view, never POST it to the server.
- Council proposal/apply: shared VotingService, version/hash/N/T, and no apply before sufficient proof.
- Audit correctly distinguishes APP/FABRIC/QEA/CLIENT/SIMULATED.

The runtime is browser code built by Tung. Do not move encryption/decryption into the Next.js server to simplify UI integration.

Provide a Vanilla JS Tide SDK adapter instead of requiring React providers/hooks in the UI. G1 must still prove cross-user sharing; a tag wrapper does not add resource policy.

### 5.1. Build the browser bridge

Tung may bundle src/integration/browser-runtime.ts with esbuild as an IIFE/classic script at public/integration/runtime.generated.js. Select/pin a compatible bundler in the baseline. [esbuild bundling and format](https://esbuild.github.io/api/#bundle).

Required scripts:

| Script | Work |
| --- | --- |
| build:fixtures | Export JS fixtures from contract source, fake data only; review diff before commit |
| build:bridge | Bundle browser runtime; handle assets/workers if required by SDK |
| dev | Build bridge before Next dev; rebuild when runtime source changes |
| build | Build bridge before Next build, ensuring the bundle is in public first |
| test:ui:file | Browser opens file:// index.html; SDK/API must not be called |
| test:ui:live | Browser opens /ui/index.html through Next with real LIVE runtime/API/auth |
| check | Include contract/runtime/fixture checks and bridge build in shared checks |

The generated runtime is not needed on the teammate's machine and is not committed as source. Track bootstrap/fixture JS so a fresh checkout supports local preview.

Verify SDK asset loading, callback, CSP, CORS/issuer, and runtime config. Do not assume a single bundled file is sufficient before smoke-testing the real SDK. Never embed credentials/admin secrets in the bundle/config.

## 6. Backend, council, and policy responsibilities

Tung implements shared-document sections 6–11 and 14–16:

- Verify real JWT/org/role; checking a Bearer prefix is insufficient.
- Validation/idempotency/persistence/optimistic versions/outbox.
- Roster fixed at bootstrap; default min/max 3/5.
- Draw N, then N voters after CoI filtering; T=ceil(2N/3), independent member required, immutable assignment.
- Shared VotingService for identity reveal and council changes.
- Until APPLIED, the old roster remains effective; candidates cannot vote on their appointment; stale proposals do not rebase automatically.
- QEA is an additional technical layer, not a replacement for business voting.
- Keep functions locked when G1–G5 have not passed; never fake proofs or grant broad roles for a demo.
- Never persist reporter plaintext or log tokens/identifying payloads.

Tung runs all npm/Docker/Prisma/CI/live-security commands in the shared guide. The teammate may review results through screen share or a supplied test URL without rebuilding the system.

## 7. Separate and integrated runs

### Separate runs

- The teammate opens file:// and works on mock UI.
- Tung runs Next/Docker/API and LIVE runtime on his machine.
- Commit small contract/fixture baseline updates before requiring UI changes; do not make the teammate infer JSON from TypeScript.

### Integrated run after merge

1. Receive the UI commit and preserve public/ui.
2. Merge into integration/voicevault as described in section 8.
3. Build fixtures/bridge and validate/migrate/generate/seed Tung's local DB.
4. Start Next and open /ui/index.html; file:// cannot demonstrate LIVE.
5. Check relative CSS/JS/assets, LIVE bootstrap selection, and SDK callback route.
6. Test UI actions through runtime to real APIs; inspect network requests so mock-only behavior cannot masquerade as LIVE.
7. Test G1–G5, N=3/4/5, sufficient/insufficient T, council pending/applied/stale, and persona-specific auth.
8. Send SHA, screenshots/video, and results for the teammate's UX review.

Tung's localhost is not automatically accessible from the teammate's machine. Supply an existing valid HTTPS test URL, or share/record the screen. Do not require Next/Docker installation for review.

## 8. Git and merge

Tung's branch: work/server-policy. Teammate's branch: work/ui-static. Both start from the integration/voicevault baseline.

Tung is the single writer for dependencies/lockfiles/contracts/migrations/integration. The teammate commits UI or sends a public/ui ZIP with baseline SHA, excluding .git/env/database. Tung imports a ZIP into a separate branch and reviews the diff instead of overwriting the repository.

Merge small API/runtime or UI milestones as they become ready:

~~~powershell
git fetch origin
git switch integration/voicevault
git pull --ff-only origin integration/voicevault
git status --short
git merge --no-ff --no-commit origin/work/ui-static
~~~

After resolving conflicts, run against the resulting tree:

~~~powershell
git diff --check
git diff --cached --check
npm ci
npm run build:fixtures
npm run build:bridge
npm run db:validate
npm run db:migrate:deploy
npm run db:generate
npm run check
npm run test:ui:file
npm run test:integration
~~~

Check that fixture export did not unexpectedly change the contract. Agree contract changes with the teammate first; do not silently adapt UI to an unreviewed API.

Start application/test prerequisites, then run test:ui:live, live security, and required E2E tests. Commit/push integration only after passing. For Already up to date, verify the handoff SHA instead of creating an empty commit.

Follow the shared runbook for reset/drift/migration conflicts; never reset the DB just to pass checks. Git abort/revert does not undo DB/realm/grants.

After merge, the teammate only fetches/merges Git and reopens index.html, without npm/Prisma. Tung owns a fresh-checkout build of the full application.

## 9. Practical milestones

| Milestone | Tung's handoff/verification |
| --- | --- |
| T0 | Bootstrap + fixtures + runtime contract, working file:// shell |
| T1 | Next static hosting + /me/API skeleton + bridge init; UI stays plain HTML/CSS/JS |
| T2 | LIVE idea submit/decision/reveal + G1/G2/G4 |
| T3 | LIVE report/vote/council change + G3/G5 |
| T4 | UI merge, file/local/live checks, privacy, concurrency, fresh DB |
| T5 | README/demo alignment, shared SHA, and handoff |

Tung handles more technical work because his machine supports the toolchain. The teammate owns all screens, UX states, fixture-driven UI, and demo content so Tung can focus on runtime/policy.

## 10. Prompt for the coding agent on Tung's machine

~~~text
Read architecture_tung.md, architecture_toi.md, and the shared design.
Only this machine runs Next.js/Docker; the teammate opens HTML in a browser.
Own platform/API/DB/IAM/policy, browser LIVE runtime, build/CI/tests.
Preserve the teammate's public/ui; do not rewrite it in React/TSX or require npm.

Hand over file:// bootstrap.js + contract-fixtures.js early.
MOCK/LIVE use the same v1 interface; HTTP(S) is LIVE only, with no fallback.
Bundle Vanilla JS SDK for the browser; keep crypto there and tokens private.
Build bridge before Next build; add file:// and LIVE browser smoke tests.

Preserve bootstrap roster, random N/voters, T=ceil(2N/3), council-change voting,
idempotency, proof/context/version; fail closed until G1–G5 are verified.
Merge UI through branches, test the merged tree, report SHA and actual results.
Do not edit the teammate's UI without an ownership handoff.
~~~

## 11. Handoff from Tung

~~~text
Milestone / commit SHA / baseline SHA:
Runtime contract version / methods already LIVE:
Fixture/bootstrap changes:
SDK/Next/Node/npm/Prisma/image/policy versions:
Commands actually run + results (file UI / integration / LIVE / G1–G5):
Prerequisites or test URL/screen share:
Remaining failures/limits, methods returning POLICY_UNAVAILABLE:
Required UI changes / file ownership handoffs:
~~~
