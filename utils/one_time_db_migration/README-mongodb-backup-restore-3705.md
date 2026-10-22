# MongoDB backup and DocumentDB restore (3705)

Scripts for a one-time migration: dump the project's MongoDB collections from a source MongoDB instance, restore them into Amazon DocumentDB, and verify document counts match.

| File | Role |
| ---- | ---- |
| [`scripts/3705-backup-mongodb.js`](scripts/3705-backup-mongodb.js) | Dump collections from source MongoDB |
| [`scripts/3705-restore-documentdb.js`](scripts/3705-restore-documentdb.js) | Restore dump into DocumentDB |
| [`scripts/3705-compare-instances.js`](scripts/3705-compare-instances.js) | Compare document counts between source and destination |
| [`utilities/3705-constants.js`](utilities/3705-constants.js) | Shared list of collections to backup and verify |

## Prerequisites

- **Node.js** 20 or newer (see [README-setup.md](README-setup.md))
- **MongoDB Database Tools** — `mongodump` and `mongorestore` must be on your `PATH` (see [Database tools version](#database-tools-version) below)
- **`.env`** configured with connection strings and paths (see below)
- For DocumentDB: TLS CA bundle file path referenced in `RESTORE_CONNECTION_STRING`

### Database tools version

Current releases of the `mongodump` and `mongorestore` CLI tools are **not cross-compatible** between MongoDB and Amazon DocumentDB. Use the same tool version for both backup and restore.

**Recommended version: 100.11.0**

Download from the [MongoDB Database Tools legacy releases archive](https://www.mongodb.com/try/download/database-tools/releases/archive). Install that release and ensure it is the version invoked from your shell (check with `mongodump --version` and `mongorestore --version`).

## Environment

Configure `.env` from [.env.example](.env.example). The 3705 scripts use these variables (in addition to the standard `CONNECTION_STRING` / `DATABASE_NAME` used by other scripts):

| Variable | Used by | Description |
| -------- | ------- | ----------- |
| `BACKUP_CONNECTION_STRING` | backup, compare | MongoDB URI for the **source** instance |
| `BACKUP_DATABASE_NAME` | backup, compare | Database name on source and destination |
| `BACKUP_DIRECTORY` | backup, restore | Local directory where `mongodump` writes BSON files |
| `RESTORE_CONNECTION_STRING` | restore, compare | DocumentDB URI for the **destination** instance (typically includes `tls=true`, `tlsCAFile`, and `retryWrites=false`) |

Example DocumentDB connection string shape (from `.env.example`):

```
mongodb://username:password@host:port/?tls=true&tlsCAFile=/path/to/example.pem&retryWrites=false
```

## Collections

Backup and compare operate on the collections defined in [`utilities/3705-constants.js`](utilities/3705-constants.js):

- `applications`
- `approvedStudies`
- `batch`
- `configuration`
- `dataCommons`
- `dataRecords`
- `dataRecordsArchived`
- `fileMD5`
- `institutions`
- `logs`
- `organization`
- `pendingPvs`
- `propertyPVs`
- `pvConceptCodes`
- `qcResults`
- `release`
- `submissions`
- `synonyms`
- `users`
- `validation`

To add or remove collections, edit that file; both backup and compare import the same list.

## Workflow

Run the steps in order. Each step is a separate script intended for manual, operator-supervised execution.

```mermaid
flowchart LR
    A[3705-backup-mongodb.js] --> B[3705-restore-documentdb.js]
    B --> C[3705-compare-instances.js]
    A -->|"mongodump → BACKUP_DIRECTORY"| D[(Local dump)]
    D --> B
    B -->|"mongorestore --drop"| E[(DocumentDB)]
    C -->|"countDocuments()"| F{Counts match?}
    F -->|yes| G[All collections matched]
    F -->|no| H[Verification failed]
```

### 1. Backup source MongoDB

```bash
node scripts/3705-backup-mongodb.js
```

- Runs `mongodump` **sequentially** for each collection in `COLLECTION_NAMES_3705`.
- Uses `--authenticationDatabase admin` on the source connection.
- Writes output under `BACKUP_DIRECTORY` in the standard `mongodump` layout (`<BACKUP_DIRECTORY>/<BACKUP_DATABASE_NAME>/`).
- Streams stdout and stderr to the console.
- If any dump exits with a non-zero code, the script exits with code `1` and does not continue to the next collection.

### 2. Restore into DocumentDB

```bash
node scripts/3705-restore-documentdb.js
```

- Spawns `mongorestore` with `--drop` against `RESTORE_CONNECTION_STRING`, restoring everything under `BACKUP_DIRECTORY`.
- **Destructive:** existing collections in the restore target that overlap with the dump are dropped before import.
- Blocks until `mongorestore` exits. Watch the terminal for progress and a clean completion before running compare.

### 3. Compare instances

```bash
node scripts/3705-compare-instances.js
```

- Connects to source (`BACKUP_CONNECTION_STRING`) and destination (`RESTORE_CONNECTION_STRING`) using the MongoDB Node driver.
- Runs `countDocuments()` on each collection in `COLLECTION_NAMES_3705`.
- Logs per-collection results to stdout (match) or stderr (mismatch).
- On success: prints `All collections matched`.
- On failure: prints mismatched collection names and `Verification failed` to stderr.

Verification is **count-only** — it confirms the same number of documents per collection, not document content or indexes.

## Output examples

**Successful compare:**

```
Getting count for dataRecords in backup database
Getting count for dataRecords in restore database
Matched counts for dataRecords: 12345
...
All collections matched
```

**Failed compare:**

```
MISMATCHED COUNTS FOR release
Source count: 100
Destination count: 98
Mismatched collections: release
Verification failed
```

## Operational notes

- **Restore timing:** Run compare only after restore completes successfully. Compare results are meaningless if restore is still in progress or failed.
- **Backup directory:** Keep `BACKUP_DIRECTORY` dedicated to this migration so `mongorestore` only picks up the intended dump.
- **Exit codes:** All three scripts exit with code `1` on failure: backup on dump failure or spawn error; restore on `mongorestore` failure or spawn error; compare on connection/query error or count mismatch.
- **Connection errors during compare:** If either database is unreachable, the script logs the error and exits with code `1`.

Return to the [documentation index](README.md).
