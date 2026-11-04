# Manual archive cleanup

The nightly archive job deletes a Completed submission's S3 data when a Mongo-only gate passes. The gate checks that the latest `dataSync` record for each required type is `Succeeded`. Required types are metadata, plus file for `Metadata and Data Files`.

The backend task role has no read access to the destination buckets (the per-data-commons metadata bucket and the DM bucket). The job never inspects the copied objects. A Succeeded record means a transfer reported success. It does not prove the destination still matches the source.

## Worklist

Each run logs every submission that is Completed, not archived, past the retention date, has `manualArchiveApproval.approved` not set to `true`, and is missing a `dataSync` record for at least one required type. One line per submission, then a total (including `total=0`):

```
[ARCHIVE_MANUAL_VERIFY] submission=<id> dataCommons=<dc> dataType=<type> studyID=<study> bucket=<bucketName> rootPath=<rootPath> updatedAt=<iso> reason=<reason>
[ARCHIVE_MANUAL_VERIFY] total=<n>
```

`reason` is `NoDataSyncRecord` when the submission has no dataSync record, `MissingRecordForType:<type>` when a required type is absent (for example `MissingRecordForType:file`), or `UnknownDataType` when `dataType` is not a known value (legacy documents only; the flag cannot fix these). A submission that has a record for every required type is not on this list. Filter CloudWatch Logs Insights on `ARCHIVE_MANUAL_VERIFY`.

## Approve

After an operator confirms the copy by means outside this job, set the flag with an update that does not change `updatedAt`. `note` is optional. The stored shape is `manualArchiveApproval { approved, note }`.

```js
db.submissions.updateOne(
  { _id: "<id>", status: "Completed", archived: { $ne: true } },
  { $set: { manualArchiveApproval: { approved: true, note: "<ticket / evidence>" } } }
)
```

The flag archives the submission when a required type has no `dataSync` record. That includes a submission with no records and a submission that has a record for only some required types. The `[ARCHIVE_MANUAL]` line uses the same `reason` as the worklist (`NoDataSyncRecord`, `MissingRecordForType:<type>`, and so on).

The flag is ignored when every required type has a record (`reason=DataSyncRecordsComplete`), when `dataType` is unknown (`reason=UnknownDataType`), or when the record lookup fails (`reason=DataSyncLookupFailed`). For complete records, the normal gate then decides: a latest record of `Succeeded` for each required type can still archive, and any other latest status is retained. Nothing is compared, so a destination mismatch cannot be detected.

If the record lookup fails, the job ignores every approval for that run and leaves the normal gate in charge.

## What the job logs

For every candidate with `approved: true`:

| Line | Meaning |
| --- | --- |
| `[ARCHIVE_MANUAL] submission=<id> note=<note> outcome=archived reason=<gap reason>` | A required type is missing. `reason` matches the worklist (`NoDataSyncRecord`, `MissingRecordForType:file`, etc.). The job deletes the S3 prefix, moves data records to the archive collection, deletes batches, and sets `archived: true`. |
| `[ARCHIVE_MANUAL] submission=<id> note=<note> outcome=ignored reason=DataSyncRecordsComplete` | Every required type has a DataSync record. The flag is ignored and the normal gate runs. |
| `[ARCHIVE_MANUAL] submission=<id> note=<note> outcome=ignored reason=UnknownDataType` | `dataType` is not recognized. The flag is ignored; manual approval cannot archive these submissions. |
| `[ARCHIVE_MANUAL] submission=<id> note=<note> outcome=ignored reason=DataSyncLookupFailed` | The record lookup failed. The flag is ignored and the normal gate runs. |
| `[ARCHIVE_MANUAL] submission=<id> note=<note> outcome=ignored reason=StudyFileDataSyncInProgress` | A file DataSync for the same study is In Progress. The flag is ignored and the submission is retained. |

The next run drops an archived submission from both the worklist and the approval log.

## Shared study prefix

Metadata and Data Files submissions copy data files into a shared per-study prefix (`<studyID>/<filename>`) in the DM bucket. Before archiving such a submission, the job skips it when any submission on that study has a file DataSync record with status In Progress at the moment the job runs.

## Residual overwrite risk

Data files for `Metadata and Data Files` submissions are copied into a shared per-study prefix (`<studyID>/<filename>`) in the DM bucket. A later submission on the same study that uploads a file of the same name overwrites the earlier submission's destination object. The `StudyFileDataSyncInProgress` guard only sees transfers that are running at the moment the job executes; an overwrite that completed earlier in the retention window is invisible. The backend has no read access to the destination bucket and cannot detect this. Accepted 2026-11-04. Closing it requires either verification evidence stamped on the `dataSync` record by the validator (which does have destination access), or an immutable per-submission destination prefix.
