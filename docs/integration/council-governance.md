# Council governance backend

This implements APP business governance using SQLite. It does not implement Tide/Fabric approval proofs or IAM/QEA reconciliation.

## API and runtime

| API | Service / runtime |
| --- | --- |
| `GET /api/v1/council` | `getCouncil()` reads the persisted effective roster, version and hash |
| `GET /api/v1/council/change-requests` | `listCouncilChanges(query)`; limit/cursor/status |
| `POST /api/v1/council/change-requests` | `submitCouncilChange(input)` |
| `GET /api/v1/council/change-requests/:id` | `getCouncilChange(actor, id)` service / HTTP detail |
| `POST /api/v1/council/change-requests/:id/apply` | HTTP remains `POLICY_UNAVAILABLE`; internal APP service exists |

Submission accepts `{ contractVersion: 'v1', expectedCouncilVersion, reason, proposedMembers, proposedSelectionPolicy }`. The browser runtime adds contractVersion; the UI call shape is unchanged. Each proposed member has `subject`, `membershipRole: 'MEMBER' | 'CHAIR'`, `active`, and `independent`. Display names come from the trusted organization directory. Reason is 10–1000 characters.

The authenticated actor must be an active council member or an `it_admin` to propose. A role cannot directly modify the effective roster. Targets require unique known organization members, at most 12 members, enough active members for minVoters and an active independent. Policy is always `3 <= minVoters <= maxVoters <= 5`, with fixed `ceil(2N/3)` quorum.

## Persistence and transaction behavior

- `CouncilState` stores the effective roster; configuration seeds it only when it is absent. Restarting a service does not restore an old config over a published roster.
- `CouncilSnapshot` retains version history. `CouncilChange` stores immutable target, diff, reason, base version/hash, payload hash and executor.
- Voters are selected once from the OLD roster, excluding changed/removed/added subjects and their management chain. Lack of eligible members produces `AWAITING_ELIGIBLE_JURY`; it never lowers the threshold.
- The same target on the same base version returns the original proposal and assignment, including concurrent retries or changed reason. Terminal proposals are also reused; reopening/redrawing needs a separately agreed process.
- Shared vote service checks active council version, assignment, independent approval, DENY and expiry. Voting and its audit are atomic; READY alone changes no membership.
- Internal `applyCouncilChange(actor, id, { contractVersion:'v1', expectedCouncilVersion })` checks the designated executor, context/payload binding, current version/hash, quorum and expiry. Publishing the new roster, history, APPLIED status, stale pending rounds and audit is one transaction. An applied proposal retries without publishing again.
- A write to the organization's council state row serializes votes, apply, report assignment/unmask creation and service-level report-envelope release in SQLite. Old assignments cannot silently redraw or release identity after a council version change.

## LIVE boundary

The HTTP apply endpoint and UI `applyCouncilChange` remain locked; `canApply` is false in the UI adapter. New members gain APP membership only after an internal APP apply, which is tested with synthetic data; no unchecked public endpoint can invoke it. This follows the same service-test vs HTTP-policy boundary as identity envelope release. Production apply needs verified Tide G3/G5, adapter reconciliation and evidence before the HTTP lock can be removed.

Proposal listing/creation and APP votes can be exercised through HTTP with real verified authentication once realm/configuration is available. HTTP submissions of encrypted ideas/reports and identity release retain their existing locks. `public/ui/**` was not changed.

## Local database adoption

The schema adds `CouncilState`, `CouncilSnapshot`, `CouncilChange` and nullable `VotingRequest.payloadHash`. Verify `DATABASE_URL` points to the intended local development database, then run `npm run db:generate`, `npm run db:push`, and `npm run build:bridge`. No application database was reset or updated automatically. Tests use isolated temporary databases.

## Checks

Observed the missing service/capability regressions failing before implementation. Full P1: 145/145 pass, including 11 council checks for old-roster selection, no early authority, restart persistence, new report assignments, deduplication, CoI/minimum waiting, independent approval, DENY/expiry, concurrent apply, stale READY report authorization, forged context/executor, terminal denial history, API mapping/policy lock and apply-audit rollback. The terminal-history regression was also observed failing before its fix. Dedicated TypeScript and bridge checks pass; P0 61/61 and static UI/browser 31/31 pass. Next production build passes with the existing roster-tracing warning.

Independent read-only review found no Critical/Important issue in this APP scope. Suggested follow-up coverage: explicit removed-member/management-chain exclusion and proposal/vote audit failure injection; apply audit rollback is covered. The production roster-tracing warning is a known separate fix on Tam's full-stack branch.
