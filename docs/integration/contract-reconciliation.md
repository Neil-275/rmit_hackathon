# Contract v1 reconciliation — UI vs `work/server-policy`

Compared: static UI on `master` (`public/ui`, `public/integration` at `6484e85` + working tree) and
`origin/work/server-policy` at `7968226` (P0.1 contract baseline, merge base `8725f1a`).
Both declare `contractVersion: 'v1'`, but the shapes are **not compatible**. Merging either side as-is
breaks the other: the UI renders `undefined`/crashes, or the P0.1 contract tests fail.

Per the shared design (§5, §5.4) Tung owns the contract and the UI consumes generated fixtures.
P0.1 also contradicts the shared design in places (marked **spec**), so neither side should simply win.
Agree each row below, regenerate fixtures from one source, then adapt the consumer.

## 1. Ownership and boot

| Topic | UI (`master`) | P0.1 (`work/server-policy`) | Proposal |
| --- | --- | --- | --- |
| `public/ui/*` | Owned by UI (architecture_toi §2) | P0.1 adds its own `public/ui/app.js`, `index.html`, `mock-runtime.js` | Drop P0.1's `public/ui` files at merge; keep its tests by pointing them at the UI's files |
| LIVE factory | `createVoiceVaultLiveRuntime()` (handoff doc) | `createVoiceVaultLive({contractVersion})` | Pick one name; record it in §5.4 |
| LIVE bundle path | Relative `../integration/runtime.generated.js` | Absolute `/integration/runtime.generated.js` | Relative works under both `/ui/` and sub-path hosting |
| Who calls `init()` | `VoiceVaultUI.mount` calls `init()` | Bootstrap calls `init()`, then `mount()` | Bootstrap calls it once and passes `init.data` to `mount(runtime, session)`; UI must not re-init |
| Boot state attribute | `body[data-app-state]` | `html[data-vv-state]`, `data-vv-mode` | Keep both, or pick one for tests |
| Copy language | English only (tested) | Vietnamese messages and fixture names | Decide product language once; fixtures and error messages must follow it |

## 2. Shapes the UI reads

| View / field | UI expects | P0.1 provides | Proposal |
| --- | --- | --- | --- |
| Session capabilities | `capabilities.canSubmit` (object) | `capabilities: ['submitIdea','submitReport']`, `roles: []` | Either is fine; choose one form for **all** views |
| Idea capabilities | `{canEndorse, canDecide, canReveal}` | `['decide']`, `['revealIdentity']` | Same decision as above |
| Idea status | `UNDER_REVIEW → ENDORSED → APPROVED/REJECTED` | No `ENDORSED`; `endorsementCount` | **spec** §7.1 requires endorsement before approval: add `ENDORSED` (or `endorsed: true`) plus `endorsedBy` |
| Idea category | `PROCESS/CULTURE/SUSTAINABILITY/PRODUCT` | `process/culture/tooling` | One enum, one case |
| `publicCredit` | `{displayName, simulated?}` | `{displayName, verified}` | Keep `verified`; UI must show "unverified" when false (**spec** G4) |
| Report body | `evidenceDetails` | `summary` | One name |
| Report assignment | `voters[]` `{id, displayName, independent}` | `jurors[]` `{subject, displayName, independent}` | One name; `id` vs `subject` everywhere |
| Report vote round | Nested `report.voting` | Only `votingRequestId` | Nest a summary, or the UI fetches `getVotingRequest` per report |
| Report terminal state | `RESOLVED` (**spec** §7.2) | `CLOSED` | Follow spec |
| Voting state field | `status` | `state` | One name |
| Voting progress | `approvalCount` + `validApprovals: [{voterId, decision}]` | `validApprovals: <number>` + `voters[].hasVoted` | The UI needs per-voter **decision** to show denials; `hasVoted` cannot show a DENY |
| Granted reveal | `GRANTED` (**spec** §7.2) | `CONSUMED` | Follow spec, or add `CONSUMED` to the spec deliberately |
| Vote context | `recipientSubject`, `purpose` (UI shows both) | `purpose`, `contextHash`, `councilRosterHash` | Add `recipientSubject` to P0.1; UI can show the hashes |
| Per-session flags | `canVote`, `canReveal` on the round | Report-level `capabilities: ['vote']` | Keep them on the round: a vote is per round, not per report |
| Council change state | `status` | `state`, plus `appliedCouncilVersion` | One name |
| Council diff | Computed in the UI from rosters | Server `diff: {added, removed, changed}` (subjects only) | **spec** §5.2: server diff is authoritative; include *what* changed for `changed` entries |
| Directory | `{id, displayName, title, department}` | `{id, displayName}` | UI degrades without `title`; keep `department` out if it feeds CoI (**spec** §10.2) |
| Audit event | `action, actor, targetId, enforcement, createdAt, outcome` | `action, outcome, source, resourceKind, resourceId, requestId, at` | Adopt P0.1's names (closer to **spec** §5.2: no actor/identity); UI must not show `actor` for submissions |
| Methods | 19 | + `getIdea`, `getReport`, `listMyVotingRequests` | UI can adopt; `listMyVotingRequests` replaces the UI's client-side "awaiting you" count |
| Submit report retry key | `clientRequestId` in form input | Not in fixtures | Keep (**spec** §6 idempotency); the runtime maps it to `Idempotency-Key` |

## 3. Order of work

1. Both agree this table (one call); Tung updates `src/contracts` and regenerates `contract-fixtures.js` in English.
2. Tung removes P0.1's `public/ui` files from his branch; P0.1 UI smoke tests target the real UI.
3. UI adapts `mock-runtime.js` and the views to the regenerated fixtures in one PR, with the browser suite updated.
4. Only then merge `work/server-policy` and `work/ui-static` into `integration/voicevault` as in the handoff guide.

Until step 3, keep the two branches apart; a textual merge will "succeed" on some files and fail at runtime.
