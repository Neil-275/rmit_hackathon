# UI status and work split

Branch: `work/ui-static` (from `master` `6484e85`). Scope: `public/ui/**` plus docs. No change to
`public/integration/**` or any Tung-owned file. **Read [contract-reconciliation.md](./contract-reconciliation.md)
before merging with `work/server-policy`** — the two "v1" contracts are not compatible yet.

## In progress — do not pick these up

| Item | Who | Started | Files |
| --- | --- | --- | --- |
| Fixing findings from the code review of this branch | UI (Tam) | 2026-10-22 | `public/ui/**` |

Updated and pushed after every finished unit of work. Claim a row here (and push) before starting something new.

## Done in this branch

Run: open `public/ui/index.html` (MOCK). Tests: `./public/ui/tests/run.sh all` (macOS/Linux) or
`& ./public/ui/tests/run.ps1 -Suite all` (Windows) — **45/45 pass** (15 runtime, 30 browser). Every new browser test
was observed failing on the previous code first.

**Fixes**
- Credited idea detail no longer says "Identity sealed"; rejected ideas say "Identity is not published after rejection" (§7.1).
- Idea credit consent is unticked by default (explicit consent, §7.1).
- Endorse/Apply cannot double-submit; buttons show Endorsing…/Applying…/Submitting….
- Actions refresh in place (no spinner, no scroll jump); session/page changes still clear first.
- A submission that succeeds after its dialog was closed still refreshes the list.
- Persona selector shows "Signed out" after sign-out.
- Report form: at least one person involved, reporter cannot pick themselves, stable `clientRequestId` per dialog.
- Council form: max ≥ min check; non-member rows are disabled.
- Dialogs focus their first field; focus stays in the page after re-render.
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
- `run.sh` added beside `run.ps1`; `cdp.cjs` finds Chrome/Edge on Windows (incl. per-user install), macOS and Linux.
- `index.html` explains blocked sibling files (macOS folder privacy, Windows blocked ZIP) instead of loading forever.
  On macOS keep the checkout outside `~/Downloads`, `~/Desktop`, `~/Documents`, or grant the browser access.

**Mock-only additions (propose to contract)**: `purpose` on voting rounds; `IDEMPOTENCY_CONFLICT` message.

## Not done — who takes it

| Item | Owner | Notes |
| --- | --- | --- |
| Agree contract v1 (every row in contract-reconciliation.md) | **Both** | Blocks merge. One call, then Tung regenerates fixtures |
| Remove P0.1's own `public/ui/*` from `work/server-policy` | Tung | Ownership: `public/ui` is the UI side |
| Adapt `mock-runtime.js` + views to the agreed fixtures | UI | One PR after fixtures land; keep the browser suite green |
| LIVE runtime, API, DB, TideCloak, G1–G5 | Tung | All **NOT RUN**; nothing in the UI proves enforcement |
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
