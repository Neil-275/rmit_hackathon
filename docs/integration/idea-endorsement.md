# Idea endorsement

Implemented on `work/idea-endorsement`; `public/ui/**` is unchanged.

- `POST /api/v1/ideas/:id/endorse`, JSON `{ "contractVersion": "v1", "expectedVersion": 1 }`.
- Requires a verified actor in the configured organization with realm role `manager`. Body-supplied subject, roles and endorser names cannot set the actor.
- `UNDER_REVIEW` becomes `ENDORSED`, version increments once, and manager subject/time plus one `IDEA_ENDORSED` audit event are persisted in one transaction.
- Wrong/stale version, duplicate endorsement or terminal state returns `VERSION_CONFLICT`; concurrent callers cannot both succeed.
- Endorsement cannot change idea content, consent, authorship or identity ciphertext. It creates no Tide/Fabric proof.
- Director approval now requires `ENDORSED`; rejection is allowed from `UNDER_REVIEW` or `ENDORSED`. APPROVED/REJECTED stay terminal.
- Runtime signature stays `endorseIdea(id, expectedVersion)`; UI adapter maps `capabilities.canEndorse`, `endorsedBy` and `endorsedAt` from server data.
- The plural `/endorsements` path is not an alias; use `/endorse` from the architecture contract.

## Local database update

The schema adds nullable `Idea.endorsedBySubject` and `Idea.endorsedAt` fields. For an existing local development database, verify that `DATABASE_URL` points to the intended local database, then run:

```sh
npm run db:generate
npm run db:push
npm run build:bridge
```

No application database is updated automatically by these source changes; tests create their own temporary database. Do not reset an existing database to adopt this change.

The existing HTTP locks for creating ideas/reports and releasing identity envelopes remain in effect pending verified Tide policy/crypto. Endorsement is an APP business operation and can operate on existing ideas after authentication/configuration is available.

## Validation

Observed missing service/route/capability and approval-without-endorsement regressions failing before implementation. Final checks: P1 134/134 (18 endorsement cases), P0 61/61, UI 31/31, dedicated TypeScript, bridge and Next build pass. Independent read-only review found no Critical/Important issues. The existing roster filesystem tracing warning remains.
