# 3.7.0 Migration Suite

## Running migrations

```bash
npm run migrate:3.7.0
```

Startup (`bin/www.js`) runs this orchestrator unless `SKIP_STARTUP_MIGRATIONS=true`.

## Migration files

| File | Purpose |
|------|---------|
| `3-7-0-migration.js` | Orchestrator (runs all steps below) |
| `sync-pbac-defaults-migration.js` | Sync PBAC from JSON via `recurring-steps/sync-pbac-defaults.js` |
| `backfill-application-sequence-number.js` | Set `sequenceNumber: 1` where missing (CRDCDH-3970) |
| `backfill-submission-submission-request-id.js` | Set `submissionRequestID` from the linked study's `applicationID` where missing |
| `dedupe-review-comments.js` | Clear review comments that were copied onto `In Revision` events (CRDCDH-3894) |

## Execution order

1. `sync-pbac-defaults-migration.js` (recurring) — merges PBAC defaults into `configuration`
2. `backfill-application-sequence-number.js` (one-time)
3. `backfill-submission-submission-request-id.js` (recurring) — only touches submissions missing `submissionRequestID`, so it also repairs records whose study gained an `applicationID` after the submission was created
4. `dedupe-review-comments.js` (one-time)

## Duplicated review comment cleanup (CRDCDH-3894)

Only an `In Revision` or legacy `In Progress` history event is cleared, and only when its review
comment is identical to the comment on the immediately preceding event and that preceding event is
**not** `Canceled`/`Deleted` (those are legitimate restore reasons). Every other review comment is
left untouched.

Preview the impact without writing:

```bash
DEDUPE_DRY_RUN=true npm run migrate:3.7.0
```

## Prerequisites

Same as 3.6.0: MongoDB env vars in `.env` (`MONGO_DB_HOST`, `MONGO_DB_PORT`, etc.).

## Note on 3.6.0

The 3.6.0 migration suite remains available for manual use (`npm run migrate:3.6.0`) but is not run at startup after 3.7.0.
