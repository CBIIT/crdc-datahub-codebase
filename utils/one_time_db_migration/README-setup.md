# Setup and environment

## Requirements

- **Node.js** 20 or newer

## Environment variables

Copy `env.example` to `.env` in the repository root and set values for your environment:

| Variable | Description |
| -------- | ----------- |
| `CONNECTION_STRING` | MongoDB connection URI |
| `DATABASE_NAME` | Database name |
| `BACKUP_CONNECTION_STRING` | Source MongoDB URI (3705 backup/compare) |
| `BACKUP_DATABASE_NAME` | Database name on source and DocumentDB (3705) |
| `BACKUP_DIRECTORY` | Local path for `mongodump` output (3705) |
| `RESTORE_CONNECTION_STRING` | DocumentDB URI, typically with TLS options (3705 restore/compare) |

Scripts that connect via [utilities/mongo.js](utilities/mongo.js) require `CONNECTION_STRING` and `DATABASE_NAME`.

The [3705 backup/restore scripts](README-mongodb-backup-restore-3705.md) use the `BACKUP_*` and `RESTORE_CONNECTION_STRING` variables instead.

## Install

```bash
cp .env.example .env
```

Edit `.env`, then:

```bash
npm install
```

## Tests

```bash
npm test
```

Runs [`node:test`](https://nodejs.org/api/test.html) on files under `test/` (no MongoDB required; DB access is mocked).

## Logs

Scripts that support `--output` mirror console output into dated files under the project **`logs/`** directory (see [utilities/logging.js](utilities/logging.js)). Generated files there are gitignored; the folder is kept in git via `logs/.gitkeep`.

Return to the [documentation index](README.md).
