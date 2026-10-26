"""Unit tests for DataSync tracking precedence in metadata_export.py."""
import os
import sys
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, "src"))

from botocore.exceptions import ClientError

import metadata_export
from metadata_export import (
    ExportMetadata,
    monitor_datasync_task,
    _track,
    _monitor_data_sync,
    _next_data_sync_monitor_state,
    _run_data_sync_monitor_pass,
    data_sync_monitor_loop,
    _verified_source_keys_to_delete,
    _destination_key_for_source,
    _client_error_not_found,
    _resolve_task_execution_arn,
)
from common.constants import (
    ID,
    SUBMISSION_ID,
    TYPE,
    STATUS,
    EXPORT_ROOT_PATH,
    BATCH_BUCKET,
    DATA_COMMON_NAME,
    STUDY_ID,
    TIER_CONFIG,
    DATASYNC_ROLE_ARN_CONFIG,
    DATASYNC_LOG_ARN_CONFIG,
    DM_BUCKET_CONFIG_NAME,
    DATA_SYNC_TYPE_METADATA,
    DATA_SYNC_TYPE_FILE,
    DATA_SYNC_STATUS_IN_PROGRESS,
    DATA_SYNC_STATUS_SUCCEEDED,
    DATA_SYNC_STATUS_FAILED,
    DATA_SYNC_STATUS_STALE,
    DATA_SYNC_TASK_ARN,
    DATA_SYNC_TASK_EXECUTION_ARN,
    DATA_SYNC_SOURCE_LOCATION_ARN,
    DATA_SYNC_DEST_LOCATION_ARN,
    DATA_SYNC_LIST_PENDING,
    DATA_SYNC_ROLLUP_PENDING,
    DATA_SYNC_CLEANUP_AFTER,
    DATA_SYNC_CLEANUP_STARTED_AT,
    DATA_SYNC_CLEANED_AT,
    DATA_SYNC_CLEANUP_ERROR,
    DATA_SYNC_LAST_ERROR,
    DATA_SYNC_OBSERVATION_ERROR_SINCE,
    DATA_SYNC_LAST_POLLED_AT,
    DATA_SYNC_END_TIME,
    DATA_SYNC_START_TIME,
    DATA_SYNC_WRITE_APPLIED,
    DATA_SYNC_WRITE_STALE,
    DATA_SYNC_WRITE_ERROR,
    DATA_SYNC_WRITE_MAX_ATTEMPTS,
    DATA_SYNC_WRITE_RETRY_DELAY_SECONDS,
    DATA_SYNC_MONITOR_STATE_ACTIVE,
    DATA_SYNC_MONITOR_STATE_WAITING,
    DATA_SYNC_MONITOR_ACTIVE_INTERVAL_SECONDS,
    DATA_SYNC_MONITOR_WAITING_INTERVAL_SECONDS,
    DATA_SYNC_POLL_CLAIM_SECONDS,
    DATA_SYNC_LAST_ERROR_NOT_STARTED,
    DATA_SYNC_LAST_ERROR_STALE_NO_TASK,
    DATA_SYNC_LAST_ERROR_STALE_NOT_FOUND,
    DATA_SYNC_LOG_TRANSFER_FAILED,
    DATA_SYNC_LOG_EXECUTION_FAILED,
    DATA_SYNC_LOG_TRACKING_FAILED,
    DATA_SYNC_LOG_CLEANUP_FAILED,
    DATA_SYNC_LOG_CLEANUP_DEFERRED,
    DATA_SYNC_LOG_STALE,
    DATA_SYNC_START_GRACE_SECONDS,
)


def _finalize_set_fields(mongo_dao):
    """Return the first update $set that writes a terminal STATUS."""
    for call in mongo_dao.update_data_sync.call_args_list:
        set_fields = call.args[1] if len(call.args) > 1 else None
        if isinstance(set_fields, dict) and set_fields.get(STATUS) in (
            DATA_SYNC_STATUS_SUCCEEDED, DATA_SYNC_STATUS_FAILED, DATA_SYNC_STATUS_STALE,
        ):
            return set_fields
    return None


SUBMISSION_ID_VAL = "sub-1"
NOW = datetime(2026, 1, 1, 12, 0, 0)


@pytest.fixture(autouse=True)
def _fast_track_retries():
    """Skip the one-minute _track retry delay in every test."""
    with patch("metadata_export.time.sleep"):
        yield


def _make_export_metadata():
    """Build an ExportMetadata with a mocked MongoDao (bypass __init__)."""
    mongo_dao = MagicMock()
    mongo_dao.insert_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
    mongo_dao.add_active_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
    mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
    mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
    mongo_dao.get_bucket_name.return_value = "metadata-bucket"

    export_metadata = ExportMetadata.__new__(ExportMetadata)
    export_metadata.mongo_dao = mongo_dao
    export_metadata.submission = {
        ID: SUBMISSION_ID_VAL,
        EXPORT_ROOT_PATH: "root/path",
        BATCH_BUCKET: "bucket",
        DATA_COMMON_NAME: "CDS",
        STUDY_ID: "study-1",
    }
    export_metadata.configs = {
        DATASYNC_ROLE_ARN_CONFIG: "role-arn",
        DATASYNC_LOG_ARN_CONFIG: "log-arn",
        TIER_CONFIG: "dev",
        DM_BUCKET_CONFIG_NAME: "dm-bucket",
    }
    export_metadata.s3_service = MagicMock()
    export_metadata.log = MagicMock()
    return export_metadata, mongo_dao


def _mock_datasync_client():
    client = MagicMock()
    client.create_location_s3.side_effect = [{"LocationArn": "src-loc"}, {"LocationArn": "dest-loc"}]
    client.create_task.return_value = {"TaskArn": "task-arn-1"}
    client.start_task_execution.return_value = {"TaskExecutionArn": "exec-arn-1"}
    return client


def _aws_methods(client):
    return [
        call[0] for call in client.mock_calls
        if call[0] in ("create_location_s3", "create_task", "start_task_execution")
    ]


def _not_found():
    error = ClientError(
        {"Error": {"Code": "InvalidRequestException", "Message": "Task execution was not found."}},
        "DescribeTaskExecution",
    )
    return error


def _record(**overrides):
    record = {
        ID: "sync-1",
        SUBMISSION_ID: SUBMISSION_ID_VAL,
        TYPE: DATA_SYNC_TYPE_FILE,
        STATUS: DATA_SYNC_STATUS_IN_PROGRESS,
        DATA_SYNC_START_TIME: NOW - timedelta(hours=1),
        DATA_SYNC_LIST_PENDING: False,
        DATA_SYNC_ROLLUP_PENDING: False,
        DATA_SYNC_TASK_ARN: "task-arn-1",
        DATA_SYNC_TASK_EXECUTION_ARN: "exec-arn-1",
        DATA_SYNC_SOURCE_LOCATION_ARN: "src-loc",
        DATA_SYNC_DEST_LOCATION_ARN: "dest-loc",
    }
    record.update(overrides)
    return record


class TestTransferPrecedence:
    def _run(self, export_metadata, sync_type=DATA_SYNC_TYPE_FILE):
        with patch("metadata_export.boto3") as mock_boto3, \
                patch("metadata_export.threading.Thread") as thread_cls, \
                patch("metadata_export.notify_data_sync_started") as notify, \
                patch("metadata_export.get_uuid_str", return_value="sync-1"), \
                patch("metadata_export.current_datetime", return_value=NOW):
            client = _mock_datasync_client()
            mock_boto3.client.return_value = client
            export_metadata.transfer_s3_obj(
                "bucket", "src/folder", "dest-bucket", "dest/folder", [], sync_type=sync_type,
            )
        return client, thread_cls, notify

    def test_tracked_transfer_makes_the_original_aws_calls(self):
        """A tracked file transfer creates both locations and a task named with tier and dataSync id, tags both, starts the execution, inserts tracking, and wakes the monitor instead of the per-transfer thread."""
        export_metadata, mongo_dao = _make_export_metadata()
        tags = [{"Key": "Tier", "Value": "dev"}, {"Key": "Type", "Value": "Data File"}]
        with patch("metadata_export.boto3") as mock_boto3, \
                patch("metadata_export.threading.Thread") as thread_cls, \
                patch("metadata_export.notify_data_sync_started") as notify, \
                patch("metadata_export.get_uuid_str", return_value="sync-1"), \
                patch("metadata_export.current_datetime", return_value=NOW):
            client = _mock_datasync_client()
            mock_boto3.client.return_value = client
            export_metadata.transfer_s3_obj(
                "bucket", "src/folder", "dest-bucket", "dest/folder", tags, sync_type=DATA_SYNC_TYPE_FILE,
            )

        assert _aws_methods(client) == [
            "create_location_s3", "create_location_s3", "create_task", "start_task_execution",
        ]
        create_task_kwargs = client.create_task.call_args.kwargs
        assert create_task_kwargs["Options"]["VerifyMode"] == "ONLY_FILES_TRANSFERRED"
        assert create_task_kwargs["SourceLocationArn"] == "src-loc"
        assert create_task_kwargs["Name"] == "Data_Hub_SyncTask-dev-sync-1"
        assert create_task_kwargs["Tags"] == tags
        for call in client.create_location_s3.call_args_list:
            assert call.kwargs["Tags"] == tags
        thread_cls.assert_not_called()
        notify.assert_called_once()
        mongo_dao.insert_data_sync.assert_called_once()
        assert mongo_dao.insert_data_sync.call_args.args[4] == DATA_SYNC_STATUS_IN_PROGRESS
        assert mongo_dao.insert_data_sync.call_args.args[5] == "sync-1"

    def test_untracked_transfer_uses_tier_only_task_name(self):
        """With sync_type omitted, the task name is tier-only, nothing is inserted, and the untracked monitor thread is started."""
        export_metadata, mongo_dao = _make_export_metadata()
        client, thread_cls, notify = self._run(export_metadata, sync_type=None)

        assert client.create_task.call_args.kwargs["Name"] == "Data_Hub_SyncTask-dev"
        mongo_dao.insert_data_sync.assert_not_called()
        assert thread_cls.call_args.kwargs["target"] == monitor_datasync_task
        notify.assert_not_called()

    def test_insert_error_still_runs_the_transfer_and_logs_untracked(self):
        """When insert returns error after retries, the same AWS create/start calls still run, no recovery thread starts, and an untracked-transfer line is logged."""
        export_metadata, mongo_dao = _make_export_metadata()
        mongo_dao.insert_data_sync.return_value = DATA_SYNC_WRITE_ERROR
        with patch("metadata_export.boto3") as mock_boto3, \
                patch("metadata_export.threading.Thread") as thread_cls, \
                patch("metadata_export.notify_data_sync_started") as notify, \
                patch("metadata_export.get_uuid_str", return_value="sync-1"), \
                patch("metadata_export.current_datetime", return_value=NOW), \
                patch("metadata_export.time.sleep"):
            client = _mock_datasync_client()
            mock_boto3.client.return_value = client
            export_metadata.transfer_s3_obj(
                "bucket", "src/folder", "dest-bucket", "dest/folder", [], sync_type=DATA_SYNC_TYPE_FILE,
            )

        assert _aws_methods(client) == [
            "create_location_s3", "create_location_s3", "create_task", "start_task_execution",
        ]
        notify.assert_not_called()
        thread_cls.assert_not_called()
        assert mongo_dao.insert_data_sync.call_count == DATA_SYNC_WRITE_MAX_ATTEMPTS
        client.delete_task.assert_not_called()
        client.delete_location.assert_not_called()
        assert any(
            DATA_SYNC_LOG_TRACKING_FAILED in str(call) and "untracked transfer" in str(call)
            for call in export_metadata.log.error.call_args_list
        )

    def test_insert_exception_still_runs_the_transfer(self):
        """An insert exception is retried then logged; start_task_execution still runs and no recovery thread starts."""
        export_metadata, mongo_dao = _make_export_metadata()
        mongo_dao.insert_data_sync.side_effect = RuntimeError("down")
        with patch("metadata_export.boto3") as mock_boto3, \
                patch("metadata_export.threading.Thread") as thread_cls, \
                patch("metadata_export.get_uuid_str", return_value="sync-1"), \
                patch("metadata_export.current_datetime", return_value=NOW), \
                patch("metadata_export.time.sleep"):
            client = _mock_datasync_client()
            mock_boto3.client.return_value = client
            export_metadata.transfer_s3_obj(
                "bucket", "src/folder", "dest-bucket", "dest/folder", [], sync_type=DATA_SYNC_TYPE_FILE,
            )

        assert "start_task_execution" in _aws_methods(client)
        thread_cls.assert_not_called()
        assert mongo_dao.insert_data_sync.call_count == DATA_SYNC_WRITE_MAX_ATTEMPTS

    def test_pre_start_error_records_failed_and_deletes_nothing(self):
        """create_task raising InvalidRequestException marks the record Failed with rollupPending and no cleanupAfter, and does not delete locations or start the execution."""
        export_metadata, mongo_dao = _make_export_metadata()
        with patch("metadata_export.boto3") as mock_boto3, \
                patch("metadata_export.threading.Thread"), \
                patch("metadata_export.get_uuid_str", return_value="sync-1"), \
                patch("metadata_export.current_datetime", return_value=NOW):
            client = _mock_datasync_client()
            client.create_task.side_effect = ClientError(
                {"Error": {"Code": "InvalidRequestException", "Message": "boom"}},
                "CreateTask",
            )
            mock_boto3.client.return_value = client
            export_metadata.transfer_s3_obj(
                "bucket", "src/folder", "dest-bucket", "dest/folder", [], sync_type=DATA_SYNC_TYPE_METADATA,
            )

        client.delete_task.assert_not_called()
        client.delete_location.assert_not_called()
        client.start_task_execution.assert_not_called()
        failed_update = [
            call for call in mongo_dao.update_data_sync.call_args_list
            if call.args and call.args[1].get(STATUS) == DATA_SYNC_STATUS_FAILED
        ]
        assert failed_update
        assert DATA_SYNC_CLEANUP_AFTER not in failed_update[0].args[1]
        assert DATA_SYNC_ROLLUP_PENDING in failed_update[0].args[1]
        export_metadata.log.error.assert_any_call(
            f"{DATA_SYNC_LOG_TRANSFER_FAILED} create_task boom "
            f"submissionID={SUBMISSION_ID_VAL} type={DATA_SYNC_TYPE_METADATA} dataSyncID=sync-1 "
            f"sourceLocationArn=src-loc destinationLocationArn=dest-loc"
        )


class TestTrackRetry:
    def test_retries_error_outcome_then_succeeds(self):
        """An error outcome is retried with the configured delay until a later attempt returns applied."""
        log = MagicMock()
        sleeps = []
        fn = MagicMock(side_effect=[DATA_SYNC_WRITE_ERROR, DATA_SYNC_WRITE_ERROR, DATA_SYNC_WRITE_APPLIED])
        fn.__name__ = "insert_data_sync"

        outcome = _track(log, fn, sleep_fn=lambda s: sleeps.append(s))

        assert outcome == DATA_SYNC_WRITE_APPLIED
        assert fn.call_count == 3
        assert sleeps == [DATA_SYNC_WRITE_RETRY_DELAY_SECONDS, DATA_SYNC_WRITE_RETRY_DELAY_SECONDS]

    def test_retries_exception_then_returns_error(self):
        """Raised exceptions are retried and become WRITE_ERROR after all attempts fail."""
        log = MagicMock()
        sleeps = []
        fn = MagicMock(side_effect=RuntimeError("down"))
        fn.__name__ = "update_data_sync"

        outcome = _track(log, fn, sleep_fn=lambda s: sleeps.append(s))

        assert outcome == DATA_SYNC_WRITE_ERROR
        assert fn.call_count == DATA_SYNC_WRITE_MAX_ATTEMPTS
        assert sleeps == [DATA_SYNC_WRITE_RETRY_DELAY_SECONDS] * (DATA_SYNC_WRITE_MAX_ATTEMPTS - 1)
        assert any("failed after" in str(call) for call in log.error.call_args_list)

    def test_does_not_retry_stale_outcome(self):
        """A stale outcome is returned immediately without sleeping or retrying."""
        log = MagicMock()
        sleeps = []
        fn = MagicMock(return_value=DATA_SYNC_WRITE_STALE)
        fn.__name__ = "update_data_sync"

        outcome = _track(log, fn, sleep_fn=lambda s: sleeps.append(s))

        assert outcome == DATA_SYNC_WRITE_STALE
        assert fn.call_count == 1
        assert sleeps == []


class TestMonitorPrecedence:
    def test_failed_list_add_blocks_deletion(self):
        """A list-add write error stops the monitor before describe or delete and logs that cleanup is deferred."""
        mongo_dao = MagicMock()
        mongo_dao.add_active_submission_data_sync.return_value = DATA_SYNC_WRITE_ERROR
        datasync = MagicMock()
        log = MagicMock()
        record = _record(**{DATA_SYNC_LIST_PENDING: True, DATA_SYNC_CLEANUP_AFTER: NOW - timedelta(minutes=1)})

        _monitor_data_sync(datasync, mongo_dao, log, record)

        datasync.delete_task.assert_not_called()
        datasync.delete_location.assert_not_called()
        datasync.describe_task_execution.assert_not_called()
        log.error.assert_any_call(
            f"{DATA_SYNC_LOG_CLEANUP_DEFERRED} submissionID={SUBMISSION_ID_VAL} type={DATA_SYNC_TYPE_FILE} "
            f"dataSyncID=sync-1 taskArn=task-arn-1 taskExecutionArn=exec-arn-1 "
            f"sourceLocationArn=src-loc destinationLocationArn=dest-loc"
        )

    def test_finish_error_blocks_deletion(self):
        """A failed submission finish write blocks AWS deletion even when cleanupAfter is already due."""
        mongo_dao = MagicMock()
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_ERROR
        datasync = MagicMock()
        log = MagicMock()
        record = _record(**{
            STATUS: DATA_SYNC_STATUS_SUCCEEDED,
            DATA_SYNC_ROLLUP_PENDING: True,
            DATA_SYNC_CLEANUP_AFTER: NOW - timedelta(minutes=1),
        })

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, log, record)

        datasync.delete_task.assert_not_called()
        assert any(DATA_SYNC_LOG_CLEANUP_DEFERRED in str(call) for call in log.error.call_args_list)

    def test_delete_failure_does_not_change_tracking(self):
        """delete_task raising after a successful claim writes cleanupError, leaves cleanedAt unset, keeps Succeeded, and logs manual cleanup needed."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        datasync.delete_task.side_effect = RuntimeError("denied")
        log = MagicMock()
        record = _record(**{
            STATUS: DATA_SYNC_STATUS_SUCCEEDED,
            DATA_SYNC_CLEANUP_AFTER: NOW - timedelta(minutes=1),
        })
        mongo_dao.find_data_sync_by_id.return_value = dict(record)

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, log, record)

        # Claim + cleanupError; cleanedAt must not be written after delete failure.
        assert mongo_dao.update_data_sync.call_count == 2
        claim = mongo_dao.update_data_sync.call_args_list[0]
        assert DATA_SYNC_CLEANUP_STARTED_AT in claim.args[1]
        assert DATA_SYNC_CLEANED_AT not in (claim.args[1] or {})
        error_write = mongo_dao.update_data_sync.call_args_list[1]
        assert DATA_SYNC_CLEANUP_ERROR in error_write.args[1]
        for call in mongo_dao.update_data_sync.call_args_list:
            set_fields = call.args[1] if len(call.args) > 1 else None
            assert not (isinstance(set_fields, dict) and DATA_SYNC_CLEANED_AT in set_fields)
        mongo_dao.finish_submission_data_sync.assert_not_called()
        assert record[STATUS] == DATA_SYNC_STATUS_SUCCEEDED
        assert any(DATA_SYNC_LOG_CLEANUP_FAILED in str(call) for call in log.error.call_args_list)
        assert any("manual cleanup needed" in str(call) for call in log.error.call_args_list)

    def test_aws_error_records_detail_before_cleanup_is_due(self):
        """An ERROR execution is finalized Failed with the AWS error detail and a future cleanupAfter, so delete is not called yet."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {
            "Status": "ERROR",
            "Result": {"ErrorCode": "NoSuchBucket", "ErrorDetail": "missing bucket"},
        }
        log = MagicMock()
        record = _record()

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, log, record)

        datasync.delete_task.assert_not_called()
        finalize = _finalize_set_fields(mongo_dao)
        assert finalize[STATUS] == DATA_SYNC_STATUS_FAILED
        assert finalize[DATA_SYNC_LAST_ERROR] == "NoSuchBucket: missing bucket"
        assert finalize[DATA_SYNC_ROLLUP_PENDING] is True
        assert DATA_SYNC_CLEANUP_AFTER in finalize
        assert any(DATA_SYNC_LOG_EXECUTION_FAILED in str(call) for call in log.error.call_args_list)

    def test_success_sets_cleanup_after_and_does_not_delete_yet(self):
        """A SUCCESS execution is finalized Succeeded, lastError is unset, cleanupAfter is scheduled, and delete is not called in the same pass."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "SUCCESS"}
        record = _record()

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, MagicMock(), record)

        datasync.delete_task.assert_not_called()
        finalize = _finalize_set_fields(mongo_dao)
        assert DATA_SYNC_CLEANUP_AFTER in finalize
        assert DATA_SYNC_LAST_ERROR not in finalize
        assert mongo_dao.finish_submission_data_sync.call_args.args[3] == DATA_SYNC_STATUS_SUCCEEDED
        success_call = next(
            call for call in mongo_dao.update_data_sync.call_args_list
            if len(call.args) > 1 and call.args[1].get(STATUS) == DATA_SYNC_STATUS_SUCCEEDED
        )
        assert DATA_SYNC_LAST_ERROR in success_call.kwargs.get("unset_fields", [])

    def test_confirmed_missing_execution_is_stale_without_cleanup(self):
        """A not-found describe finalizes the record as Stale with no cleanupAfter and logs for manual cleanup."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        datasync.describe_task_execution.side_effect = _not_found()
        datasync_log = MagicMock()
        record = _record()

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, datasync_log, record)

        datasync.delete_task.assert_not_called()
        finalize = _finalize_set_fields(mongo_dao)
        assert finalize[STATUS] == DATA_SYNC_STATUS_STALE
        assert finalize[DATA_SYNC_LAST_ERROR] == DATA_SYNC_LAST_ERROR_STALE_NOT_FOUND
        assert DATA_SYNC_CLEANUP_AFTER not in finalize
        assert any(DATA_SYNC_LOG_STALE in str(call) and "manual cleanup needed" in str(call)
                   for call in datasync_log.error.call_args_list)

    def test_unobservable_execution_is_stale_and_logged(self):
        """A record with no task or execution ARN is finalized Stale with no cleanupAfter and logged for manual cleanup."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        log = MagicMock()
        record = _record(**{DATA_SYNC_TASK_ARN: None, DATA_SYNC_TASK_EXECUTION_ARN: None})

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(MagicMock(), mongo_dao, log, record)

        finalize = _finalize_set_fields(mongo_dao)
        assert finalize[STATUS] == DATA_SYNC_STATUS_STALE
        assert finalize[DATA_SYNC_LAST_ERROR] == DATA_SYNC_LAST_ERROR_STALE_NO_TASK
        assert DATA_SYNC_CLEANUP_AFTER not in finalize
        assert any(DATA_SYNC_LOG_STALE in str(call) and "manual cleanup needed" in str(call)
                   for call in log.error.call_args_list)

    def test_stale_finish_logs_info_not_error(self):
        """A stale finish (submission already finished) is logged at info and does not log an error."""
        mongo_dao = MagicMock()
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_STALE
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        log = MagicMock()
        record = _record(**{STATUS: DATA_SYNC_STATUS_SUCCEEDED, DATA_SYNC_ROLLUP_PENDING: True})

        _monitor_data_sync(MagicMock(), mongo_dao, log, record)

        log.error.assert_not_called()
        assert any("already finished" in str(call) for call in log.info.call_args_list)

    def test_cleanup_runs_when_due_and_treats_not_found_as_done(self):
        """A due terminal record claims cleanup, treats not-found deletes as done, then writes cleanedAt and unsets cleanupAfter."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        datasync.delete_task.side_effect = _not_found()
        record = _record(**{
            STATUS: DATA_SYNC_STATUS_SUCCEEDED,
            DATA_SYNC_CLEANUP_AFTER: NOW - timedelta(seconds=1),
        })
        mongo_dao.find_data_sync_by_id.return_value = dict(record)

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, MagicMock(), record)

        datasync.delete_task.assert_called_once()
        assert datasync.delete_location.call_count == 2
        claim = mongo_dao.update_data_sync.call_args_list[0]
        assert DATA_SYNC_CLEANUP_STARTED_AT in claim.args[1]
        done = mongo_dao.update_data_sync.call_args_list[1]
        assert done.args[1][DATA_SYNC_CLEANED_AT] == NOW
        assert DATA_SYNC_CLEANUP_AFTER in done.kwargs["unset_fields"]

    def test_monitor_does_not_insert_a_record(self):
        """The monitor only adds the existing id to the submission active list; it never inserts a dataSync document."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.add_active_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "SUCCESS"}
        record = _record(**{DATA_SYNC_LIST_PENDING: True})

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, MagicMock(), record)

        mongo_dao.insert_data_sync.assert_not_called()
        mongo_dao.add_active_submission_data_sync.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_FILE, "sync-1",
        )

    def test_per_record_exception_does_not_stop_the_pass(self):
        """A raised exception on one record is logged and the pass continues so the next record is still processed."""
        mongo_dao = MagicMock()
        broken = _record()
        other = _record(**{ID: "sync-2"})
        mongo_dao.find_unfinished_data_syncs.return_value = [broken, other]
        log = MagicMock()
        seen = []

        def explode(datasync, mongo_dao, log, record):
            seen.append(record[ID])
            if record[ID] == "sync-1":
                raise RuntimeError("bad record")
            record[STATUS] = DATA_SYNC_STATUS_SUCCEEDED
            record[DATA_SYNC_ROLLUP_PENDING] = False
            record.pop(DATA_SYNC_CLEANUP_AFTER, None)

        with patch("metadata_export._monitor_data_sync", side_effect=explode):
            count = _run_data_sync_monitor_pass(mongo_dao, log, datasync=MagicMock())

        assert seen == ["sync-1", "sync-2"]
        assert count == 1
        log.exception.assert_called()

    def test_stale_list_add_clears_flags_and_allows_cleanup(self):
        """A stale list add (submission gone) clears both pending flags and still allows a due cleanup delete."""
        mongo_dao = MagicMock()
        mongo_dao.add_active_submission_data_sync.return_value = DATA_SYNC_WRITE_STALE
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        log = MagicMock()
        record = _record(**{
            STATUS: DATA_SYNC_STATUS_SUCCEEDED,
            DATA_SYNC_LIST_PENDING: True,
            DATA_SYNC_ROLLUP_PENDING: True,
            DATA_SYNC_CLEANUP_AFTER: NOW - timedelta(minutes=1),
        })
        mongo_dao.find_data_sync_by_id.return_value = {
            ID: "sync-1",
            STATUS: DATA_SYNC_STATUS_SUCCEEDED,
        }

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, log, record)

        assert record[DATA_SYNC_LIST_PENDING] is False
        assert record[DATA_SYNC_ROLLUP_PENDING] is False
        datasync.delete_task.assert_called_once()
        assert any("DataSync submission not found" in str(call) for call in log.error.call_args_list)
        mongo_dao.finish_submission_data_sync.assert_not_called()

    def test_stale_finalize_does_not_finish_or_overwrite(self):
        """A finalize whose In Progress guard misses leaves the in-memory status unchanged and does not finish the submission."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.side_effect = [
            DATA_SYNC_WRITE_APPLIED,  # poll claim
            DATA_SYNC_WRITE_STALE,  # finalize guard miss
        ]
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "SUCCESS"}
        log = MagicMock()
        record = _record()

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, log, record)

        assert record[STATUS] == DATA_SYNC_STATUS_IN_PROGRESS
        mongo_dao.finish_submission_data_sync.assert_not_called()
        finalize = mongo_dao.update_data_sync.call_args_list[1]
        assert finalize.kwargs["match_fields"] == {STATUS: DATA_SYNC_STATUS_IN_PROGRESS}
        assert any("already finalized" in str(call) for call in log.info.call_args_list)

    def test_recent_poll_claim_skips_describe(self):
        """A poll claim that returns stale because lastPolledAt is inside the claim window skips describe_task_execution."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_STALE
        datasync = MagicMock()
        record = _record(**{DATA_SYNC_LAST_POLLED_AT: NOW - timedelta(seconds=5)})

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, MagicMock(), record)

        datasync.describe_task_execution.assert_not_called()
        claim = mongo_dao.update_data_sync.call_args
        assert claim.args[1][DATA_SYNC_LAST_POLLED_AT] == NOW
        assert claim.kwargs["match_fields"] == {
            STATUS: DATA_SYNC_STATUS_IN_PROGRESS,
            "$or": [
                {DATA_SYNC_LAST_POLLED_AT: {"$exists": False}},
                {DATA_SYNC_LAST_POLLED_AT: {"$lt": NOW - timedelta(seconds=DATA_SYNC_POLL_CLAIM_SECONDS)}},
            ],
        }

    def test_finish_forwards_failed_record_status(self):
        """Finishing a Failed record forwards Failed to finish_submission_data_sync rather than Succeeded."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        record = _record(**{
            STATUS: DATA_SYNC_STATUS_FAILED,
            DATA_SYNC_LIST_PENDING: False,
            DATA_SYNC_ROLLUP_PENDING: True,
        })

        _monitor_data_sync(MagicMock(), mongo_dao, MagicMock(), record)

        assert mongo_dao.finish_submission_data_sync.call_args.args[3] == DATA_SYNC_STATUS_FAILED

    def test_stored_non_final_status_skips_delete(self):
        """A due in-memory snapshot does not delete the task when the stored status is not Succeeded or Failed."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.find_data_sync_by_id.return_value = {ID: "sync-1", STATUS: DATA_SYNC_STATUS_STALE}
        datasync = MagicMock()
        log = MagicMock()
        record = _record(**{
            STATUS: DATA_SYNC_STATUS_SUCCEEDED,
            DATA_SYNC_CLEANUP_AFTER: NOW - timedelta(minutes=1),
        })

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, log, record)

        datasync.delete_task.assert_not_called()
        datasync.delete_location.assert_not_called()
        assert any("skipped delete" in str(call) for call in log.error.call_args_list)


class TestMonitorState:
    def test_next_state(self):
        """A positive unfinished count selects the active interval; zero selects waiting; None means the query failed and the state is unchanged."""
        assert _next_data_sync_monitor_state(2) == DATA_SYNC_MONITOR_STATE_ACTIVE
        assert _next_data_sync_monitor_state(0) == DATA_SYNC_MONITOR_STATE_WAITING
        assert _next_data_sync_monitor_state(None) is None

    def test_query_failure_keeps_the_active_interval(self):
        """A monitor pass that returns None (query failure) waits the short active interval."""
        mongo_dao = MagicMock()
        waits = []

        def wait(interval):
            waits.append(interval)
            raise RuntimeError("stop")

        with patch("metadata_export._run_data_sync_monitor_pass", return_value=None), \
                patch.object(metadata_export._data_sync_wake_event, "wait", wait):
            try:
                data_sync_monitor_loop(mongo_dao, MagicMock())
            except RuntimeError:
                pass

        assert waits == [DATA_SYNC_MONITOR_ACTIVE_INTERVAL_SECONDS]

    def test_pass_exception_keeps_the_active_interval(self):
        """An exception from a monitor pass is logged as tracking failed and the loop still waits the active interval."""
        waits = []
        log = MagicMock()

        def wait(interval):
            waits.append(interval)
            raise RuntimeError("stop")

        with patch("metadata_export._run_data_sync_monitor_pass", side_effect=RuntimeError("boom")), \
                patch.object(metadata_export._data_sync_wake_event, "wait", wait):
            try:
                data_sync_monitor_loop(MagicMock(), log)
            except RuntimeError:
                pass

        assert waits == [DATA_SYNC_MONITOR_ACTIVE_INTERVAL_SECONDS]
        assert any(DATA_SYNC_LOG_TRACKING_FAILED in str(call) and "monitor pass" in str(call)
                   for call in log.error.call_args_list)

    def test_empty_pass_waits_the_waiting_interval(self):
        """A pass that finds zero unfinished records waits the longer waiting interval."""
        waits = []

        def wait(interval):
            waits.append(interval)
            raise RuntimeError("stop")

        with patch("metadata_export._run_data_sync_monitor_pass", return_value=0), \
                patch.object(metadata_export._data_sync_wake_event, "wait", wait):
            try:
                data_sync_monitor_loop(MagicMock(), MagicMock())
            except RuntimeError:
                pass

        assert waits == [DATA_SYNC_MONITOR_WAITING_INTERVAL_SECONDS]

    def test_notify_wakes_a_waiting_monitor_immediately(self):
        """notify_data_sync_started sets the wake event so a waiting monitor returns from wait immediately."""
        metadata_export._data_sync_wake_event.clear()
        metadata_export.notify_data_sync_started()
        assert metadata_export._data_sync_wake_event.wait(0) is True
        metadata_export._data_sync_wake_event.clear()


class TestCleanupClaim:
    def test_stale_cleanup_claim_skips_delete(self):
        """When the cleanup claim returns stale (record changed since the snapshot), delete is skipped and a stale-claim info line is logged."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_STALE
        datasync = MagicMock()
        log = MagicMock()
        record = _record(**{
            STATUS: DATA_SYNC_STATUS_FAILED,
            DATA_SYNC_LAST_ERROR: DATA_SYNC_LAST_ERROR_NOT_STARTED,
            DATA_SYNC_CLEANUP_AFTER: NOW - timedelta(minutes=1),
            DATA_SYNC_ROLLUP_PENDING: False,
            DATA_SYNC_LIST_PENDING: False,
        })

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, log, record)

        datasync.delete_task.assert_not_called()
        datasync.delete_location.assert_not_called()
        assert any("cleanup claim stale" in str(call) for call in log.info.call_args_list)


class TestResolveTaskExecutionArn:
    def _paginator(self, datasync, executions):
        paginator = MagicMock()
        paginator.paginate.return_value = [{"TaskExecutions": executions}]
        datasync.get_paginator.return_value = paginator

    def test_resolves_and_persists_execution_arn_then_polls(self):
        """With only a task ARN, the monitor lists executions, saves the execution ARN, then describes that execution and finalizes success."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        self._paginator(datasync, [{"TaskExecutionArn": "exec-resolved"}])
        datasync.describe_task_execution.return_value = {"Status": "SUCCESS"}
        record = _record(**{DATA_SYNC_TASK_EXECUTION_ARN: None})

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, MagicMock(), record)

        assert record[DATA_SYNC_TASK_EXECUTION_ARN] == "exec-resolved"
        persist = next(
            call for call in mongo_dao.update_data_sync.call_args_list
            if isinstance(call.args[1] if len(call.args) > 1 else None, dict)
            and call.args[1].get(DATA_SYNC_TASK_EXECUTION_ARN) == "exec-resolved"
        )
        assert persist.args[0] == "sync-1"
        datasync.describe_task_execution.assert_called_with(TaskExecutionArn="exec-resolved")
        finalize = _finalize_set_fields(mongo_dao)
        assert finalize[STATUS] == DATA_SYNC_STATUS_SUCCEEDED

    def test_zero_executions_past_grace_finalizes_not_started(self):
        """An empty execution list past the start grace finalizes Failed as not-started and schedules cleanup."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        self._paginator(datasync, [])
        record = _record(**{DATA_SYNC_TASK_EXECUTION_ARN: None})

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, MagicMock(), record)

        finalize = _finalize_set_fields(mongo_dao)
        assert finalize[STATUS] == DATA_SYNC_STATUS_FAILED
        assert finalize[DATA_SYNC_LAST_ERROR] == DATA_SYNC_LAST_ERROR_NOT_STARTED
        assert DATA_SYNC_CLEANUP_AFTER in finalize

    def test_zero_executions_inside_grace_stays_in_progress(self):
        """A task with no execution yet, still inside the start grace period, stays In Progress and is not scheduled for cleanup."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        self._paginator(datasync, [])
        record = _record(**{
            DATA_SYNC_TASK_EXECUTION_ARN: None,
            DATA_SYNC_START_TIME: NOW - timedelta(seconds=DATA_SYNC_START_GRACE_SECONDS - 60),
        })

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, MagicMock(), record)

        assert record[STATUS] == DATA_SYNC_STATUS_IN_PROGRESS
        assert _finalize_set_fields(mongo_dao) is None
        for call in mongo_dao.update_data_sync.call_args_list:
            set_fields = call.args[1] if len(call.args) > 1 else None
            assert not (isinstance(set_fields, dict) and DATA_SYNC_CLEANUP_AFTER in set_fields)
            assert not (isinstance(set_fields, dict) and set_fields.get(STATUS) == DATA_SYNC_STATUS_FAILED)
        datasync.delete_task.assert_not_called()

    def test_multiple_executions_selects_latest_start_time(self):
        """When list_task_executions returns more than one execution, each is described and the latest StartTime is persisted."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        self._paginator(datasync, [
            {"TaskExecutionArn": "exec-old"},
            {"TaskExecutionArn": "exec-new"},
        ])
        datasync.describe_task_execution.side_effect = [
            {"StartTime": NOW - timedelta(hours=2)},
            {"StartTime": NOW - timedelta(minutes=5)},
        ]
        log = MagicMock()
        record = _record(**{DATA_SYNC_TASK_EXECUTION_ARN: None})

        arn = _resolve_task_execution_arn(datasync, mongo_dao, log, record)

        assert arn == "exec-new"
        assert record[DATA_SYNC_TASK_EXECUTION_ARN] == "exec-new"
        assert any("2 executions" in str(call) for call in log.warning.call_args_list)

    def test_transient_list_error_sets_observation_error(self):
        """A transient list_task_executions error records lastError and observationErrorSince and does not finalize the record."""
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        paginator = MagicMock()
        paginator.paginate.side_effect = ClientError(
            {"Error": {"Code": "InternalException", "Message": "temporary"}},
            "ListTaskExecutions",
        )
        datasync.get_paginator.return_value = paginator
        record = _record(**{DATA_SYNC_TASK_EXECUTION_ARN: None})

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, MagicMock(), record)

        assert _finalize_set_fields(mongo_dao) is None
        obs = next(
            call for call in mongo_dao.update_data_sync.call_args_list
            if isinstance(call.args[1] if len(call.args) > 1 else None, dict)
            and DATA_SYNC_OBSERVATION_ERROR_SINCE in call.args[1]
        )
        assert obs.args[1][DATA_SYNC_LAST_ERROR] == "temporary"


class TestClientErrorNotFound:
    def test_resource_not_found_by_code_alone(self):
        """ResourceNotFoundException is not-found from the error code alone, even when the message does not say not found."""
        error = ClientError(
            {"Error": {"Code": "ResourceNotFoundException", "Message": "completely different wording"}},
            "DeleteTask",
        )
        assert _client_error_not_found(error) is True

    def test_invalid_request_not_found_message_still_matches(self):
        """InvalidRequestException counts as not-found only when the message contains a not-found phrase."""
        error = ClientError(
            {"Error": {"Code": "InvalidRequestException", "Message": "Task execution was not found."}},
            "DescribeTaskExecution",
        )
        assert _client_error_not_found(error) is True

    def test_invalid_request_message_change_still_matches_with_structured_code(self):
        """InvalidRequestException with a structured datasyncErrorCode of ResourceNotFoundException is not-found even if the message wording changes."""
        error = ClientError(
            {
                "Error": {
                    "Code": "InvalidRequestException",
                    "Message": "No such task resource available.",
                    "datasyncErrorCode": "ResourceNotFoundException",
                }
            },
            "DeleteTask",
        )
        assert _client_error_not_found(error) is True

    def test_genuinely_invalid_request_is_not_not_found(self):
        """InvalidRequestException for a bad parameter is not treated as not-found, so cleanup will not ignore a real failure."""
        error = ClientError(
            {"Error": {"Code": "InvalidRequestException", "Message": "Invalid parameter: TaskArn"}},
            "DeleteTask",
        )
        assert _client_error_not_found(error) is False

    def test_does_not_exist_wording_matches(self):
        """InvalidRequestException whose message says the resource does not exist is treated as not-found."""
        error = ClientError(
            {"Error": {"Code": "InvalidRequestException", "Message": "The specified location does not exist"}},
            "DeleteLocation",
        )
        assert _client_error_not_found(error) is True


class TestOriginalMonitor:
    def test_success_deletes_verified_source_files_then_task_and_locations(self):
        """After SUCCESS, the untracked monitor deletes only keys verification returns, waits 5 minutes, then deletes the task and both locations."""
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "SUCCESS"}
        log = MagicMock()
        source = {"LocationArn": "src-loc"}
        dest = {"LocationArn": "dest-loc"}
        file_keys = ["to_be_deleted/sub-1/study-1/a.txt"]

        with patch("metadata_export.time.sleep") as sleep, \
                patch("metadata_export.delete_files_from_s3") as delete_files, \
                patch("metadata_export._verified_source_keys_to_delete", return_value=file_keys) as verify, \
                patch("metadata_export.S3Service") as s3_cls:
            s3_cls.return_value = MagicMock()
            monitor_datasync_task(
                "exec-arn-1", "task-arn-1", datasync, source, dest, log, "bucket", file_keys,
                dest_bucket="bucket", dest_file_folder="study-1",
                source_file_folder="to_be_deleted/sub-1/study-1",
            )

        verify.assert_called_once()
        delete_files.assert_called_once_with("bucket", file_keys, log)
        datasync.delete_task.assert_called_once_with(TaskArn="task-arn-1")
        assert datasync.delete_location.call_count == 2
        assert sleep.call_args_list[0].args[0] == 300

    def test_error_does_not_delete_source_files(self):
        """An ERROR execution skips verification and source deletion."""
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "ERROR"}
        log = MagicMock()

        with patch("metadata_export.time.sleep"), \
                patch("metadata_export.delete_files_from_s3") as delete_files, \
                patch("metadata_export._verified_source_keys_to_delete") as verify:
            monitor_datasync_task(
                "exec-arn-1", "task-arn-1", datasync, {"LocationArn": "src"}, {"LocationArn": "dest"},
                log, "bucket", ["a.txt"], dest_bucket="bucket", dest_file_folder="study-1",
                source_file_folder="to_be_deleted/sub-1/study-1",
            )

        verify.assert_not_called()
        delete_files.assert_not_called()

    def test_unverified_destination_skips_source_delete(self):
        """SUCCESS with no verified keys does not delete source objects and logs how many were skipped."""
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "SUCCESS"}
        log = MagicMock()
        file_keys = ["to_be_deleted/sub-1/study-1/a.txt"]

        with patch("metadata_export.time.sleep"), \
                patch("metadata_export.delete_files_from_s3") as delete_files, \
                patch("metadata_export._verified_source_keys_to_delete", return_value=[]) as verify, \
                patch("metadata_export.S3Service") as s3_cls:
            s3_cls.return_value = MagicMock()
            monitor_datasync_task(
                "exec-arn-1", "task-arn-1", datasync, {"LocationArn": "src"}, {"LocationArn": "dest"},
                log, "bucket", file_keys, dest_bucket="bucket", dest_file_folder="study-1",
                source_file_folder="to_be_deleted/sub-1/study-1",
            )

        verify.assert_called_once()
        delete_files.assert_not_called()
        assert any("Skipped deleting" in str(call) for call in log.error.call_args_list)


class TestVerifiedSourceDelete:
    def test_destination_key_maps_nested_relative_path(self):
        """A nested source key under the source folder maps to the same relative path under the destination folder."""
        assert _destination_key_for_source(
            "to_be_deleted/sub-1/study-1/nested/a.txt",
            "to_be_deleted/sub-1/study-1",
            "study-1",
        ) == "study-1/nested/a.txt"

    def test_verified_keys_require_matching_size(self):
        """Only keys whose destination head matches size are returned; size mismatch and a missing destination are logged and excluded."""
        s3 = MagicMock()
        s3.head_object.side_effect = [
            {"ContentLength": 10, "ETag": '"abc"'},
            {"ContentLength": 10, "ETag": '"abc"'},
            {"ContentLength": 5, "ETag": '"x"'},
            {"ContentLength": 9, "ETag": '"y"'},
            {"ContentLength": 3, "ETag": '"z"'},
            None,
        ]
        log = MagicMock()
        keys = [
            "to_be_deleted/sub-1/study-1/ok.txt",
            "to_be_deleted/sub-1/study-1/mismatch.txt",
            "to_be_deleted/sub-1/study-1/missing.txt",
        ]
        verified = _verified_source_keys_to_delete(
            s3, log, "bucket", keys, "bucket", "study-1", "to_be_deleted/sub-1/study-1",
        )
        assert verified == ["to_be_deleted/sub-1/study-1/ok.txt"]
        assert any("size mismatch" in str(call) for call in log.error.call_args_list)
        assert any("not found" in str(call) for call in log.error.call_args_list)

    def test_multipart_etag_skips_etag_compare_but_keeps_size_match(self):
        """Multipart ETags (containing a dash) are not compared; a matching size is enough to allow deletion."""
        s3 = MagicMock()
        s3.head_object.side_effect = [
            {"ContentLength": 100, "ETag": '"abc-2"'},
            {"ContentLength": 100, "ETag": '"def-2"'},
        ]
        verified = _verified_source_keys_to_delete(
            s3, MagicMock(), "bucket", ["to_be_deleted/sub-1/study-1/big.bin"],
            "bucket", "study-1", "to_be_deleted/sub-1/study-1",
        )
        assert verified == ["to_be_deleted/sub-1/study-1/big.bin"]

    def test_head_object_error_retains_source(self):
        """A head_object error is caught per key, the key is not returned, and the log says the source was retained for manual cleanup."""
        s3 = MagicMock()
        s3.head_object.side_effect = ClientError(
            {"Error": {"Code": "403", "Message": "Forbidden"}},
            "HeadObject",
        )
        log = MagicMock()
        verified = _verified_source_keys_to_delete(
            s3, log, "bucket", ["to_be_deleted/sub-1/study-1/a.txt"],
            "bucket", "study-1", "to_be_deleted/sub-1/study-1",
        )
        assert verified == []
        assert any("source retained; manual cleanup needed" in str(call) for call in log.error.call_args_list)

    def test_etag_mismatch_retains_source(self):
        """A non-multipart ETag mismatch excludes the key and logs that the source was retained."""
        s3 = MagicMock()
        s3.head_object.side_effect = [
            {"ContentLength": 10, "ETag": '"abc"'},
            {"ContentLength": 10, "ETag": '"xyz"'},
        ]
        log = MagicMock()
        verified = _verified_source_keys_to_delete(
            s3, log, "bucket", ["to_be_deleted/sub-1/study-1/a.txt"],
            "bucket", "study-1", "to_be_deleted/sub-1/study-1",
        )
        assert verified == []
        assert any("ETag mismatch" in str(call) and "source retained" in str(call) for call in log.error.call_args_list)


class TestRestoreAndMoveFilters:
    def test_restore_lists_with_trailing_slash_and_builds_relative_includes(self):
        """Restore lists with a trailing slash so sibling prefixes are dropped, then the include filter uses the path relative to that folder."""
        export_metadata, _mongo_dao = _make_export_metadata()
        nested = "to_be_deleted/sub-1/study-1/nested/a.txt"
        sibling = "to_be_deleted/sub-1/study-1-extra/b.txt"
        export_metadata.s3_service.list_objects.return_value = [nested, sibling, "to_be_deleted/sub-1/study-1/"]
        captured = {}

        def capture_transfer(bucket, src_folder, dest_bucket, dest_folder, tags, file_key_list=None, sync_type=None):
            captured["file_key_list"] = file_key_list
            captured["src_folder"] = src_folder
            with patch("metadata_export.boto3") as mock_boto3, \
                    patch("metadata_export.threading.Thread"):
                client = _mock_datasync_client()
                mock_boto3.client.return_value = client
                ExportMetadata.transfer_s3_obj(
                    export_metadata, bucket, src_folder, dest_bucket, dest_folder, tags, file_key_list, sync_type,
                )
                captured["includes"] = client.create_task.call_args.kwargs.get("Includes")

        with patch.object(export_metadata, "transfer_s3_obj", side_effect=capture_transfer):
            export_metadata.restore_deleted_file()

        export_metadata.s3_service.list_objects.assert_called_once_with(
            "dm-bucket", "to_be_deleted/sub-1/study-1/",
        )
        assert captured["file_key_list"] == [nested]
        assert captured["includes"][0]["Value"] == "/nested/a.txt"

    def test_tracked_transfer_never_starts_source_deleting_monitor(self):
        """A tracked transfer inserts a dataSync record and does not start the untracked monitor that deletes source keys."""
        export_metadata, mongo_dao = _make_export_metadata()
        with patch("metadata_export.boto3") as mock_boto3, \
                patch("metadata_export.threading.Thread") as thread_cls, \
                patch("metadata_export.notify_data_sync_started"), \
                patch("metadata_export.get_uuid_str", return_value="sync-1"), \
                patch("metadata_export.current_datetime", return_value=NOW), \
                patch("metadata_export.start_monitoring_task") as start_monitor:
            client = _mock_datasync_client()
            mock_boto3.client.return_value = client
            export_metadata.transfer_s3_obj(
                "bucket", "src/folder", "dest-bucket", "dest/folder", [], sync_type=DATA_SYNC_TYPE_FILE,
            )

        start_monitor.assert_not_called()
        thread_cls.assert_not_called()
        mongo_dao.insert_data_sync.assert_called_once()


class TestMonitorIndependentDeletes:
    def test_task_delete_failure_still_deletes_locations(self):
        """If delete_task fails, the untracked monitor still attempts both location deletes and logs manual cleanup needed."""
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "ERROR"}
        datasync.delete_task.side_effect = RuntimeError("task denied")
        log = MagicMock()
        source = {"LocationArn": "src-loc"}
        dest = {"LocationArn": "dest-loc"}

        with patch("metadata_export.time.sleep"):
            monitor_datasync_task(
                "exec-arn-1", "task-arn-1", datasync, source, dest, log, "bucket", None,
            )

        datasync.delete_task.assert_called_once()
        assert datasync.delete_location.call_count == 2
        assert any("manual cleanup needed" in str(call) for call in log.error.call_args_list)

    def test_head_object_403_skips_key_and_still_cleans_task(self):
        """A 403 from head_object keeps the source key, and the monitor still deletes the task and both locations."""
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "SUCCESS"}
        log = MagicMock()
        file_keys = ["to_be_deleted/sub-1/study-1/a.txt"]
        s3 = MagicMock()
        s3.head_object.side_effect = ClientError(
            {"Error": {"Code": "403", "Message": "Forbidden"}},
            "HeadObject",
        )

        with patch("metadata_export.time.sleep"), \
                patch("metadata_export.delete_files_from_s3") as delete_files, \
                patch("metadata_export.S3Service", return_value=s3):
            monitor_datasync_task(
                "exec-arn-1", "task-arn-1", datasync,
                {"LocationArn": "src"}, {"LocationArn": "dest"},
                log, "bucket", file_keys, dest_bucket="bucket",
                dest_file_folder="study-1",
                source_file_folder="to_be_deleted/sub-1/study-1",
            )

        delete_files.assert_not_called()
        datasync.delete_task.assert_called_once()
        assert datasync.delete_location.call_count == 2
        assert any("source retained; manual cleanup needed" in str(call) for call in log.error.call_args_list)
