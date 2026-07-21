# Recurring migration steps

Idempotent scripts in this directory run on **every release** via the current version migration orchestrator (e.g. `documentation/3-7-0/3-7-0-migration.js` at startup).

Do not run these scripts standalone unless debugging; use the version orchestrator or `npm run migrate:<version>`.

## Scripts

| File | Purpose |
|------|---------|
| `sync-pbac-defaults.js` | Insert or overwrite PBAC defaults from `resources/json/PBACDefaults_config.json` into Mongo `configuration` when JSON version is higher |
| `migration-utils.js` | Shared MongoDB connection helpers for orchestrators |

## Adding a new recurring step

1. Add the script under `documentation/recurring-steps/`.
2. Register it in the **latest** version orchestrator's recurring-steps section (before one-time migrations).
