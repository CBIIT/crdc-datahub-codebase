"""Unit tests for DataSync tracking precedence in metadata_export.py."""
import os
import sys
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, "src"))

from botocore.exceptions import ClientError

import metadata_export
from metadata_export import (
    ExportMetadata,
    monitor_datasync_task,
    recover_data_sync_tracking,
    _monitor_data_sync,
    _next_data_sync_monitor_state,
    _run_data_sync_monitor_pass,
    data_sync_monitor_loop,
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
    DATA_SYNC_TASK_ARN,
    DATA_SYNC_TASK_EXECUTION_ARN,
    DATA_SYNC_SOURCE_LOCATION_ARN,
    DATA_SYNC_DEST_LOCATION_ARN,
    DATA_SYNC_LIST_PENDING,
    DATA_SYNC_ROLLUP_PENDING,
    DATA_SYNC_CLEANUP_AFTER,
    DATA_SYNC_LAST_ERROR,
    DATA_SYNC_LAST_POLLED_AT,
    DATA_SYNC_END_TIME,
    DATA_SYNC_START_TIME,
    DATA_SYNC_WRITE_APPLIED,
    DATA_SYNC_WRITE_STALE,
    DATA_SYNC_WRITE_ERROR,
    DATA_SYNC_MONITOR_STATE_ACTIVE,
    DATA_SYNC_MONITOR_STATE_WAITING,
    DATA_SYNC_MONITOR_ACTIVE_INTERVAL_SECONDS,
    DATA_SYNC_MONITOR_WAITING_INTERVAL_SECONDS,
    DATA_SYNC_POLL_CLAIM_SECONDS,
    DATA_SYNC_LAST_ERROR_NOT_OBSERVABLE,
    DATA_SYNC_LAST_ERROR_NOT_STARTED,
    DATA_SYNC_LOG_TRANSFER_FAILED,
    DATA_SYNC_LOG_EXECUTION_FAILED,
    DATA_SYNC_LOG_TRACKING_FAILED,
    DATA_SYNC_LOG_TRACKING_NOT_RECOVERED,
    DATA_SYNC_LOG_CLEANUP_FAILED,
    DATA_SYNC_LOG_CLEANUP_DEFERRED,
    DATA_SYNC_LOG_OUTCOME_UNKNOWN,
)


def _finalize_set_fields(mongo_dao):
    """Return the first update $set that writes a terminal STATUS."""
    for call in mongo_dao.update_data_sync.call_args_list:
        set_fields = call.args[1] if len(call.args) > 1 else None
        if isinstance(set_fields, dict) and set_fields.get(STATUS) in (
            DATA_SYNC_STATUS_SUCCEEDED, DATA_SYNC_STATUS_FAILED,
        ):
            return set_fields
    return None


def _update_without_reopen(default=DATA_SYNC_WRITE_APPLIED, reopen=DATA_SYNC_WRITE_STALE):
    """Side effect that treats early-finalize reopen matches as STALE by default."""
    def side_effect(_data_sync_id, set_fields=None, unset_fields=None, match_fields=None):
        if match_fields and DATA_SYNC_LAST_ERROR in match_fields:
            return reopen
        return default
    return side_effect

SUBMISSION_ID_VAL = "sub-1"
NOW = datetime(2026, 1, 1, 12, 0, 0)


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
        export_metadata, mongo_dao = _make_export_metadata()
        client, thread_cls, notify = self._run(export_metadata)

        assert _aws_methods(client) == [
            "create_location_s3", "create_location_s3", "create_task", "start_task_execution",
        ]
        create_task_kwargs = client.create_task.call_args.kwargs
        assert create_task_kwargs["Options"]["VerifyMode"] == "ONLY_FILES_TRANSFERRED"
        assert create_task_kwargs["SourceLocationArn"] == "src-loc"
        thread_cls.assert_not_called()
        notify.assert_called_once()
        mongo_dao.insert_data_sync.assert_called_once()
        assert mongo_dao.insert_data_sync.call_args.args[4] == DATA_SYNC_STATUS_IN_PROGRESS
        assert mongo_dao.insert_data_sync.call_args.args[5] == "sync-1"

    def test_insert_error_still_runs_the_transfer_and_starts_recovery(self):
        export_metadata, mongo_dao = _make_export_metadata()
        mongo_dao.insert_data_sync.return_value = DATA_SYNC_WRITE_ERROR
        client, thread_cls, notify = self._run(export_metadata)

        assert _aws_methods(client) == [
            "create_location_s3", "create_location_s3", "create_task", "start_task_execution",
        ]
        notify.assert_not_called()
        assert thread_cls.call_args.kwargs["target"] == recover_data_sync_tracking
        client.delete_task.assert_not_called()
        client.delete_location.assert_not_called()

    def test_insert_exception_still_runs_the_transfer(self):
        export_metadata, _mongo_dao = _make_export_metadata()
        export_metadata.mongo_dao.insert_data_sync.side_effect = RuntimeError("down")
        client, thread_cls, _notify = self._run(export_metadata)

        assert "start_task_execution" in _aws_methods(client)
        assert thread_cls.call_args.kwargs["target"] == recover_data_sync_tracking

    def test_untracked_move_uses_the_original_monitor(self):
        export_metadata, mongo_dao = _make_export_metadata()
        _client, thread_cls, notify = self._run(export_metadata, sync_type=None)

        mongo_dao.insert_data_sync.assert_not_called()
        notify.assert_not_called()
        assert thread_cls.call_args.kwargs["target"] == monitor_datasync_task

    def test_pre_start_error_records_failed_and_deletes_nothing(self):
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


class TestMonitorPrecedence:
    def test_failed_list_add_blocks_deletion(self):
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
        mongo_dao = MagicMock()
        datasync = MagicMock()
        datasync.delete_task.side_effect = RuntimeError("denied")
        log = MagicMock()
        record = _record(**{
            STATUS: DATA_SYNC_STATUS_SUCCEEDED,
            DATA_SYNC_CLEANUP_AFTER: NOW - timedelta(minutes=1),
        })

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, log, record)

        mongo_dao.update_data_sync.assert_not_called()
        mongo_dao.finish_submission_data_sync.assert_not_called()
        assert record[STATUS] == DATA_SYNC_STATUS_SUCCEEDED
        assert any(DATA_SYNC_LOG_CLEANUP_FAILED in str(call) for call in log.error.call_args_list)

    def test_aws_error_records_detail_before_cleanup_is_due(self):
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

    def test_confirmed_missing_execution_schedules_cleanup(self):
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
        assert finalize[STATUS] == DATA_SYNC_STATUS_FAILED
        assert DATA_SYNC_CLEANUP_AFTER in finalize

    def test_unobservable_execution_is_failed_and_logged_unknown(self):
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        log = MagicMock()
        record = _record(**{DATA_SYNC_TASK_ARN: None, DATA_SYNC_TASK_EXECUTION_ARN: None})

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(MagicMock(), mongo_dao, log, record)

        finalize = _finalize_set_fields(mongo_dao)
        assert finalize[STATUS] == DATA_SYNC_STATUS_FAILED
        assert finalize[DATA_SYNC_LAST_ERROR] == DATA_SYNC_LAST_ERROR_NOT_OBSERVABLE
        assert DATA_SYNC_CLEANUP_AFTER not in finalize
        assert any(DATA_SYNC_LOG_OUTCOME_UNKNOWN in str(call) for call in log.error.call_args_list)
        assert any("may have succeeded" in str(call) for call in log.error.call_args_list)

    def test_stale_finish_logs_info_not_error(self):
        mongo_dao = MagicMock()
        mongo_dao.finish_submission_data_sync.return_value = DATA_SYNC_WRITE_STALE
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        log = MagicMock()
        record = _record(**{STATUS: DATA_SYNC_STATUS_SUCCEEDED, DATA_SYNC_ROLLUP_PENDING: True})

        _monitor_data_sync(MagicMock(), mongo_dao, log, record)

        log.error.assert_not_called()
        assert any("already finished" in str(call) for call in log.info.call_args_list)

    def test_cleanup_runs_when_due_and_treats_not_found_as_done(self):
        mongo_dao = MagicMock()
        mongo_dao.update_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        datasync = MagicMock()
        datasync.delete_task.side_effect = _not_found()
        record = _record(**{
            STATUS: DATA_SYNC_STATUS_SUCCEEDED,
            DATA_SYNC_CLEANUP_AFTER: NOW - timedelta(seconds=1),
        })

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, MagicMock(), record)

        datasync.delete_task.assert_called_once()
        assert datasync.delete_location.call_count == 2
        unset = mongo_dao.update_data_sync.call_args.kwargs["unset_fields"]
        assert DATA_SYNC_CLEANUP_AFTER in unset

    def test_monitor_does_not_insert_a_record(self):
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

        with patch("metadata_export.current_datetime", return_value=NOW):
            _monitor_data_sync(datasync, mongo_dao, log, record)

        assert record[DATA_SYNC_LIST_PENDING] is False
        assert record[DATA_SYNC_ROLLUP_PENDING] is False
        datasync.delete_task.assert_called_once()
        assert any("DataSync submission not found" in str(call) for call in log.error.call_args_list)
        mongo_dao.finish_submission_data_sync.assert_not_called()

    def test_stale_finalize_does_not_finish_or_overwrite(self):
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


class TestRecovery:
    def _state(self, **overrides):
        state = {
            "submission_id": SUBMISSION_ID_VAL,
            "sync_type": DATA_SYNC_TYPE_FILE,
            "data_sync_id": "sync-1",
            "source_folder": "src",
            "target_folder": "dest",
            "start_time": NOW,
            "status": DATA_SYNC_STATUS_IN_PROGRESS,
            "inserted": False,
            "list_added": False,
            "pending_fields": {DATA_SYNC_TASK_ARN: "task-arn-1"},
            "task_arn": "task-arn-1",
            "task_execution_arn": "exec-arn-1",
            "source_location_arn": "src-loc",
            "destination_location_arn": "dest-loc",
            "end_time": None,
            "last_error": None,
            "rollup_pending": False,
        }
        state.update(overrides)
        return state

    def test_retries_insert_then_hands_off_without_deleting(self):
        mongo_dao = MagicMock()
        mongo_dao.insert_data_sync.side_effect = [DATA_SYNC_WRITE_ERROR, DATA_SYNC_WRITE_APPLIED]
        mongo_dao.update_data_sync.side_effect = _update_without_reopen()
        mongo_dao.add_active_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        log = MagicMock()
        datasync = MagicMock()

        with patch("metadata_export.notify_data_sync_started") as notify, \
                patch("metadata_export.boto3") as mock_boto3:
            mock_boto3.client.return_value = datasync
            recover_data_sync_tracking(
                mongo_dao, log, self._state(), sleep_fn=lambda _seconds: None, clock=lambda: 0, max_seconds=10,
            )

        assert mongo_dao.insert_data_sync.call_count == 2
        assert mongo_dao.insert_data_sync.call_args.args[5] == "sync-1"
        notify.assert_called_once()
        datasync.delete_task.assert_not_called()
        datasync.delete_location.assert_not_called()

    def test_pending_arns_are_saved_after_insert(self):
        mongo_dao = MagicMock()
        mongo_dao.insert_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.update_data_sync.side_effect = _update_without_reopen()
        mongo_dao.add_active_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        state = self._state()

        with patch("metadata_export.notify_data_sync_started"), \
                patch("metadata_export.boto3"):
            recover_data_sync_tracking(
                mongo_dao, MagicMock(), state, sleep_fn=lambda _seconds: None, clock=lambda: 0,
                describe_status=lambda _arn: "TRANSFERRING", max_seconds=10,
            )

        assert mongo_dao.update_data_sync.call_args_list[0].args[1][DATA_SYNC_TASK_ARN] == "task-arn-1"

    def test_timeout_logs_unrecovered_arns(self):
        mongo_dao = MagicMock()
        mongo_dao.insert_data_sync.return_value = DATA_SYNC_WRITE_ERROR
        log = MagicMock()
        now = {"t": 0}

        def clock():
            return now["t"]

        def sleep_fn(_seconds):
            now["t"] += 100

        recover_data_sync_tracking(
            mongo_dao, log, self._state(), sleep_fn=sleep_fn, clock=clock, max_seconds=50,
        )

        logged = " ".join(str(call) for call in log.error.call_args_list)
        assert DATA_SYNC_LOG_TRACKING_NOT_RECOVERED in logged
        assert "task-arn-1" in logged
        assert "exec-arn-1" in logged
        assert "src-loc" in logged
        assert "dest-loc" in logged

    def test_reopens_not_observable_record_after_saving_arns(self):
        mongo_dao = MagicMock()
        mongo_dao.insert_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.update_data_sync.side_effect = _update_without_reopen(reopen=DATA_SYNC_WRITE_APPLIED)
        mongo_dao.add_active_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        log = MagicMock()

        with patch("metadata_export.notify_data_sync_started") as notify, \
                patch("metadata_export.boto3"):
            recover_data_sync_tracking(
                mongo_dao, log, self._state(inserted=True),
                sleep_fn=lambda _seconds: None, clock=lambda: 0,
                describe_status=lambda _arn: "TRANSFERRING", max_seconds=10,
            )

        reopen_calls = [
            call for call in mongo_dao.update_data_sync.call_args_list
            if call.kwargs.get("match_fields") and DATA_SYNC_LAST_ERROR in call.kwargs["match_fields"]
        ]
        assert len(reopen_calls) == 1
        assert reopen_calls[0].args[1][STATUS] == DATA_SYNC_STATUS_IN_PROGRESS
        assert reopen_calls[0].args[1][DATA_SYNC_LIST_PENDING] is True
        assert DATA_SYNC_END_TIME in reopen_calls[0].kwargs["unset_fields"]
        assert DATA_SYNC_LAST_ERROR_NOT_OBSERVABLE in (
            reopen_calls[0].kwargs["match_fields"][DATA_SYNC_LAST_ERROR]["$in"]
        )
        assert DATA_SYNC_LAST_ERROR_NOT_STARTED in (
            reopen_calls[0].kwargs["match_fields"][DATA_SYNC_LAST_ERROR]["$in"]
        )
        assert any("reopened" in str(call) for call in log.info.call_args_list)
        assert notify.call_count == 2

    def test_normal_arn_save_does_not_reopen(self):
        mongo_dao = MagicMock()
        mongo_dao.insert_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.update_data_sync.side_effect = _update_without_reopen(reopen=DATA_SYNC_WRITE_STALE)
        mongo_dao.add_active_submission_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        log = MagicMock()

        with patch("metadata_export.notify_data_sync_started") as notify, \
                patch("metadata_export.boto3"):
            recover_data_sync_tracking(
                mongo_dao, log, self._state(inserted=True),
                sleep_fn=lambda _seconds: None, clock=lambda: 0,
                describe_status=lambda _arn: "TRANSFERRING", max_seconds=10,
            )

        reopen_calls = [
            call for call in mongo_dao.update_data_sync.call_args_list
            if call.kwargs.get("match_fields") and DATA_SYNC_LAST_ERROR in call.kwargs["match_fields"]
        ]
        assert len(reopen_calls) == 1
        assert not any("reopened" in str(call) for call in log.info.call_args_list)
        notify.assert_called_once()

    def test_stale_list_add_clears_pending_flags(self):
        mongo_dao = MagicMock()
        mongo_dao.insert_data_sync.return_value = DATA_SYNC_WRITE_APPLIED
        mongo_dao.update_data_sync.side_effect = _update_without_reopen()
        mongo_dao.add_active_submission_data_sync.return_value = DATA_SYNC_WRITE_STALE
        log = MagicMock()
        state = self._state(inserted=True, pending_fields={})

        with patch("metadata_export.notify_data_sync_started"), \
                patch("metadata_export.boto3"):
            recover_data_sync_tracking(
                mongo_dao, log, state, sleep_fn=lambda _seconds: None, clock=lambda: 0,
                describe_status=lambda _arn: "SUCCESS", max_seconds=10,
            )

        assert state["list_added"] is True
        clear_calls = [
            call for call in mongo_dao.update_data_sync.call_args_list
            if isinstance(call.args[1] if len(call.args) > 1 else None, dict)
            and call.args[1].get(DATA_SYNC_LIST_PENDING) is False
            and call.args[1].get(DATA_SYNC_ROLLUP_PENDING) is False
        ]
        assert clear_calls
        assert any("submission not found" in str(call) for call in log.error.call_args_list)


class TestMonitorState:
    def test_next_state(self):
        assert _next_data_sync_monitor_state(2) == DATA_SYNC_MONITOR_STATE_ACTIVE
        assert _next_data_sync_monitor_state(0) == DATA_SYNC_MONITOR_STATE_WAITING
        assert _next_data_sync_monitor_state(None) is None

    def test_query_failure_keeps_the_active_interval(self):
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
        metadata_export._data_sync_wake_event.clear()
        metadata_export.notify_data_sync_started()
        assert metadata_export._data_sync_wake_event.wait(0) is True
        metadata_export._data_sync_wake_event.clear()


class TestOriginalMonitor:
    def test_success_deletes_source_files_then_task_and_locations(self):
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "SUCCESS"}
        log = MagicMock()
        source = {"LocationArn": "src-loc"}
        dest = {"LocationArn": "dest-loc"}

        with patch("metadata_export.time.sleep") as sleep, \
                patch("metadata_export.delete_files_from_s3") as delete_files:
            monitor_datasync_task(
                "exec-arn-1", "task-arn-1", datasync, source, dest, log, "bucket", ["a.txt"],
            )

        delete_files.assert_called_once_with("bucket", ["a.txt"], log)
        datasync.delete_task.assert_called_once_with(TaskArn="task-arn-1")
        assert datasync.delete_location.call_count == 2
        assert sleep.call_args_list[0].args[0] == 300
