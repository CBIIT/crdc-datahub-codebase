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
| `ensure-indexes-migration.js` | Create catalog indexes via `recurring-steps/ensure-indexes.js` |
| `sync-pbac-defaults-migration.js` | Sync PBAC from JSON via `recurring-steps/sync-pbac-defaults.js` |
| `backfill-application-sequence-number.js` | Set `sequenceNumber: 1` where missing (CRDCDH-3970) |
| `backfill-submission-submission-request-id.js` | Set `submissionRequestID` from the linked study's `applicationID` where missing |
| `dedupe-review-comments.js` | Clear review comments that were copied onto `In Revision` events (CRDCDH-3894) |

## Execution order

1. `ensure-indexes-migration.js` (recurring) — creates catalog indexes when missing
2. `sync-pbac-defaults-migration.js` (recurring) — merges PBAC defaults into `configuration`
3. `backfill-application-sequence-number.js` (one-time)
4. `backfill-submission-submission-request-id.js` (recurring) — only touches submissions missing `submissionRequestID`, so it also repairs records whose study gained an `applicationID` after the submission was created
5. `dedupe-review-comments.js` (one-time)

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

Same as the backend service: `DOCDB_ENDPOINT`, `DOCDB_PORT`, `DOCDB_USERNAME`, `DOCDB_PASSWORD`, and `DOCDB_DB_NAME`. TLS is on unless `DOCDB_TLS=false`. When TLS is on, the CA file must exist (`DOCDB_CA_FILE` or `resources/aws-documentdb-certificate/global-bundle.pem`). The orchestrator uses `config.document_db_connection_string` (tls, tlsCAFile, authSource=admin, retryWrites=false).

`DOCDB_USERNAME` and `DOCDB_PASSWORD` are required, including for local runs — credentials are always embedded in the URI. `DOCDB_DB_NAME` sets `DATABASE_NAME`.

## Note on older migrations

Folders `documentation/3-2-0` through `documentation/3-6-0` (and `scripts/3-4-0-migrations.js`) are **legacy (reference only)**. Do not run them against current DocumentDB and do not update them for new compatibility issues.
