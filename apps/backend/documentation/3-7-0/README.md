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
| `backfill-reopen-user-permissions.js` | One-time: add `submission_request:reopen:*` to existing active users by role |
| `backfill-application-sequence-number.js` | Set `sequenceNumber: 1` where missing (CRDCDH-3970) |

## Execution order

1. `sync-pbac-defaults-migration.js` (recurring) — merges PBAC defaults into `configuration`
2. `backfill-reopen-user-permissions.js` (one-time backfill, idempotent via `$addToSet`)
3. `backfill-application-sequence-number.js` (one-time)

PBAC config sync runs at every startup. The reopen user backfill is a one-time data migration step; re-runs only affect users still missing the permission.

## Prerequisites

Same as 3.6.0: MongoDB env vars in `.env` (`MONGO_DB_HOST`, `MONGO_DB_PORT`, etc.).

## Note on 3.6.0

The 3.6.0 migration suite remains available for manual use (`npm run migrate:3.6.0`) but is not run at startup after 3.7.0.
