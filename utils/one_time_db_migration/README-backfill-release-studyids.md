# Backfill release study IDs

Script: [`scripts/backfill-release-studyids.js`](scripts/backfill-release-studyids.js)

Populates `studyID` on documents in the **`release`** collection for released studies that do not yet have it. Values come from **`approvedStudies`** by matching the node-ID field configured per data common (`CDS` → `dbGaPID`, `ICDC` → `studyAbbreviation`).

## Environment

Configure `.env` from [.env.example](.env.example); see [README-setup.md](README-setup.md).

| Variable | Description |
| -------- | ----------- |
| `CONNECTION_STRING` | MongoDB connection URI |
| `DATABASE_NAME` | Database name |

## Usage

```bash
npm run backfill-release-studyids -- [options]
```

Or:

```bash
node scripts/backfill-release-studyids.js [options]
```

### Options

| Option | Description |
| ------ | ----------- |
| `--data-commons <name>` | Data common to process (repeat for multiple). If omitted or empty, every key in the script’s node-ID mapping is processed (see `NODE_ID_PROPERTY_MAP` in the script). Example: `--data-commons CDS --data-commons ICDC` |
| `--dry-run` | Print what would be updated without writing |
| `--single-update` | Stop after the first successful dry-run or write |
| `--output <path>` | Mirror console output to a dated file under `logs/` (stem and optional subpath; see [README-setup.md](README-setup.md)) |

### Examples

Dry run for **all** configured data commons (no `--data-commons`):

```bash
npm run backfill-release-studyids -- --dry-run
```

Dry run for CDS and ICDC only:

```bash
npm run backfill-release-studyids -- --data-commons CDS --data-commons ICDC --dry-run
```

Write updates and save a log:

```bash
npm run backfill-release-studyids -- --data-commons CDS --output backfill/run
```

The log path is resolved under the repository `logs/` directory (e.g. `logs/backfill/run-<timestamp>.txt`).

## Output

The script prints a run configuration block, per-item lines (skips, dry-run, or updates), and a summary. Unknown data common names (not in the script’s mapping) are reported as errors and skipped.

Return to the [documentation index](README.md).
