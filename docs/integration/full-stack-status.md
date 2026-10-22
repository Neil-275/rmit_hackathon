# Full-stack status

Branch: `work/full-stack-fixes` (worktree used by Codex, then Claude). Goal: finish BE + FE + data, integrate, test.
History of the pause: [Codex to Claude handoff](HANDOFF-CODEX-2026-10-22.md). **Read this file before starting; claim a
row under "In progress" and push before you begin, so nobody duplicates work.**

## In progress — do not pick these up

| Item | Who | Started | Files |
| --- | --- | --- | --- |
| Fix `npm run build` TypeScript failure (TS7016 for `tests/p1/helpers/contract.mjs`) | Claude (for Tam) | 2026-10-22 | `tsconfig.json`, `tests/p1/**` |
| Mac + Windows runbook (setup, tests, build, run) linked from README; portable full UI test command | Claude (for Tam) | 2026-10-22 | `docs/RUNBOOK.md`, `README.md`, `package.json` scripts |

## Next — free to claim (in this order)

1. Run the whole integrated check on the merged tree: `test:p0`, `test:p1`, P1 type-check, bridge check, full UI suite, `npm run build`.
2. Start TideCloak dev in Docker (`tideorg/tidecloak-dev`, named volume, loopback `:8080`) and run `init/tcinit.sh`.
   **Needs Tam:** first-admin enrollment in the browser and the real licence email (never a fake address).
3. Real Tide `AuthAdapter` / `CryptoAdapter` for the LIVE bridge (`globalThis.VoiceVaultLiveConfig`); no stub defaults.
4. API: idea endorsement (`ENDORSED` status) and council-change services — the UI already supports both in MOCK.
5. Verify G1–G5 against real Tide; keep sensitive endpoints locked until each gate passes.
6. Update `contract-reconciliation.md` and old status docs to match the integrated mapper (they predate it).
7. Architecture docs still say Tam cannot run Node/Docker — Tam can; update `architecture_toi.md`.

## Done and pushed

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
| Production build | Claude (in progress) | Fails at Next's TypeScript phase; compilation itself passes |
| Real Tide adapters, enrollment, G1–G5 | Tam + Tung | Nothing in MOCK or APP tests proves enforcement |
| Endorsement + council-change API | Free | UI must not fake them |
| HTTP encrypted submissions / envelope release | Locked on purpose | Until real policy/provenance exists |
| Real Windows run of every suite | Free (needs a Windows machine) | Paths are portable; not executed on Windows yet |
| "Binh changes the author → denied" demo | Tung (method) → UI (button) | Needs a contract method |
| Pagination beyond 50, new request after DENIED/EXPIRED | Both | Not agreed in the contract |
| Merge into `master` | Team decision | Never merge implicitly |
