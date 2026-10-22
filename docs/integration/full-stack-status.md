# Full-stack status

Branch: `work/full-stack-fixes` (worktree used by Codex, then Claude). Goal: finish BE + FE + data, integrate, test.
History of the pause: [Codex to Claude handoff](HANDOFF-CODEX-2026-10-22.md). **Read this file before starting; claim a
row under "In progress" and push before you begin, so nobody duplicates work.**

## In progress — do not pick these up

| Item | Who | Started | Files |
| --- | --- | --- | --- |
| Mac + Windows runbook (setup, tests, build, run) linked from README; portable full UI test command | Claude (for Tam) | 2026-10-22 | `docs/RUNBOOK.md`, `README.md`, `package.json` scripts |
| Localhost-only DEV auth (env-gated, never in production) so BE + FE + SQLite data run end-to-end without Tide; then live browser test with Tam watching | Claude (for Tam) | 2026-10-22 | `src/server/auth.ts`, `src/integration/**`, `public/integration/**`, seed data |

## Next — free to claim (in this order)

1. Start TideCloak dev in Docker (`tideorg/tidecloak-dev`, named volume, loopback `:8080`) and run `init/tcinit.sh`.
   **Needs Tam:** first-admin enrollment in the browser and the real licence email (never a fake address).
2. Real Tide `AuthAdapter` / `CryptoAdapter` for the LIVE bridge (`globalThis.VoiceVaultLiveConfig`); no stub defaults.
3. API: council-change services — the UI already supports them in MOCK (endorsement landed on master `4cf9add`).
4. Verify G1–G5 against real Tide; keep sensitive endpoints locked until each gate passes.
5. Update `contract-reconciliation.md` and old status docs to match the integrated mapper (they predate it).
6. Architecture docs still say Tam cannot run Node/Docker — Tam can; update `architecture_toi.md`.

## Done and pushed

- **Claude** — end-to-end run on the integrated app (Next + API + SQLite + Simulated TideCloak), observed in Chrome:
  sign-in page → Chi sees 7 seeded ideas and 4 reports; director "View author" opens the approved idea's envelope;
  Frank (designated recipient) opens a READY report round. Server-side denials checked over HTTP: Chi, Binh and a
  juror who voted get `FORBIDDEN` on the report envelope; Dave sees 0 reports; a token with a forged director role
  gets `UNAUTHENTICATED`. Fixed: round `canReveal` now follows the server capability in simulated mode. P1 **156/156**.

- **Claude** — demo seed `npm run seed:demo` (`scripts/seed-demo.ts`): 7 ideas (under review / endorsed / approved
  with and without credit / rejected) and 4 reports (jury collecting, READY, DENIED, awaiting eligible jury) created
  **through the HTTP API** with Simulated TideCloak tokens, so every record passes auth, roles, CoI, hashing, audit.
  Also `npm run test:ui:all` (full UI suite, portable). **Rule change for core review:** CoI now also excludes council
  members who report to an accused person (MOCK already did; spec §10.2 "management chains"). P1 **155/155**.

- **Claude** — Simulated TideCloak, browser side: `public/sim-tidecloak/login.html` (synthetic users + roles, same-origin
  return only), `src/integration/sim-tidecloak-auth.ts` (AuthAdapter/CryptoAdapter with the real adapters' shape).
  The LIVE factory is now async and uses the simulation only when no host Tide adapter is configured **and** the
  server answers `/sim-tidecloak/personas`; otherwise it still fails closed. UI banner says "Simulated TideCloak …
  not Tide-enforced" in amber. Submit/reveal follow server capabilities in this mode only. P0 61/61, P1 **154/154**,
  UI 65/65, bridge ✓, build ✓.

- **Claude** — Simulated TideCloak, server side (`src/server/sim-tidecloak.ts`, `app/sim-tidecloak/{personas,token}`):
  signs HS256 access tokens shaped like TideCloak's (`iss`, `azp`, `exp`, `iat`, `sub`, `organizationId`,
  `realm_access.roles`); `verifySimulatedToken` has the same contract as `verifyTideCloakToken`, so actor extraction,
  role checks, CoI and quorum are unchanged. Only on with `VOICEVAULT_AUTH_MODE=simulated` (routes 404 otherwise);
  submissions/envelopes stay locked outside that mode. HTTP now dispatches `createIdea`, `createReport` and both
  identity-envelope routes (they were never wired). Tests: forged roles, tampered signature, expiry, wrong
  issuer/client, mode gating. P1 **152/152**.

- **Claude** — demo data: `config/roster.json` now seats the spec council (Eva chair, Frank, Grace independent,
  Henry, Iris) and the story personas (An, Binh manager, Chi director, Dave it_admin, Mai) with a manager chain for
  CoI. The old placeholder moved to `tests/p1/fixtures/roster.json` so tests keep stable data. P1 **148/148**.

- **Claude** — merged latest `master` (`4cf9add`, manager endorsement + PROJECT_STATUS) into this branch.
  Conflicts resolved keeping both sides' fixes: master's stricter unmask claim (`status: INVESTIGATING`) and voter
  decisions; Codex's audit write **inside** the unmask transaction; bridge keeps master's default-locked crypto but
  accepts an explicitly supplied adapter. Test updates: denial renders `has-denied` (not `has-voted`); LIVE
  `canSubmit` stays false until provenance is verified (master decision). Checks on the merged tree: P0 **61/61**,
  P1 **147/147**, P1 `tsc` ✓, bridge ✓, UI **65/65**, `npm run build` ✓.

- **Claude** — production build is **green**: root `tsconfig.json` excludes `tests/` (P1 keeps its own tsconfig and
  type-check); production loads `config/roster.json` by static import, file loading moved to `roster-file.ts` for
  tests/scripts, so the whole-project trace warning is gone. Full check on macOS: `npm run build` ✓, P0 **61/61**,
  P1 **124/124**, P1 `tsc` ✓, bridge check ✓, UI **65/65**.

- **Claude** `36c446f` — code-review fixes on the UI: a failure arriving after a form dialog closed is now reported
  (a report could look filed when it was not); blocked-file hint only on `file://` and only if the app never mounted;
  vote purpose shown without a recipient; Votes search matches report evidence; Council search no longer says
  "no proposals" when it only hid them; removed the global action lock that silently ignored other buttons.
  Full UI suite **65/65** (macOS, headless Chrome).
- **Claude** `4d05c5c` — session outage vs UNAUTHENTICATED, login/logout/persona failure feedback; literal "null"
  child fixed; malformed test selector fixed.
- **Codex** `279d53c` (UI 57/57), `3a62610` (expired-session propagation, UI bridge factory),
  `51f2ef6` (atomic voting/audit, current-round check, voter/assignment mapping, log privacy), `cacca89` (UI merge).
- Verified by Codex before the pause: P0 61/61, P1 124/124, dedicated P1 type-check, bridge check.
- **Claude** on `work/ui-static`: spec gaps, interaction fixes, cross-platform test runner, contract reconciliation.

## Not done — known gaps

| Gap | Owner | Notes |
| --- | --- | --- |
| Real Tide adapters, enrollment, G1–G5 | Tam + Tung | Nothing in MOCK or APP tests proves enforcement |
| Council-change API | Free | UI must not fake it; endorsement is done on master |
| HTTP encrypted submissions / envelope release | Locked on purpose | Until real policy/provenance exists |
| Real Windows run of every suite | Free (needs a Windows machine) | Paths are portable; not executed on Windows yet |
| "Binh changes the author → denied" demo | Tung (method) → UI (button) | Needs a contract method |
| Pagination beyond 50, new request after DENIED/EXPIRED | Both | Not agreed in the contract |
| Server error messages are Vietnamese while the UI is English | Core | e.g. "chỉ recipient đã được vote mới mở được" |
| Merge into `master` | Team decision | Never merge implicitly |
