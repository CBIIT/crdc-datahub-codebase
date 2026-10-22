# Backfill admin submit flag on history (ticket 3687)

Script: [`scripts/backfill-submission-type-admin-3687.js`](scripts/backfill-submission-type-admin-3687.js)

For each submission ID listed in a YAML config file:

- Sets `isAdminSubmit: true` on the **last** `history[]` entry with `status: "Submitted"`.
- Sets top-level `submissionType` to `"Admin"`.

Other history entries and top-level fields (including `status`) are not modified.

There is **no status filter** on the submission document — scope is controlled entirely by the ID list you provide.

## Environment

Configure `.env` from [.env.example](.env.example); see [README-setup.md](README-setup.md).

| Variable | Description |
| -------- | ----------- |
| `CONNECTION_STRING` | MongoDB connection URI |
| `DATABASE_NAME` | Database name |

## Config file

```yaml
admin_submission_ids:
  - "c70f6940-8bac-43ef-a5ac-cc9ff55cc354"
```

Submission `_id` values are **string UUIDs** (not MongoDB ObjectIds).

## Usage

```bash
npm run backfill-submission-type-admin-3687 -- --config <path-to-yaml> [options]
```

Or:

```bash
node scripts/backfill-submission-type-admin-3687.js --config <path-to-yaml> [options]
```

### Options

| Option | Description |
| ------ | ----------- |
| `--config <path>` | **Required.** YAML file with `admin_submission_ids` |
| `--dry-run` | Log what would be updated without writing |
| `--single-update` | Stop after the first dry-run or write that would patch history |
| `--output <path>` | Mirror console output to a dated file under `logs/` (see [README-setup.md](README-setup.md)) |

### Examples

Dry run:

```bash
npm run backfill-submission-type-admin-3687 -- --config ./config/admin-ids.yaml --dry-run
```

Write updates and save a log:

```bash
npm run backfill-submission-type-admin-3687 -- --config ./config/admin-ids.yaml --output backfill/admin-history-3687
```

Smoke test one write:

```bash
npm run backfill-submission-type-admin-3687 -- --config ./config/admin-ids.yaml --single-update
```

## Behavior

- Skips IDs not found in `submissions`.
- Skips when there is no `Submitted` entry in `history`.
- Skips when the last `Submitted` entry already has `isAdminSubmit: true` **and** `submissionType` is already `"Admin"` (safe to re-run).
- Patches only fields that are missing or incorrect (`history` and/or `submissionType`).
- When patching history, only the last `Submitted` entry changes; preserves `userID`, `dateTime`, and other fields on that object.

Run against a backup or lower environment first.

Return to the [documentation index](README.md).
