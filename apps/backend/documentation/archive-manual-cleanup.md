# Manual archive cleanup

The nightly archive job deletes a Completed submission's S3 data only after DataSync evidence says the copy is in place. Legacy submissions that finished before DataSync records were written have no `dataSync` document, so the job cannot check them. It logs those submissions. An operator verifies the copy, sets an approval flag, and a later run archives the submission.

## Worklist

Each run logs every submission that is Completed, not archived, past the retention date, has `manualArchiveApproval.approved` not set to `true`, and has no `dataSync` document for that `submissionID`. One line per submission, then a total (including `total=0`):

```
[ARCHIVE_MANUAL_VERIFY] submission=<id> dataCommons=<dc> dataType=<type> studyID=<study> bucket=<bucketName> rootPath=<rootPath> updatedAt=<iso>
[ARCHIVE_MANUAL_VERIFY] total=<n>
```

Filter CloudWatch Logs Insights on `ARCHIVE_MANUAL_VERIFY`. Submissions that already have a `dataSync` record are not on this list. They stay on the normal archive gate.

## Approve

After the copied objects are confirmed, set the flag with an update that does not change `updatedAt`. `note` is optional.

```js
db.submissions.updateOne(
  { _id: "<id>", status: "Completed", archived: { $ne: true } },
  { $set: { manualArchiveApproval: { approved: true, note: "<ticket / evidence>" } } }
)
```

The flag archives the submission only when no `dataSync` document exists for that `submissionID`. Any record, of any type or status, ignores the flag. The normal sync gate then decides: a succeeded sync can still archive, and a failed or mismatched sync is retained.

If the record lookup fails, the job ignores every approval for that run and leaves the normal gate in charge.

## What the job logs

For every candidate with `approved: true`:

| Line | Meaning |
| --- | --- |
| `[ARCHIVE_MANUAL] submission=<id> note=<note> outcome=archived reason=NoDataSyncRecord` | No DataSync record. The job deletes the S3 prefix, moves data records to the archive collection, deletes batches, and sets `archived: true`. |
| `[ARCHIVE_MANUAL] submission=<id> note=<note> outcome=ignored reason=DataSyncRecordExists` | A DataSync record exists. The flag is ignored and the normal sync gate runs. |
| `[ARCHIVE_MANUAL] submission=<id> note=<note> outcome=ignored reason=DataSyncLookupFailed` | The record lookup failed. The flag is ignored and the normal sync gate runs. |
| `[ARCHIVE_MANUAL] submission=<id> note=<note> outcome=ignored reason=StudyFileDataSyncInProgress` | A file DataSync for the same study is In Progress. The flag is ignored and the submission is retained. |

The next run drops an archived submission from both the worklist and the approval log.

## Shared study prefix and concurrent transfers

Metadata and Data Files submissions copy data files into the shared study prefix in the data management bucket (`studyID/`). Before archiving such a submission, the job skips it when any submission on that study already has a file DataSync record with status In Progress.

That check only sees transfers that have already written an In Progress row. A file transfer that starts after the check can still overwrite a shared key after verification and before delete. Fully closing that window would require coordinating with the validator transfer (for example a per-study lock) or copying files to an immutable destination prefix.
