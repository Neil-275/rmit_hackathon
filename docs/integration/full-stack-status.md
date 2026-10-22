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
| Merge into `master` | Team decision | Never merge implicitly |
