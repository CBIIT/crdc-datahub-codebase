# Submission portal — one-time data migrations

This repository holds one-off scripts and small utilities for data and database work related to the submission portal (migrations, backfills, and similar tasks that are not part of the main application).

## Documentation

- [Setup and environment](README-setup.md) — Node version, `.env`, install, where logs are written
- [Backfill release study IDs](README-backfill-release-studyids.md) — populate `studyID` on released studies
- [Backfill admin submit history (3687)](README-backfill-submission-type-admin-3687.md) — set `isAdminSubmit` on the last `Submitted` history entry and `submissionType` to `Admin`
- [Sync application study fields (3808)](README-sync-study-fields-applications-3808.md) — align root `studyAbbreviation` and `studyName` with `questionnaireData`
- [MongoDB backup and DocumentDB restore (3705)](README-mongodb-backup-restore-3705.md) — dump selected collections, restore to DocumentDB, verify counts
