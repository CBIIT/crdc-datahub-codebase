# Data sync tracking

Tracked AWS DataSync copies are recorded in the `dataSync` collection. The export validator writes those records. The backend only reads them.

## Cleanup

A tracked task and its source and destination locations are deleted only after a fresh read of the stored dataSync status is `Succeeded` or `Failed`. `Stale` and `In Progress` records are not deleted. The delete also waits until `cleanupAfter` is due and the in-flight list and submission rollup writes are done.

Untracked copies (`move_s3_objects` and `restore_deleted_file`) have no dataSync record. Their monitor still deletes the task and locations after the execution ends.
