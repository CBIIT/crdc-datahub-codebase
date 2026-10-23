"""Unit tests for DataSync tracking in metadata_export.py:
transfer_s3_obj (insert + rollup on start, Failed on start error) and
monitor_datasync_task (terminal update + rollup, Failed on monitor exception),
map_aws_datasync_status, and reconcile_in_progress_data_syncs.
"""
import os
import sys
from datetime import datetime
from unittest.mock import MagicMock, patch

_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, "src"))

from botocore.exceptions import ClientError

from metadata_export import (
    ExportMetadata,
    monitor_datasync_task,
    map_aws_datasync_status,
    reconcile_in_progress_data_syncs,
)
from common.constants import (
    ID,
    EXPORT_ROOT_PATH,
    BATCH_BUCKET,
    DATA_COMMON_NAME,
    STUDY_ID,
    TIER_CONFIG,
    DATASYNC_ROLE_ARN_CONFIG,
    DATASYNC_LOG_ARN_CONFIG,
    DM_BUCKET_CONFIG_NAME,
    SUBMISSION_ID,
    TYPE,
    DATA_SYNC_TYPE_METADATA,
    DATA_SYNC_TYPE_FILE,
    DATA_SYNC_STATUS_IN_PROGRESS,
    DATA_SYNC_STATUS_SUCCEEDED,
    DATA_SYNC_STATUS_FAILED,
    DATA_SYNC_TASK_EXECUTION_ARN,
)

SUBMISSION_ID_VAL = "sub-1"


def _make_export_metadata():
    """Build an ExportMetadata with a mocked MongoDao and S3Service (bypass __init__)."""
    mongo_dao = MagicMock()
    mongo_dao.insert_data_sync.return_value = "data-sync-1"
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


def _mock_datasync_client(task_arn="task-arn-1", task_execution_arn="exec-arn-1"):
    client = MagicMock()
    client.create_location_s3.side_effect = [{"LocationArn": "src-loc"}, {"LocationArn": "dest-loc"}]
    client.create_task.return_value = {"TaskArn": task_arn}
    client.start_task_execution.return_value = {"TaskExecutionArn": task_execution_arn}
    return client


class TestMapAwsDatasyncStatus:

    def test_success_maps_to_succeeded(self):
        assert map_aws_datasync_status("SUCCESS") == DATA_SYNC_STATUS_SUCCEEDED

    def test_error_maps_to_failed(self):
        assert map_aws_datasync_status("ERROR") == DATA_SYNC_STATUS_FAILED

    def test_other_values_map_to_in_progress(self):
        for aws_status in ["QUEUED", "LAUNCHING", "PREPARING", "TRANSFERRING", "VERIFYING", "", None]:
            assert map_aws_datasync_status(aws_status) == DATA_SYNC_STATUS_IN_PROGRESS


class TestTransferS3ObjDataSync:

    @patch("metadata_export.start_monitoring_task")
    @patch("metadata_export.boto3")
    def test_tracks_a_sync_on_successful_start(self, mock_boto3, mock_start_monitoring):
        export_metadata, mongo_dao = _make_export_metadata()
        mock_boto3.client.return_value = _mock_datasync_client()

        export_metadata.transfer_s3_obj(
            "bucket", "src/folder", "dest-bucket", "dest/folder", [], sync_type=DATA_SYNC_TYPE_METADATA
        )

        mongo_dao.insert_data_sync.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_METADATA, "src/folder", "dest/folder",
            DATA_SYNC_STATUS_IN_PROGRESS, task_arn="task-arn-1", task_execution_arn="exec-arn-1",
        )
        mongo_dao.set_submission_data_sync_status.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_METADATA, DATA_SYNC_STATUS_IN_PROGRESS, "data-sync-1",
        )
        mock_start_monitoring.assert_called_once()
        kwargs = mock_start_monitoring.call_args.kwargs
        assert kwargs["mongo_dao"] is mongo_dao
        assert kwargs["data_sync_id"] == "data-sync-1"
        assert kwargs["submission_id"] == SUBMISSION_ID_VAL
        assert kwargs["sync_type"] == DATA_SYNC_TYPE_METADATA

    @patch("metadata_export.start_monitoring_task")
    @patch("metadata_export.boto3")
    def test_does_not_track_when_sync_type_is_not_given(self, mock_boto3, mock_start_monitoring):
        """move_s3_objects and restore_deleted_file call transfer_s3_obj with no sync_type."""
        export_metadata, mongo_dao = _make_export_metadata()
        mock_boto3.client.return_value = _mock_datasync_client()

        export_metadata.transfer_s3_obj("bucket", "src/folder", "dest-bucket", "dest/folder", [])

        mongo_dao.insert_data_sync.assert_not_called()
        mongo_dao.set_submission_data_sync_status.assert_not_called()
        kwargs = mock_start_monitoring.call_args.kwargs
        assert kwargs["data_sync_id"] is None
        assert kwargs["sync_type"] is None

    @patch("metadata_export.boto3")
    def test_records_a_failed_sync_when_the_task_fails_to_start(self, mock_boto3):
        export_metadata, mongo_dao = _make_export_metadata()
        client = _mock_datasync_client()
        client.create_task.side_effect = Exception("boom")
        mock_boto3.client.return_value = client

        export_metadata.transfer_s3_obj(
            "bucket", "src/folder", "dest-bucket", "dest/folder", [], sync_type=DATA_SYNC_TYPE_FILE
        )

        mongo_dao.insert_data_sync.assert_called_once()
        call_args = mongo_dao.insert_data_sync.call_args
        assert call_args.args == (SUBMISSION_ID_VAL, DATA_SYNC_TYPE_FILE, "src/folder", "dest/folder", DATA_SYNC_STATUS_FAILED)
        assert isinstance(call_args.kwargs.get("end_time"), datetime)
        mongo_dao.set_submission_data_sync_status.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_FILE, DATA_SYNC_STATUS_FAILED, "data-sync-1",
        )

    @patch("metadata_export.boto3")
    def test_client_error_before_start_records_a_failed_sync(self, mock_boto3):
        export_metadata, mongo_dao = _make_export_metadata()
        client = _mock_datasync_client()
        client.create_location_s3.side_effect = ClientError(
            {"Error": {"Code": "X", "Message": "boom"}}, "CreateLocationS3"
        )
        mock_boto3.client.return_value = client

        export_metadata.transfer_s3_obj(
            "bucket", "src/folder", "dest-bucket", "dest/folder", [], sync_type=DATA_SYNC_TYPE_METADATA
        )

        mongo_dao.insert_data_sync.assert_called_once()
        mongo_dao.set_submission_data_sync_status.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_METADATA, DATA_SYNC_STATUS_FAILED, "data-sync-1",
        )

    @patch("metadata_export.start_monitoring_task")
    @patch("metadata_export.boto3")
    def test_error_after_successful_start_does_not_record_failed_sync(self, mock_boto3, mock_start_monitoring):
        export_metadata, mongo_dao = _make_export_metadata()
        mock_boto3.client.return_value = _mock_datasync_client()
        mock_start_monitoring.side_effect = Exception("monitor boom")

        export_metadata.transfer_s3_obj(
            "bucket", "src/folder", "dest-bucket", "dest/folder", [], sync_type=DATA_SYNC_TYPE_METADATA
        )

        # In Progress was recorded; a second Failed insert must not happen.
        assert mongo_dao.insert_data_sync.call_count == 1
        assert mongo_dao.insert_data_sync.call_args.args[4] == DATA_SYNC_STATUS_IN_PROGRESS
        failed_calls = [
            c for c in mongo_dao.set_submission_data_sync_status.call_args_list
            if c.args[2] == DATA_SYNC_STATUS_FAILED
        ]
        assert failed_calls == []

    def test_transfer_release_metadata_tracks_the_metadata_type(self):
        export_metadata, mongo_dao = _make_export_metadata()
        export_metadata.transfer_s3_obj = MagicMock()

        export_metadata.transfer_release_metadata()

        _, kwargs = export_metadata.transfer_s3_obj.call_args
        assert kwargs["sync_type"] == DATA_SYNC_TYPE_METADATA

    def test_transfer_released_files_tracks_the_file_type(self):
        export_metadata, mongo_dao = _make_export_metadata()
        export_metadata.transfer_s3_obj = MagicMock()

        export_metadata.transfer_released_files()

        _, kwargs = export_metadata.transfer_s3_obj.call_args
        assert kwargs["sync_type"] == DATA_SYNC_TYPE_FILE


class TestMoveAndRestoreDoNotTrackDataSync:

    @patch("metadata_export.start_monitoring_task")
    @patch("metadata_export.boto3")
    def test_move_s3_objects_does_not_track_data_sync(self, mock_boto3, mock_start_monitoring):
        export_metadata, mongo_dao = _make_export_metadata()
        mock_boto3.client.return_value = _mock_datasync_client()
        export_metadata.s3_service.get_file_info.return_value = {"exists": True}

        export_metadata.move_s3_objects(["file1.txt"])

        mongo_dao.insert_data_sync.assert_not_called()
        mongo_dao.set_submission_data_sync_status.assert_not_called()

    @patch("metadata_export.start_monitoring_task")
    @patch("metadata_export.boto3")
    def test_restore_deleted_file_does_not_track_data_sync(self, mock_boto3, mock_start_monitoring):
        export_metadata, mongo_dao = _make_export_metadata()
        mock_boto3.client.return_value = _mock_datasync_client()
        export_metadata.s3_service.list_objects.return_value = ["study-1/file1.txt"]

        export_metadata.restore_deleted_file()

        mongo_dao.insert_data_sync.assert_not_called()
        mongo_dao.set_submission_data_sync_status.assert_not_called()


class TestMonitorDataSyncTask:

    def _run(self, mongo_dao, status, **kwargs):
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": status}
        source = {"LocationArn": "src-loc"}
        dest = {"LocationArn": "dest-loc"}
        log = MagicMock()
        with patch("metadata_export.time.sleep"):
            monitor_datasync_task(
                "exec-arn", "task-arn", datasync, source, dest, log, "bucket", None,
                mongo_dao=mongo_dao, **kwargs,
            )
        return datasync

    def test_marks_record_and_submission_succeeded_on_terminal_success(self):
        mongo_dao = MagicMock()

        datasync = self._run(
            mongo_dao, "SUCCESS",
            data_sync_id="data-sync-1", submission_id=SUBMISSION_ID_VAL, sync_type=DATA_SYNC_TYPE_METADATA,
        )

        mongo_dao.update_data_sync.assert_called_once()
        call_args = mongo_dao.update_data_sync.call_args
        assert call_args.args[0] == "data-sync-1"
        assert call_args.args[1] == DATA_SYNC_STATUS_SUCCEEDED
        assert isinstance(call_args.args[2], datetime)
        mongo_dao.set_submission_data_sync_status.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_METADATA, DATA_SYNC_STATUS_SUCCEEDED, "data-sync-1",
        )
        datasync.delete_task.assert_called_once()

    def test_marks_record_and_submission_failed_on_terminal_error(self):
        mongo_dao = MagicMock()

        self._run(
            mongo_dao, "ERROR",
            data_sync_id="data-sync-1", submission_id=SUBMISSION_ID_VAL, sync_type=DATA_SYNC_TYPE_FILE,
        )

        mongo_dao.set_submission_data_sync_status.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_FILE, DATA_SYNC_STATUS_FAILED, "data-sync-1",
        )

    def test_does_not_track_when_sync_type_is_none(self):
        mongo_dao = MagicMock()

        self._run(mongo_dao, "SUCCESS", data_sync_id=None, submission_id=None, sync_type=None)

        mongo_dao.update_data_sync.assert_not_called()
        mongo_dao.set_submission_data_sync_status.assert_not_called()

    def test_client_error_while_polling_marks_failed(self):
        mongo_dao = MagicMock()
        datasync = MagicMock()
        datasync.describe_task_execution.side_effect = ClientError(
            {"Error": {"Code": "X", "Message": "boom"}}, "DescribeTaskExecution"
        )
        source = {"LocationArn": "src-loc"}
        dest = {"LocationArn": "dest-loc"}
        log = MagicMock()

        monitor_datasync_task(
            "exec-arn", "task-arn", datasync, source, dest, log, "bucket", None,
            mongo_dao=mongo_dao, data_sync_id="data-sync-1", submission_id=SUBMISSION_ID_VAL, sync_type=DATA_SYNC_TYPE_METADATA,
        )

        mongo_dao.update_data_sync.assert_called_once()
        assert mongo_dao.update_data_sync.call_args.args[0] == "data-sync-1"
        assert mongo_dao.update_data_sync.call_args.args[1] == DATA_SYNC_STATUS_FAILED
        mongo_dao.set_submission_data_sync_status.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_METADATA, DATA_SYNC_STATUS_FAILED, "data-sync-1",
        )

    def test_generic_exception_while_polling_marks_failed(self):
        mongo_dao = MagicMock()
        datasync = MagicMock()
        datasync.describe_task_execution.side_effect = Exception("boom")
        source = {"LocationArn": "src-loc"}
        dest = {"LocationArn": "dest-loc"}
        log = MagicMock()

        monitor_datasync_task(
            "exec-arn", "task-arn", datasync, source, dest, log, "bucket", None,
            mongo_dao=mongo_dao, data_sync_id="data-sync-1", submission_id=SUBMISSION_ID_VAL, sync_type=DATA_SYNC_TYPE_FILE,
        )

        mongo_dao.set_submission_data_sync_status.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_FILE, DATA_SYNC_STATUS_FAILED, "data-sync-1",
        )

    def test_no_tracking_on_exception_when_sync_type_is_none(self):
        mongo_dao = MagicMock()
        datasync = MagicMock()
        datasync.describe_task_execution.side_effect = Exception("boom")
        source = {"LocationArn": "src-loc"}
        dest = {"LocationArn": "dest-loc"}
        log = MagicMock()

        monitor_datasync_task(
            "exec-arn", "task-arn", datasync, source, dest, log, "bucket", None,
            mongo_dao=mongo_dao, data_sync_id=None, submission_id=None, sync_type=None,
        )

        mongo_dao.update_data_sync.assert_not_called()
        mongo_dao.set_submission_data_sync_status.assert_not_called()

    def test_cleanup_failure_after_success_does_not_overwrite_with_failed(self):
        mongo_dao = MagicMock()
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "SUCCESS"}
        datasync.delete_task.side_effect = ClientError(
            {"Error": {"Code": "X", "Message": "cleanup boom"}}, "DeleteTask"
        )
        source = {"LocationArn": "src-loc"}
        dest = {"LocationArn": "dest-loc"}
        log = MagicMock()

        with patch("metadata_export.time.sleep"):
            monitor_datasync_task(
                "exec-arn", "task-arn", datasync, source, dest, log, "bucket", None,
                mongo_dao=mongo_dao, data_sync_id="data-sync-1",
                submission_id=SUBMISSION_ID_VAL, sync_type=DATA_SYNC_TYPE_METADATA,
            )

        mongo_dao.update_data_sync.assert_called_once()
        assert mongo_dao.update_data_sync.call_args.args[1] == DATA_SYNC_STATUS_SUCCEEDED
        failed_calls = [
            c for c in mongo_dao.set_submission_data_sync_status.call_args_list
            if c.args[2] == DATA_SYNC_STATUS_FAILED
        ]
        assert failed_calls == []
        mongo_dao.set_submission_data_sync_status.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_METADATA, DATA_SYNC_STATUS_SUCCEEDED, "data-sync-1",
        )


class TestReconcileInProgressDataSyncs:

    def test_records_terminal_status_on_success(self):
        mongo_dao = MagicMock()
        mongo_dao.find_in_progress_data_syncs.return_value = [{
            ID: "data-sync-1",
            SUBMISSION_ID: SUBMISSION_ID_VAL,
            TYPE: DATA_SYNC_TYPE_METADATA,
            DATA_SYNC_TASK_EXECUTION_ARN: "exec-arn-1",
        }]
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "SUCCESS"}
        log = MagicMock()

        with patch("metadata_export.boto3") as mock_boto3:
            mock_boto3.client.return_value = datasync
            reconcile_in_progress_data_syncs(mongo_dao, log)

        mongo_dao.update_data_sync.assert_called_once()
        assert mongo_dao.update_data_sync.call_args.args[1] == DATA_SYNC_STATUS_SUCCEEDED
        mongo_dao.set_submission_data_sync_status.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_METADATA, DATA_SYNC_STATUS_SUCCEEDED, "data-sync-1",
        )
        datasync.close.assert_called_once()

    def test_leaves_still_running_tasks_alone(self):
        mongo_dao = MagicMock()
        mongo_dao.find_in_progress_data_syncs.return_value = [{
            ID: "data-sync-1",
            SUBMISSION_ID: SUBMISSION_ID_VAL,
            TYPE: DATA_SYNC_TYPE_FILE,
            DATA_SYNC_TASK_EXECUTION_ARN: "exec-arn-1",
        }]
        datasync = MagicMock()
        datasync.describe_task_execution.return_value = {"Status": "TRANSFERRING"}
        log = MagicMock()

        with patch("metadata_export.boto3") as mock_boto3:
            mock_boto3.client.return_value = datasync
            reconcile_in_progress_data_syncs(mongo_dao, log)

        mongo_dao.update_data_sync.assert_not_called()
        mongo_dao.set_submission_data_sync_status.assert_not_called()

    def test_client_error_marks_failed(self):
        mongo_dao = MagicMock()
        mongo_dao.find_in_progress_data_syncs.return_value = [{
            ID: "data-sync-1",
            SUBMISSION_ID: SUBMISSION_ID_VAL,
            TYPE: DATA_SYNC_TYPE_METADATA,
            DATA_SYNC_TASK_EXECUTION_ARN: "exec-arn-1",
        }]
        datasync = MagicMock()
        datasync.describe_task_execution.side_effect = ClientError(
            {"Error": {"Code": "ResourceNotFoundException", "Message": "gone"}},
            "DescribeTaskExecution",
        )
        log = MagicMock()

        with patch("metadata_export.boto3") as mock_boto3:
            mock_boto3.client.return_value = datasync
            reconcile_in_progress_data_syncs(mongo_dao, log)

        mongo_dao.update_data_sync.assert_called_once()
        assert mongo_dao.update_data_sync.call_args.args[1] == DATA_SYNC_STATUS_FAILED
        mongo_dao.set_submission_data_sync_status.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_METADATA, DATA_SYNC_STATUS_FAILED, "data-sync-1",
        )

    def test_generic_exception_moves_on_to_next_record(self):
        mongo_dao = MagicMock()
        mongo_dao.find_in_progress_data_syncs.return_value = [
            {
                ID: "data-sync-1",
                SUBMISSION_ID: SUBMISSION_ID_VAL,
                TYPE: DATA_SYNC_TYPE_METADATA,
                DATA_SYNC_TASK_EXECUTION_ARN: "exec-arn-1",
            },
            {
                ID: "data-sync-2",
                SUBMISSION_ID: SUBMISSION_ID_VAL,
                TYPE: DATA_SYNC_TYPE_FILE,
                DATA_SYNC_TASK_EXECUTION_ARN: "exec-arn-2",
            },
        ]
        datasync = MagicMock()
        datasync.describe_task_execution.side_effect = [
            Exception("boom"),
            {"Status": "ERROR"},
        ]
        log = MagicMock()

        with patch("metadata_export.boto3") as mock_boto3:
            mock_boto3.client.return_value = datasync
            reconcile_in_progress_data_syncs(mongo_dao, log)

        mongo_dao.update_data_sync.assert_called_once()
        assert mongo_dao.update_data_sync.call_args.args[0] == "data-sync-2"
        assert mongo_dao.update_data_sync.call_args.args[1] == DATA_SYNC_STATUS_FAILED
        mongo_dao.set_submission_data_sync_status.assert_called_once_with(
            SUBMISSION_ID_VAL, DATA_SYNC_TYPE_FILE, DATA_SYNC_STATUS_FAILED, "data-sync-2",
        )
