"""Unit tests for essential_validator TYPE_DELETE (Delete Metadata) flow: deleteOrphanedDataFiles and F008 orphan errors."""
import json
import os
import shutil
import sys
import tempfile
from unittest.mock import MagicMock, patch

import requests

import pytest

_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, "src"))

from common import constants
from essential_validator import essentialValidate


def _make_delete_message(overrides=None):
    payload = {
        constants.SQS_TYPE: constants.TYPE_DELETE,
        constants.SUBMISSION_ID: "sub-1",
        constants.NODE_TYPE: "Subject",
        constants.NODE_IDS: ["n1", "n2"],
        constants.DELETE_ALL: False,
        constants.EXCLUSIVE_IDS: [],
    }
    if overrides is not None:
        payload.update(overrides)
    msg = MagicMock()
    msg.body = json.dumps(payload)
    return msg


def _use_real_file_status_from_records(mock_mongo_dao, file_records):
    """Resolve file status with MongoDao.submission_file_status_from_records."""
    from common.mongo_dao import MongoDao

    mock_mongo_dao.get_files_by_submission.return_value = file_records
    mock_mongo_dao.submission_file_status_from_records.side_effect = (
        lambda submission_id, run_status: MongoDao.submission_file_status_from_records(
            mock_mongo_dao, submission_id, run_status
        )
    )


def _run_checkbox_on_delete(mock_configs, mock_mongo_dao, existing_error, remove_result, file_validation_status):
    """Process one checkbox-on delete whose submission already stores existing_error."""
    msg = _make_delete_message({constants.DELETE_ORPHANED_DATA_FILES: True})
    job_queue = MagicMock()
    job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]
    submission = {
        constants.ID: "sub-1",
        constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
        constants.FILE_VALIDATION_STATUS: file_validation_status,
        constants.FILE_ERRORS: [existing_error],
    }
    mock_mongo_dao.get_submission.return_value = submission

    with patch("essential_validator.ModelFactory"):
        with patch("essential_validator.set_scale_in_protection"):
            with patch("essential_validator.MetadataRemover") as mock_remover_class:
                mock_remover = MagicMock()
                mock_remover.submission = submission
                mock_remover.remove_metadata.return_value = remove_result
                mock_remover_class.return_value = mock_remover
                try:
                    essentialValidate(mock_configs, job_queue, mock_mongo_dao)
                except KeyboardInterrupt:
                    pass


def _run_one_delete_message(configs, job_queue, mongo_dao, msg):
    """Run essentialValidate until one Delete Metadata message is processed, then break."""
    job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]
    with patch("essential_validator.ModelFactory"):
        with patch("essential_validator.set_scale_in_protection"):
            try:
                essentialValidate(configs, job_queue, mongo_dao)
            except KeyboardInterrupt:
                pass


@pytest.fixture
def mock_configs():
    return {
        constants.SQS_NAME: "test-queue",
        constants.MODEL_FILE_DIR: "/tmp/models",
        constants.TIER_CONFIG: None,
    }


@pytest.fixture
def mock_mongo_dao():
    dao = MagicMock()
    dao.search_nodes_by_type_and_submission.return_value = ["n1", "n2"]
    return dao


class TestDeleteMessageDeleteOrphanedDataFiles:
    """deleteOrphanedDataFiles default and passing to MetadataRemover."""

    def test_message_without_delete_orphaned_data_files_calls_remove_metadata_with_false(
        self, mock_configs, mock_mongo_dao
    ):
        """When message omits deleteOrphanedDataFiles, remove_metadata is called with delete_orphaned_data_files=False."""
        msg = _make_delete_message()
        job_queue = MagicMock()
        job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]

        with patch("essential_validator.ModelFactory"):
            with patch("essential_validator.set_scale_in_protection"):
                with patch("essential_validator.MetadataRemover") as mock_remover_class:
                    mock_remover = MagicMock()
                    mock_remover.submission = {constants.ID: "sub-1", constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED}
                    mock_remover.remove_metadata.return_value = (True, [])
                    mock_remover_class.return_value = mock_remover
                    try:
                        essentialValidate(mock_configs, job_queue, mock_mongo_dao)
                    except KeyboardInterrupt:
                        pass

        mock_remover.remove_metadata.assert_called_once()
        # remove_metadata(submission_id, node_type, node_ids, delete_orphaned_data_files)
        call_args = mock_remover.remove_metadata.call_args[0]
        assert call_args[3] is False

    def test_message_with_delete_orphaned_data_files_true_calls_remove_metadata_with_true(
        self, mock_configs, mock_mongo_dao
    ):
        """When message has deleteOrphanedDataFiles true, remove_metadata is called with True."""
        msg = _make_delete_message({constants.DELETE_ORPHANED_DATA_FILES: True})
        job_queue = MagicMock()
        job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]

        with patch("essential_validator.ModelFactory"):
            with patch("essential_validator.set_scale_in_protection"):
                with patch("essential_validator.MetadataRemover") as mock_remover_class:
                    mock_remover = MagicMock()
                    mock_remover.submission = {constants.ID: "sub-1", constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED}
                    mock_remover.remove_metadata.return_value = (True, [])
                    mock_remover_class.return_value = mock_remover
                    try:
                        essentialValidate(mock_configs, job_queue, mock_mongo_dao)
                    except KeyboardInterrupt:
                        pass

        call_args = mock_remover.remove_metadata.call_args[0]
        assert call_args[3] is True

    def test_set_submission_validation_status_file_status_none_when_no_file_errors(
        self, mock_configs, mock_mongo_dao
    ):
        """When delete succeeds with no fileErrors, file_status is not set to Error."""
        msg = _make_delete_message()
        job_queue = MagicMock()
        job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]
        mock_mongo_dao.get_submission.return_value = None

        with patch("essential_validator.ModelFactory"):
            with patch("essential_validator.set_scale_in_protection"):
                with patch("essential_validator.MetadataRemover") as mock_remover_class:
                    mock_remover = MagicMock()
                    mock_remover.submission = {
                        constants.ID: "sub-1",
                        constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
                    }
                    mock_remover.remove_metadata.return_value = (True, [])
                    mock_remover_class.return_value = mock_remover
                    try:
                        essentialValidate(mock_configs, job_queue, mock_mongo_dao)
                    except KeyboardInterrupt:
                        pass

        call_args = mock_mongo_dao.set_submission_validation_status.call_args[0]
        assert call_args[1] is None
        assert call_args[3] == []


class TestDeleteSuccessAppendsOrphanErrors:
    """set_submission_validation_status receives combined fileErrors (existing + orphan F008)."""

    def test_set_submission_validation_status_called_with_combined_file_errors(
        self, mock_configs, mock_mongo_dao
    ):
        """On successful delete with orphan_errors, set_submission_validation_status is called with fileErrors = existing + orphan_errors."""
        msg = _make_delete_message()
        job_queue = MagicMock()
        job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]

        existing_error = {"submittedID": "old.csv", "errors": []}
        orphan_error = {"submittedID": "orphan.csv", "errors": [{"code": "F008"}]}
        # Re-fetch returns fresh submission with existing fileErrors; combined = existing + orphan_errors
        mock_mongo_dao.get_submission.return_value = {
            constants.ID: "sub-1",
            constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
            constants.FILE_ERRORS: [existing_error],
        }

        with patch("essential_validator.ModelFactory"):
            with patch("essential_validator.set_scale_in_protection"):
                with patch("essential_validator.MetadataRemover") as mock_remover_class:
                    mock_remover = MagicMock()
                    mock_remover.submission = {
                        constants.ID: "sub-1",
                        constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
                        constants.FILE_ERRORS: [existing_error],
                    }
                    mock_remover.remove_metadata.return_value = (True, [orphan_error])
                    mock_remover_class.return_value = mock_remover
                    try:
                        essentialValidate(mock_configs, job_queue, mock_mongo_dao)
                    except KeyboardInterrupt:
                        pass

        mock_mongo_dao.set_submission_validation_status.assert_called_once()
        call_args = mock_mongo_dao.set_submission_validation_status.call_args[0]
        # set_submission_validation_status(submission, file_status, metadata_status, file_errors, is_delete, ...)
        assert call_args[1] == constants.STATUS_ERROR
        file_errors = call_args[3]
        assert file_errors == [existing_error, orphan_error]
        assert call_args[4] is True

    def test_set_submission_validation_status_with_no_existing_file_errors(
        self, mock_configs, mock_mongo_dao
    ):
        """When submission has no fileErrors, combined is just orphan_errors."""
        msg = _make_delete_message()
        job_queue = MagicMock()
        job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]

        orphan_error = {"submittedID": "orphan.csv", "errors": [{"code": "F008"}]}
        # Re-fetch returns None so we use validator.submission (no FILE_ERRORS); existing = []
        mock_mongo_dao.get_submission.return_value = None

        with patch("essential_validator.ModelFactory"):
            with patch("essential_validator.set_scale_in_protection"):
                with patch("essential_validator.MetadataRemover") as mock_remover_class:
                    mock_remover = MagicMock()
                    mock_remover.submission = {
                        constants.ID: "sub-1",
                        constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
                    }
                    mock_remover.remove_metadata.return_value = (True, [orphan_error])
                    mock_remover_class.return_value = mock_remover
                    try:
                        essentialValidate(mock_configs, job_queue, mock_mongo_dao)
                    except KeyboardInterrupt:
                        pass

        call_args = mock_mongo_dao.set_submission_validation_status.call_args[0]
        assert call_args[1] == constants.STATUS_ERROR
        file_errors = call_args[3]
        assert file_errors == [orphan_error]

    def test_set_submission_validation_status_no_orphan_errors_keeps_existing_only(
        self, mock_configs, mock_mongo_dao
    ):
        """When remove_metadata returns no orphan_errors, fileErrors is only existing."""
        msg = _make_delete_message()
        job_queue = MagicMock()
        job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]

        existing_error = {"submittedID": "old.csv", "errors": []}
        mock_mongo_dao.get_submission.return_value = {
            constants.ID: "sub-1",
            constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
            constants.FILE_ERRORS: [existing_error],
        }

        with patch("essential_validator.ModelFactory"):
            with patch("essential_validator.set_scale_in_protection"):
                with patch("essential_validator.MetadataRemover") as mock_remover_class:
                    mock_remover = MagicMock()
                    mock_remover.submission = {
                        constants.ID: "sub-1",
                        constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
                        constants.FILE_ERRORS: [existing_error],
                    }
                    mock_remover.remove_metadata.return_value = (True, [])
                    mock_remover_class.return_value = mock_remover
                    try:
                        essentialValidate(mock_configs, job_queue, mock_mongo_dao)
                    except KeyboardInterrupt:
                        pass

        call_args = mock_mongo_dao.set_submission_validation_status.call_args[0]
        assert call_args[1] == constants.STATUS_ERROR
        file_errors = call_args[3]
        assert file_errors == [existing_error]


class TestResolveFileValidationAfterDelete:
    """resolve_file_validation_after_delete chooses file status and fileErrors after delete."""

    def test_checkbox_off_appends_and_sets_error_when_combined_list_is_non_empty(self):
        from essential_validator import resolve_file_validation_after_delete

        existing = {"submittedID": "old.csv", "errors": [{"code": "F008"}]}
        orphan = {"submittedID": "orphan.csv", "errors": [{"code": "F008"}]}
        file_status, file_errors = resolve_file_validation_after_delete(
            [existing], [orphan], False, constants.STATUS_PASSED
        )
        assert file_status == constants.STATUS_ERROR
        assert file_errors == [existing, orphan]

    def test_checkbox_off_leaves_file_status_unset_when_there_are_no_errors(self):
        from essential_validator import resolve_file_validation_after_delete

        file_status, file_errors = resolve_file_validation_after_delete(
            [], [], False, constants.STATUS_PASSED
        )
        assert file_status is None
        assert file_errors == []

    def test_checkbox_on_keeps_scan_only_and_sets_error(self):
        from essential_validator import resolve_file_validation_after_delete

        deleted = {"submittedID": "associated.tsv", "errors": [{"code": "F008"}]}
        unrelated = {"submittedID": "unrelated.csv", "errors": [{"code": "F008"}]}
        file_status, file_errors = resolve_file_validation_after_delete(
            [deleted], [unrelated], True, constants.STATUS_PASSED
        )
        assert file_status == constants.STATUS_ERROR
        assert file_errors == [unrelated]

    def test_checkbox_on_empty_scan_uses_remaining_file_status(self):
        from essential_validator import resolve_file_validation_after_delete

        deleted = {"submittedID": "associated.tsv", "errors": [{"code": "F008"}]}
        file_status, file_errors = resolve_file_validation_after_delete(
            [deleted], [], True, constants.STATUS_PASSED
        )
        assert file_status == constants.STATUS_PASSED
        assert file_errors == []


class TestDeleteAssociatedFilesUpdatesFileValidation:
    """Checkbox on replaces fileErrors with the orphan scan and refreshes fileValidationStatus."""

    def test_checkbox_on_drops_deleted_file_errors_and_keeps_unrelated_orphan(
        self, mock_configs, mock_mongo_dao
    ):
        msg = _make_delete_message({constants.DELETE_ORPHANED_DATA_FILES: True})
        job_queue = MagicMock()
        job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]

        deleted_error = {"submittedID": "associated.tsv", "errors": [{"code": "F008"}]}
        unrelated_error = {"submittedID": "unrelated.csv", "errors": [{"code": "F008"}]}
        mock_mongo_dao.get_submission.return_value = {
            constants.ID: "sub-1",
            constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
            constants.FILE_ERRORS: [deleted_error],
        }

        with patch("essential_validator.ModelFactory"):
            with patch("essential_validator.set_scale_in_protection"):
                with patch("essential_validator.MetadataRemover") as mock_remover_class:
                    mock_remover = MagicMock()
                    mock_remover.submission = {
                        constants.ID: "sub-1",
                        constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
                        constants.FILE_ERRORS: [deleted_error],
                    }
                    mock_remover.remove_metadata.return_value = (True, [unrelated_error])
                    mock_remover_class.return_value = mock_remover
                    try:
                        essentialValidate(mock_configs, job_queue, mock_mongo_dao)
                    except KeyboardInterrupt:
                        pass

        call_args = mock_mongo_dao.set_submission_validation_status.call_args[0]
        assert call_args[1] == constants.STATUS_ERROR
        assert call_args[3] == [unrelated_error]

    def test_checkbox_on_empty_scan_sets_remaining_file_status_and_clears_file_errors(
        self, mock_configs, mock_mongo_dao
    ):
        msg = _make_delete_message({constants.DELETE_ORPHANED_DATA_FILES: True})
        job_queue = MagicMock()
        job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]

        deleted_error = {"submittedID": "associated.tsv", "errors": [{"code": "F008"}]}
        mock_mongo_dao.get_submission.return_value = {
            constants.ID: "sub-1",
            constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
            constants.FILE_ERRORS: [deleted_error],
        }
        mock_mongo_dao.submission_file_status_from_records.return_value = constants.STATUS_PASSED

        with patch("essential_validator.ModelFactory"):
            with patch("essential_validator.set_scale_in_protection"):
                with patch("essential_validator.MetadataRemover") as mock_remover_class:
                    mock_remover = MagicMock()
                    mock_remover.submission = {
                        constants.ID: "sub-1",
                        constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
                        constants.FILE_ERRORS: [deleted_error],
                    }
                    mock_remover.remove_metadata.return_value = (True, [])
                    mock_remover_class.return_value = mock_remover
                    try:
                        essentialValidate(mock_configs, job_queue, mock_mongo_dao)
                    except KeyboardInterrupt:
                        pass

        mock_mongo_dao.submission_file_status_from_records.assert_called_once()
        assert mock_mongo_dao.submission_file_status_from_records.call_args[0][0] == "sub-1"
        call_args = mock_mongo_dao.set_submission_validation_status.call_args[0]
        assert call_args[1] == constants.STATUS_PASSED
        assert call_args[3] == []

    def test_checkbox_on_empty_scan_sets_passed_from_remaining_file_nodes(
        self, mock_configs, mock_mongo_dao
    ):
        """An empty scan over Passed file nodes clears the previous Error."""
        deleted_error = {"submittedID": "associated.tsv", "errors": [{"code": "F008"}]}
        _use_real_file_status_from_records(mock_mongo_dao, [{
            constants.S3_FILE_INFO: {constants.STATUS: constants.STATUS_PASSED},
        }])
        _run_checkbox_on_delete(
            mock_configs,
            mock_mongo_dao,
            deleted_error,
            (True, []),
            constants.STATUS_ERROR,
        )

        call_args = mock_mongo_dao.set_submission_validation_status.call_args[0]
        assert call_args[1] == constants.STATUS_PASSED
        assert call_args[3] == []

    def test_checkbox_on_empty_scan_keeps_warning_from_remaining_file_nodes(
        self, mock_configs, mock_mongo_dao
    ):
        """An empty scan keeps Warning when a remaining file node is Warning."""
        deleted_error = {"submittedID": "associated.tsv", "errors": [{"code": "F008"}]}
        _use_real_file_status_from_records(mock_mongo_dao, [{
            constants.S3_FILE_INFO: {constants.STATUS: constants.STATUS_WARNING},
        }])
        _run_checkbox_on_delete(
            mock_configs,
            mock_mongo_dao,
            deleted_error,
            (True, []),
            constants.STATUS_ERROR,
        )

        call_args = mock_mongo_dao.set_submission_validation_status.call_args[0]
        assert call_args[1] == constants.STATUS_WARNING
        assert call_args[3] == []

    def test_checkbox_on_failed_delete_keeps_existing_file_errors(
        self, mock_configs, mock_mongo_dao
    ):
        """A failed delete leaves the stored F008 list and Error status in place."""
        deleted_error = {"submittedID": "associated.tsv", "errors": [{"code": "F008"}]}
        _run_checkbox_on_delete(
            mock_configs,
            mock_mongo_dao,
            deleted_error,
            (False, []),
            constants.STATUS_ERROR,
        )

        call_args = mock_mongo_dao.set_submission_validation_status.call_args[0]
        assert call_args[3] == [deleted_error]
        assert call_args[1] == constants.STATUS_ERROR


class _ModelDownload:
    """Response for the model-file HTTP download."""

    def __init__(self, content):
        self.status_code = 200
        self.content = content

    def json(self):
        return json.loads(self.content)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


_REAL_REQUESTS_GET = requests.get


def _model_download(url, **kwargs):
    """Serve the test model index. Other HTTP GETs, including the MDF schema, pass through."""
    name = os.path.basename(str(url).split("?")[0])
    if name != "content.json":
        return _REAL_REQUESTS_GET(url, **kwargs)
    test_data = os.path.join(_project_root, "src", "test", "test_data", "content.json")
    with open(test_data, "rb") as handle:
        return _ModelDownload(handle.read())


def _install_model_cache(root):
    """Put test_mdf.yml where ModelFactory reads a local model file."""
    dest_dir = os.path.join(root, "local", "cache", "CRDC", "1.0.0")
    os.makedirs(dest_dir)
    src = os.path.join(_project_root, "src", "test", "test_data", "test_mdf.yml")
    shutil.copy(src, os.path.join(dest_dir, "test_mdf.yml"))


def _s3_list(names):
    """One list_objects_v2 page for the given file names under root/file/."""
    return {
        "Contents": [
            {"Key": f"root/file/{name}", "LastModified": None}
            for name in names
        ],
        "NextContinuationToken": None,
    }


def _run_real_delete(monkeypatch, list_page, file_errors=None, nodes_found=True, delete_orphaned=False, delete_records=True):
    """Run one delete through the real MetadataRemover.

    Mongo DAO methods and S3Bucket are mocked. requests.get serves the test model.
    @param monkeypatch pytest monkeypatch
    @param list_page list_objects_v2 return value or exception
    @param file_errors stored submission fileErrors
    @param nodes_found False when check_metadata_ids finds nothing
    @param delete_orphaned checkbox value
    @param delete_records delete_data_records return value
    @returns message, dao, and bucket
    """
    monkeypatch.delenv("ECS_AGENT_URI", raising=False)
    submission = {
        constants.ID: "sub-1",
        constants.DATA_COMMON_NAME: "CRDC",
        constants.MODEL_VERSION: "1.0.0",
        constants.BATCH_BUCKET: "test-bucket",
        constants.ROOT_PATH: "root",
        constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
        constants.FILE_ERRORS: list(file_errors or []),
    }
    dao = MagicMock()
    dao.get_submission.return_value = submission
    dao.check_metadata_ids.return_value = (
        [{constants.NODE_TYPE: "study", constants.NODE_ID: "study_a"}] if nodes_found else []
    )
    dao.delete_data_records.return_value = delete_records
    dao.get_nodes_by_parents.return_value = (True, [])
    dao.get_files_by_submission.return_value = []
    dao.find_batch_by_file_name.return_value = None

    bucket = MagicMock()
    bucket.bucket_name = "test-bucket"
    if isinstance(list_page, BaseException):
        bucket.client.list_objects_v2.side_effect = list_page
    else:
        bucket.client.list_objects_v2.return_value = list_page

    msg = _make_delete_message({
        constants.NODE_TYPE: "study",
        constants.NODE_IDS: ["study_a"],
        constants.DELETE_ORPHANED_DATA_FILES: delete_orphaned,
    })
    job_queue = MagicMock()
    job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]

    with tempfile.TemporaryDirectory() as model_root:
        _install_model_cache(model_root)
        configs = {
            constants.SQS_NAME: "test-queue",
            constants.MODEL_FILE_DIR: model_root,
            constants.TIER_CONFIG: "local",
        }
        with patch("common.utils.requests.get", side_effect=_model_download):
            with patch("metadata_remover.S3Bucket", return_value=bucket):
                try:
                    essentialValidate(configs, job_queue, dao)
                except KeyboardInterrupt:
                    pass
    return msg, dao, bucket


class TestRealDeleteScanFailure:
    """A scan that cannot finish does not delete metadata or acknowledge the message."""

    def test_listing_failure_keeps_the_message_and_does_not_delete(self, monkeypatch):
        msg, dao, bucket = _run_real_delete(monkeypatch, RuntimeError("list failed"))

        msg.delete.assert_not_called()
        dao.delete_data_records.assert_not_called()
        dao.set_submission_validation_status.assert_not_called()
        bucket.client.list_objects_v2.assert_called()

    def test_failed_delete_keeps_the_message_and_does_not_update_status(self, monkeypatch):
        """A failed metadata delete is not acknowledged and does not rewrite validation status."""
        msg, dao, bucket = _run_real_delete(monkeypatch, _s3_list([]), delete_records=False)

        msg.delete.assert_not_called()
        dao.delete_data_records.assert_called()
        dao.set_submission_validation_status.assert_not_called()
        bucket.client.list_objects_v2.assert_called_once()

    def test_missing_nodes_acknowledges_the_message_without_listing(self, monkeypatch):
        msg, dao, bucket = _run_real_delete(monkeypatch, _s3_list([]), nodes_found=False)

        msg.delete.assert_called_once()
        dao.check_metadata_ids.assert_called()
        bucket.client.list_objects_v2.assert_not_called()
        dao.delete_data_records.assert_not_called()


class TestCheckboxOffDedupesFileErrors:
    """Checkbox off unions fileErrors by submittedID using the real orphan scan."""

    def test_repeated_orphan_is_replaced_by_the_scan(self, monkeypatch):
        stored = {
            "submittedID": "orphan.csv",
            "validatedDate": "stored-date",
            "errors": [{"code": "F008"}],
        }
        msg, dao, bucket = _run_real_delete(
            monkeypatch,
            _s3_list(["orphan.csv", "new.csv"]),
            file_errors=[stored],
            delete_orphaned=False,
        )

        msg.delete.assert_called_once()
        call_args = dao.set_submission_validation_status.call_args[0]
        assert call_args[1] == constants.STATUS_ERROR
        file_errors = call_args[3]
        by_id = {}
        for row in file_errors:
            assert row["submittedID"] not in by_id
            by_id[row["submittedID"]] = row
        assert set(by_id) == {"orphan.csv", "new.csv"}
        assert by_id["orphan.csv"]["validatedDate"] != "stored-date"

    def test_empty_listing_keeps_the_stored_list(self, monkeypatch):
        stored = {
            "submittedID": "old.csv",
            "validatedDate": "stored-date",
            "errors": [{"code": "F008"}],
        }
        _msg, dao, _bucket = _run_real_delete(
            monkeypatch,
            _s3_list([]),
            file_errors=[stored],
            delete_orphaned=False,
        )

        call_args = dao.set_submission_validation_status.call_args[0]
        assert call_args[1] == constants.STATUS_ERROR
        assert call_args[3] == [stored]

    def test_new_orphan_is_appended_and_the_stored_row_stays(self, monkeypatch):
        stored = {
            "submittedID": "old.csv",
            "validatedDate": "stored-date",
            "errors": [{"code": "F008"}],
        }
        _msg, dao, _bucket = _run_real_delete(
            monkeypatch,
            _s3_list(["new.csv"]),
            file_errors=[stored],
            delete_orphaned=False,
        )

        call_args = dao.set_submission_validation_status.call_args[0]
        assert call_args[1] == constants.STATUS_ERROR
        file_errors = call_args[3]
        assert [row["submittedID"] for row in file_errors] == ["old.csv", "new.csv"]
        assert file_errors[0]["validatedDate"] == "stored-date"
