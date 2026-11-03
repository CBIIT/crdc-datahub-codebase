# Reconcile data sync status

Verifies that a completed submission's data really was copied to its DataSync destination, and sets
the submission's `metadataDataSyncStatus` (and `fileDataSyncStatus`, for Metadata and Data Files) to
`Succeeded` only where the copies match.

## Why this exists

The nightly archive job deletes a submission's S3 data only when its data sync statuses are
`Succeeded`. The `dataSync` collection was created on 2026-10-14 and the export validator only began
writing records to it on 2026-10-23, while archiving requires a submission to be at least
`COMPLETED_RETENTION_DAYS` (default 30) old. Every submission in the existing backlog therefore
predates any `dataSync` record and was backfilled to `Not Started`, so none of them can pass the gate
and none will ever archive.

A plain backfill is not possible — there are no records to read. This script instead establishes the
status from evidence: it finds the destination copy, compares it against the source, and only then
marks the status `Succeeded`.

The archive gate needs more than the status field, though. `_verifySyncedCopies` looks up the latest
`dataSync` record and retains the submission if there isn't one, so setting the status alone would
leave the backlog retained forever. For each verified type this script therefore also writes a
terminal `dataSync` record carrying the folders it actually compared, letting the backend re-verify
independently on every nightly run.

Those records are marked with `reconciledAt`, which the export validator never sets, so a
reconstructed record can always be told apart from an observed one. They deliberately carry no
`listPending`, `rollupPending` or `cleanupAfter` — any of those would make the validator's monitor
adopt them — and no AWS ARNs, because no transfer was involved.

Once the backlog is cleared every submission has a `dataSync` record and this script is obsolete.

## Safety

- **Dry run is the default.** Writes require `--apply`.
- Only ever writes `Succeeded`, and only when a comparison passed. It never writes `Failed` and never
  guesses, so anything unverified stays blocked and the archive job keeps failing closed.
- **Never writes `updatedAt`** — that field drives the retention window, so touching it would push
  each submission out by another 30 days.
- **Writes the `dataSync` record before the status fields.** The two writes are not atomic. In that
  order a partial failure leaves the submission still selected next run, so it converges; the reverse
  order would drop it out of the selection filter with no record and strand it permanently.
- Never modifies `status` or `archived`, and never deletes anything in S3.
- Never overwrites an existing `dataSync` record. A record is inserted only when the **latest** record
  for that type (by `startTime`, whatever its status — the same lookup the archive gate uses) is not
  already `Succeeded`.
- **Never reconciles over a running transfer.** If the latest record is `In Progress`, or has
  `listPending` / `rollupPending` set, the submission is reported as `ActiveTransfer` and left alone.
- Idempotent: submissions already `Succeeded` are not selected, and a second run finds its own record
  as the latest and inserts nothing.

## What it compares

| Sync | Source | Destination |
| --- | --- | --- |
| metadata | `<rootPath>/metadata/release` in the submission bucket | the `Metadata Bucket` for the submission's data commons, under the prefix ending in `-<submissionID>` |
| file | `<rootPath>/file` in the submission bucket | `<studyID>` in the `DM_BUCKET_NAME` bucket |

Where a succeeded `dataSync` record exists, the `sourceFolder` and `targetFolder` of the latest one
(by `startTime`) are used directly. Records that did not succeed never supply folders — the export
validator writes a `Failed` record carrying real folder values when an export never reached the
transfer, and those folders are not evidence of a copy. Otherwise the metadata destination is found
by listing the metadata bucket's top-level prefixes and matching the one ending in
`-<submissionID>`; if a submission was released more than once, the latest timestamp wins.

If the latest record is a finished non-success (for example an older `Succeeded` shadowed by a newer
`Failed`), the comparison runs against the last succeeded copy (or the discovered one) and, on a pass
with `--apply`, a new `Succeeded` record is inserted. Its `startTime` is the run time, so it becomes
the record the archive gate reads.

Objects must match on **key, size and content**. Content is proven by equal ETags from the listing;
when the ETags differ, both objects are fetched with `HeadObject` (checksum mode enabled) and their
stored full-object checksums (CRC64NVME, SHA256, SHA1, CRC32C or CRC32) are compared. If equality
cannot be proven — no shared checksum, or only differing multipart (composite) checksums — the
comparison fails with `ContentUnverifiable`. This matters because the file destination `<studyID>` is
shared by every submission in a study, so a later submission can overwrite a key with different bytes
of the same length. Extra objects at the destination are ignored. Zero-length folder marker keys are
skipped on both sides.

An **empty source listing is a failure here**, where the backend treats it as a pass. The backend's
prefix comes from a recorded `sourceFolder`, so empty means an empty folder; this script may derive
the prefix from `rootPath`, where empty more likely means the prefix is wrong. Since this script's
output authorises deletion, it fails closed.

## Running it

Requires `CONNECTION_STRING`, `DATABASE_NAME` and `AWS_REGION` (see
[Setup and environment](README-setup.md)), plus AWS credentials with `s3:ListBucket` and
`s3:GetObject` (needed by `HeadObject`) on the submission, metadata and data management buckets. If
any of those buckets use SSE-KMS, reading stored checksums also requires `kms:Decrypt` on the key;
without it every `HeadObject` fails and the affected submissions are reported as errors.

```bash
# dry run — reports what would change, writes nothing
npm run reconcile-data-sync-status

# review the failures, then persist
npm run reconcile-data-sync-status -- --apply

# later: re-check submissions this script already reconciled, writing nothing
npm run reconcile-data-sync-status -- --verify-only
```

Run the dry run in a lower tier and review the report before applying anything in production.

## Options

| Flag | Description |
| --- | --- |
| *(none)* | Dry run. Reports what would change and writes nothing. |
| `--apply` | Persist the DataSync records and status updates. |
| `--verify-only` | Re-run the comparison for submissions already reconciled by this script, writing nothing. Mutually exclusive with `--apply`. |
| `--submission=<id>` | Process a single submission, for triage. |
| `--limit=<n>` | Cap the number of submissions processed in one run. Must be a whole number of 0 or more written in digits only (`5`, not `-1`, `1.5`, `1e3` or `5x`); anything else is rejected before the script connects to anything. |
| `--report=<path>` | Write a per-submission CSV: submission ID, verdict, reason, destination prefix, reconciled timestamp. Written even if the run aborts partway. |
| `--output` | Mirror console output into a dated file under `logs/`. |

## Reading the results

Each submission ends as `Passed` or `Failed`. Common failure reasons:

| Reason | Meaning |
| --- | --- |
| `NoMetadataCopy` | No destination prefix ending in `-<submissionID>` exists. The metadata was probably never transferred. |
| `NoDestinationBucket` | No `Metadata Bucket` configured for the data commons, or `DM_BUCKET_NAME` is missing. |
| `MissingRootPath` | The submission has no usable `rootPath`, so no source prefix can be derived. Investigate the submission record. |
| `EmptySourceListing` | The source prefix contains no objects. Either the folder is genuinely empty or the prefix is wrong; both need a human decision before anything is deleted. |
| `MissingSubmissionBucket` / `MissingStudyID` | The submission is missing a field needed to locate its data. |
| `missing destination object <key>` | A source object has no counterpart at the destination. |
| `size mismatch for <key>` | The destination object exists but differs in size. |
| `content mismatch for <key> (<algorithm>)` | Same size, but the stored full-object checksums differ: the destination holds different bytes, typically because another submission in the study overwrote it. |
| `ContentUnverifiable for <key>` | Same size, different ETags, and no comparable stored checksum, so equality cannot be proven. Common for objects stored before S3 began adding default checksums (Dec 2024). |
| `ActiveTransfer` | The latest `dataSync` record is still being monitored by the validator. Re-run after it finishes. |
| `error: <message>` | An unexpected error, usually S3. Only that submission is affected; the run continues. |

A failure means the source data must not be deleted. Submissions that fail need a decision: either the
data was never synced and should be re-released, or the destination was later overwritten by another
submission in the same study, in which case the copy cannot be confirmed from S3 alone.

Return to the [documentation index](README.md).
