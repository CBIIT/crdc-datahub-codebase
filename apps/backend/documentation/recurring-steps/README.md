# Recurring migration steps

Idempotent scripts in this directory run on **every release** via the current version migration orchestrator (e.g. `documentation/3-7-1/3-7-1-migration.js` at startup).

Do not run these scripts standalone unless debugging; use the current orchestrator (`npm run migrate`) or `documentation/3-7-1/3-7-1-migration.js`. Older `documentation/3-x-x/` folders are legacy reference; run them manually only when needed.

## Scripts

| File | Purpose |
|------|---------|
| `ensure-indexes.js` | Create DocumentDB indexes from a catalog when missing (`background: true`). Same name and keys is a no-op; same keys under a different name logs a warning and skips. Missing collections are logged and skipped (not created). Startup waits for this step, then listens even if some indexes failed. |
| `sync-pbac-defaults.js` | Insert or overwrite PBAC defaults from `resources/json/PBACDefaults_config.json` into Mongo `configuration` when JSON version is higher |
| `backfill-submission-request-id.js` | Set `Submission.submissionRequestID` from the linked study's `applicationID` where missing, null, or empty (idempotent; repairs studies that gained an `applicationID` after submission creation) |
| `migration-utils.js` | Shared MongoDB connection helpers for orchestrators |

## Adding a new recurring step

1. Add the script under `documentation/recurring-steps/`.
2. Register it in the **latest** version orchestrator. One-time steps that create collections required by the index catalog should run **before** recurring ensure-indexes; other recurring steps follow the order in that orchestrator.
