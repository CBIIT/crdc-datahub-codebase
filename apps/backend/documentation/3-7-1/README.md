# 3.7.1 Migration Suite

## Running migrations

```bash
npm run migrate
```

Startup (`bin/www.js`) runs this orchestrator unless `SKIP_STARTUP_MIGRATIONS=true`.

One-time data backfills from 3.7.0 are **not** re-run here; if you need those steps on an environment that has not applied them yet, run `node documentation/3-7-0/3-7-0-migration.js` from `apps/backend`.

## Migration files

| File | Purpose |
|------|---------|
| `3-7-1-migration.js` | Orchestrator (runs all steps below) |
| `create-data-sync-collection.js` | Create `dataSync` collection if missing (one-time) |
| `ensure-indexes-migration.js` | Create catalog indexes via `recurring-steps/ensure-indexes.js` (background builds; missing collections logged, not created) |
| `sync-pbac-defaults-migration.js` | Sync PBAC from JSON via `recurring-steps/sync-pbac-defaults.js` |
| `backfill-submission-submission-request-id.js` | Backfill `submissionRequestID` via `recurring-steps/backfill-submission-request-id.js` |

## Execution order

1. `create-data-sync-collection.js` (one-time) — creates the `dataSync` collection when absent; idempotent if it already exists
2. `ensure-indexes-migration.js` (recurring) — creates catalog indexes when missing (`background: true`). Startup waits until the catalog is processed, then listens even if some indexes failed. Missing collections are logged and skipped (not created). Same key pattern under a different name logs a warning and skips.
3. `sync-pbac-defaults-migration.js` (recurring) — merges PBAC defaults into `configuration`
4. `backfill-submission-submission-request-id.js` (recurring) — only touches submissions where `submissionRequestID` is missing, null, or empty, so it also repairs records whose study gained an `applicationID` after the submission was created

## Prerequisites

Same as the backend service: `DOCDB_ENDPOINT`, `DOCDB_PORT`, `DOCDB_USERNAME`, `DOCDB_PASSWORD`, and `DOCDB_DB_NAME`. TLS is on unless `DOCDB_TLS=false`. When TLS is on, the CA file must exist (`DOCDB_CA_FILE` or `resources/aws-documentdb-certificate/global-bundle.pem`). The orchestrator uses `config.document_db_connection_string` (tls, tlsCAFile, authSource=admin, retryWrites=false).

`DOCDB_USERNAME` and `DOCDB_PASSWORD` are required, including for local runs — credentials are always embedded in the URI. `DOCDB_DB_NAME` sets `DATABASE_NAME`.

## Note on older migrations

Folders `documentation/3-2-0` through `documentation/3-6-0` (and `scripts/3-4-0-migrations.js`) are **legacy (reference only)**. Do not run them against current DocumentDB and do not update them for new compatibility issues.
