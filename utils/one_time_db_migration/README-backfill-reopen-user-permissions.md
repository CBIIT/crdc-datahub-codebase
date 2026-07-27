# Backfill reopen user permissions

Script: [`scripts/backfill-reopen-user-permissions.js`](scripts/backfill-reopen-user-permissions.js)

Adds `submission_request:reopen:*` permissions and the `submission_request:reopened` notification to existing **active** users by role (Admin, Submitter, User), aligned with PBAC defaults. Idempotent via `$addToSet`.

Run once after PBAC defaults sync (`sync-pbac-defaults`). Not part of the backend 3.7.0 startup migration suite — admins may remove permissions/notifications per user afterward.

## Environment

Configure `.env` from [env.example](env.example); see [README-setup.md](README-setup.md).

| Variable | Description |
| -------- | ----------- |
| `CONNECTION_STRING` | MongoDB connection URI |
| `DATABASE_NAME` | Database name |

## Usage

```bash
npm run backfill-reopen-user-permissions -- [options]
```

Or:

```bash
node scripts/backfill-reopen-user-permissions.js [options]
```

### Options

| Option | Description |
| ------ | ----------- |
| `--output <path>` | Mirror console output to a dated file under `logs/` (stem and optional subpath; see [README-setup.md](README-setup.md)) |

### Examples

Run the backfill:

```bash
npm run backfill-reopen-user-permissions
```

Run and save a log:

```bash
npm run backfill-reopen-user-permissions -- --output backfill/reopen-permissions
```

## Role mappings

| Role | Permission | Notification |
| ---- | ---------- | ------------ |
| Admin | `submission_request:reopen:all` | `submission_request:reopened` |
| Submitter | `submission_request:reopen:own` | `submission_request:reopened` |
| User | `submission_request:reopen:own` | `submission_request:reopened` |
