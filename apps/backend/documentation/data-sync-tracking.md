# Data sync tracking

Tracked AWS DataSync copies are recorded in the `dataSync` collection. The export validator writes those records. The backend only reads them.

## Start grace

`startTime` is set when the starting container inserts the record (before AWS setup). The monitor uses that clock only when no `taskArn` exists yet (insert-only stalls). Once a `taskArn` is recorded, execution-start grace is measured from `taskArnRecordedAt` (falling back to `startTime` on legacy rows) so slow insert retries cannot finalize a transfer still creating its AWS task.

## Cleanup

A tracked task and its source and destination locations are deleted only after a fresh read of the stored dataSync status is `Succeeded` or `Failed`. `Stale` and `In Progress` records are not deleted. The delete also waits until `cleanupAfter` is due and the in-flight list and submission rollup writes are done.

Pre-start AWS failures that leave a Failed record with location or task ARNs also schedule `cleanupAfter` so the shared monitor can delete those resources after the delay.

Untracked copies (`move_s3_objects` and `restore_deleted_file`) have no dataSync record. Their monitor still deletes the task and locations after the execution ends.

## Insert recovery

If the initial dataSync insert fails, AWS start still runs. After a successful `start_task_execution`, the starter retries insert with the same id and known ARNs, then adds the id to the submission in-flight list so rollup and archival can proceed.
