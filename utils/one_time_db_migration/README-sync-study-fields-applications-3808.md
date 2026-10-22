# Sync application study fields from questionnaireData (ticket 3808)

Script: [`scripts/sync-study-fields-applications-3808.js`](scripts/sync-study-fields-applications-3808.js)

Scans all documents in the **`applications`** collection and syncs root-level study fields with values from `questionnaireData`:

- `studyAbbreviation` ← `parsedData.study.abbreviation`
- `studyName` ← `parsedData.study.name`

`questionnaireData` may be stored as a **JSON string** or a **native MongoDB object**.

When `parsedData.study.abbreviation` or `parsedData.study.name` is null (or `study` is missing), the corresponding root field is set to an empty string.

Documents that are already in sync are skipped and not counted as updated.

## Environment

Configure `.env` from [.env.example](.env.example); see [README-setup.md](README-setup.md).

| Variable | Description |
| -------- | ----------- |
| `CONNECTION_STRING` | MongoDB connection URI |
| `DATABASE_NAME` | Database name (e.g. `crdc-datahub`) |

## Usage

```bash
npm run sync-study-fields-applications-3808 -- [options]
```

Or:

```bash
node scripts/sync-study-fields-applications-3808.js [options]
```

### Options

| Option | Description |
| ------ | ----------- |
| `--dry-run` | Log what would be updated without writing |
| `--single-update` | Stop after the first dry-run or write that would change study fields |
| `--output <path>` | Mirror console output to a dated file under `logs/` (see [README-setup.md](README-setup.md)) |

### Examples

Dry run:

```bash
npm run sync-study-fields-applications-3808 -- --dry-run
```

Dry run with log file:

```bash
npm run sync-study-fields-applications-3808 -- --dry-run --output sync/study-fields
```

Smoke test one write:

```bash
npm run sync-study-fields-applications-3808 -- --single-update
```

Write updates and save a log:

```bash
npm run sync-study-fields-applications-3808 -- --output sync/study-fields
```

## Behavior

- Scans every document in `applications` (full collection scan).
- Accepts `questionnaireData` as a JSON string or native MongoDB object.
- Skips documents with missing, empty, or invalid `questionnaireData` (not parseable as a JSON object).
- Skips documents where root `studyAbbreviation` or `studyName` is a non-string type (e.g. number, boolean).
- Skips documents where root `studyAbbreviation` and `studyName` already match the derived targets.
- Does **not** update root fields when `questionnaireData` cannot be read — there is no source of truth to sync from.
- Null or missing values in `parsedData.study` map to empty strings at the root level.
- When either field is out of sync, both root fields are updated to their target values.
- Logs each updated (or would-update) document with `_id` and before/after values for changed fields.
- Summary reports total documents considered, skipped, already in sync, and updated counts.

### Operational note

`questionnaireData` is the source of truth. When `parsedData.study.abbreviation` is null, root `studyAbbreviation` will be set to `""` even if it currently holds a value that looks like a study name. Review dry-run output before running against production.

Run against a backup or lower environment first.

Return to the [documentation index](README.md).
