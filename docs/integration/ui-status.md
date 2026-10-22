# UI status and work split

Branch: `work/ui-static` (from `master` `6484e85`). Scope: `public/ui/**` plus docs. No change to
`public/integration/**` or any Tung-owned file. [contract-reconciliation.md](./contract-reconciliation.md)
records the original "v1" mismatch before the adapter on latest master. Integrated LIVE verification remains
with the parent integration task; this handoff records the static UI work only.

## In progress — do not pick these up

| Item | Who | Status | Files |
| --- | --- | --- | --- |
| Review, commit/push, and integrate the static UI fixes with latest master | Parent integration task | UI implementation and static tests finished; integration pending | `public/ui/**`, this handoff |

The existing Claude working edits were preserved. No commit or push was made by the UI subtask.

## Done in this branch

Run: open `public/ui/index.html` (MOCK). Tests: `./public/ui/tests/run.sh all` (macOS/Linux) or
`& ./public/ui/tests/run.ps1 -Suite all` (Windows) — **57/57 pass** (15 runtime, 42 browser), observed on macOS with headless Chrome on 2026-10-22.
Of the 12 added browser checks, 10 exposed a confirmed failure before its fix; confirmation/cancel and
compact-editor focus/layout already passed the existing edits. The phone hash check uses clientWidth
so mobile viewport expansion cannot hide horizontal overflow.

**Fixes**
- Credited idea detail no longer says "Identity sealed"; rejected ideas say "Identity is not published after rejection" (§7.1).
- Idea credit consent is unticked by default (explicit consent, §7.1).
- Endorse and dialog submissions cannot double-submit, including repeated form submission events; buttons show progress.
- Apply opens a confirmation naming the roster version and stale-round effect. Cancel preserves the roster. Only APPLIED claims the new roster is in effect; APPLYING remains pending.
- Actions refresh in place; session/page changes clear first. Search cannot redraw cached records while a new persona is loading.
- A submission that succeeds after its dialog was closed still refreshes the list.
- Persona selector shows "Signed out" after sign-out.
- Report form: at least one person involved, reporter cannot pick themselves, stable `clientRequestId` per dialog.
- Council form: max ≥ min check; non-member rows are disabled.
- Dialogs focus their first enabled field, including membership checkboxes; focus stays in the page after re-render.
- Per-section load errors preserve available roster/rounds; failed data never becomes an empty success or zero metric. Retry is offered only when retryable is not false.
- Directory errors disable dependent report/council forms while preserving existing content.
- Vote/idea decision reasons and identity-review purpose stop at the API limit of 1000 characters.
- Older report responses without optional voter summaries still open N/T detail and explicitly say that names are unavailable.
- Search hidden on Overview; Council page filters by search.

**Spec gaps closed**
- READY, APPLYING, APPLIED, COLLECTING have distinct badges (READY ≠ APPLIED).
- Vote rounds show expiry, recipient/executor, purpose, the record being decided, and explain DENIED/EXPIRED/STALE/READY.
- Denied votes are red with screen-reader text; MOCK rounds say "Simulated selection" (§10.2).
- "Originator: … · Endorser: …" on ideas.
- Council proposals show a diff (Added/Removed/Changed/Policy); roster hash shown.
- Report detail shows the fixed assignment (N, T, voters) or "Saved · Awaiting an eligible jury".
- Errors and audit show the enforcement source (APP/FABRIC/QEA/CLIENT/SIMULATED) with a legend; audit shows outcome and time.
- "More records exist" note when a list has `nextCursor`.
- Report form warns that content can identify the author (§14); consent text states the actual rule.
- Root README / Idea.MD no longer promise permanent sealing (§1, §14).

**Cross-platform**
- Font stack covers Windows (Segoe UI) and macOS (San Francisco).
- A production 64-hex roster hash wraps within the phone viewport; compact council form and checkbox focus checked at 390 × 844.
- `run.sh` added beside `run.ps1`; `cdp.cjs` finds Chrome/Edge on Windows (incl. per-user install), macOS and Linux.
- `index.html` explains blocked sibling files (macOS folder privacy, Windows blocked ZIP) instead of loading forever.
  On macOS keep the checkout outside `~/Downloads`, `~/Desktop`, `~/Documents`, or grant the browser access.

**Mock-only additions (propose to contract)**: `purpose` on voting rounds; `IDEMPOTENCY_CONFLICT` message.

## Not done — who takes it

| Item | Owner | Notes |
| --- | --- | --- |
| Verify latest LIVE adapter against the static UI | **Parent integration task** | Latest master has an adapter; historical contract-reconciliation.md records the pre-adapter mismatch. Static tests do not establish LIVE compatibility |
| Resolve branch integration | **Parent integration task** | Preserve the reviewed `public/ui` files when integrating the backend |
| Validate backend report voter summaries and API errors through LIVE | **Parent integration task** | UI tolerates missing summaries; LIVE voter/purpose data still needs integrated verification |
| LIVE runtime, API, DB, TideCloak, G1–G5 | **Parent integration task / Tung** | Not run by this static UI subtask; nothing in the MOCK suite proves enforcement |
| "Binh tries to change the author → denied" demo beat | Tung (method) → UI (button) | Needs a contract method; the UI must not fake a denial |
| Show `publicCredit.verified === false` as unverified | UI | After contract agreement (G4) |
| Pagination beyond 50 | Both | UI only shows a notice today |
| New request after DENIED/EXPIRED round | Both | Process not agreed (handoff doc) |
| Real Windows run of the suite | UI | Paths added; not executed on Windows in this session |

## Conflict rules

- UI side edits only `public/ui/**`, `docs/design/**`, `docs/integration/ui-status.md`.
- Tung edits `public/integration/**`, `src/**`, `app/**`, package/lock files, `tests/p0/**`.
- Shared docs (`README.md`, `voicevault_technical_architecture.md`, `docs/integration/contract-reconciliation.md`): small PRs, one at a time.
- Before starting, pull and check this file; update it in the same PR as the work.
