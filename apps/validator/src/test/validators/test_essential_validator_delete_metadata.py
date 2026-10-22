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
from test.utils.mock_mongo_dao import wire_mock_dao_replace_f008_qc_results


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
    """Resolve file status from remaining file records."""
    mock_mongo_dao.get_files_by_submission.return_value = file_records


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
    """A successful delete clears embedded fileErrors. F008 rows are qcResults."""

    def test_set_submission_validation_status_called_with_combined_file_errors(
        self, mock_configs, mock_mongo_dao
    ):
        """On successful delete with orphan_errors, file status is Error and fileErrors is empty."""
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
        assert call_args[3] == []
        assert call_args[4] is True

    def test_set_submission_validation_status_with_no_existing_file_errors(
        self, mock_configs, mock_mongo_dao
    ):
        """When the scan finds an orphan, file status is Error and fileErrors is empty."""
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
        assert call_args[3] == []

    def test_set_submission_validation_status_no_orphan_errors_keeps_existing_only(
        self, mock_configs, mock_mongo_dao
    ):
        """When the scan finds nothing, embedded fileErrors are cleared and file status is left unset."""
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
        assert call_args[1] is None
        assert call_args[3] == []


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
        assert call_args[3] == []

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
        mock_mongo_dao.get_files_by_submission.return_value = [{
            constants.S3_FILE_INFO: {constants.STATUS: constants.STATUS_PASSED},
        }]

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

    def test_checkbox_on_empty_scan_keeps_new_from_remaining_file_nodes(
        self, mock_configs, mock_mongo_dao
    ):
        """An empty scan must not mark unvalidated New file nodes as Passed."""
        deleted_error = {"submittedID": "associated.tsv", "errors": [{"code": "F008"}]}
        _use_real_file_status_from_records(mock_mongo_dao, [{
            constants.S3_FILE_INFO: {constants.STATUS: constants.STATUS_NEW},
        }])
        _run_checkbox_on_delete(
            mock_configs,
            mock_mongo_dao,
            deleted_error,
            (True, []),
            constants.STATUS_ERROR,
        )

        call_args = mock_mongo_dao.set_submission_validation_status.call_args[0]
        assert call_args[1] == constants.STATUS_NEW
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


def _run_real_delete(
    monkeypatch,
    list_page,
    file_errors=None,
    nodes_found=True,
    delete_orphaned=False,
    delete_records=(True, None),
    plan_clear_fails=False,
    get_files_by_submission=None,
):
    """Run one delete through the real MetadataRemover.

    Mongo DAO methods and S3Bucket are mocked. requests.get serves the test model.
    @param monkeypatch pytest monkeypatch
    @param list_page list_objects_v2 return value or exception
    @param file_errors stored submission fileErrors
    @param nodes_found False when check_metadata_ids finds nothing
    @param delete_orphaned checkbox value
    @param delete_records delete_data_records return value, (succeeded, message)
    @param plan_clear_fails True when the pending-plan unset returns False
    @param get_files_by_submission optional side_effect for get_files_by_submission
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
    if get_files_by_submission is not None:
        dao.get_files_by_submission.side_effect = get_files_by_submission
    else:
        dao.get_files_by_submission.return_value = []
    dao.find_batch_by_file_name.return_value = None
    dao.node_keys_by_submission.return_value = set()
    dao.parent_refs_by_submission.return_value = []
    if plan_clear_fails:
        dao.set_pending_metadata_delete.side_effect = [True, False]

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

    wire_mock_dao_replace_f008_qc_results(dao)

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
        msg, dao, bucket = _run_real_delete(
            monkeypatch, _s3_list([]), delete_records=(False, "db error")
        )

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


def _run_interrupted_delete(monkeypatch, passes, child=None):
    """Delete a study, fail while loading its child, and optionally redeliver.

    The first pass removes the study, then the child lookup fails.
    A second pass finds no study. The child and an unreferenced S3 object remain.
    @param monkeypatch pytest monkeypatch
    @param passes 1 or 2 deliveries of the same message
    @param child optional child document used instead of the default sample
    @returns submission, message, dao, and bucket
    """
    monkeypatch.delenv("ECS_AGENT_URI", raising=False)
    study = {constants.NODE_TYPE: "study", constants.NODE_ID: "study_a"}
    if child is None:
        child = {
            constants.NODE_TYPE: "sample",
            constants.NODE_ID: "file_1",
            constants.PARENTS: [{
                constants.PARENT_TYPE: "study",
                constants.PARENT_ID_VAL: "study_a",
            }],
        }
    live = {"study_a": study}
    submission = {
        constants.ID: "sub-1",
        constants.DATA_COMMON_NAME: "CRDC",
        constants.MODEL_VERSION: "1.0.0",
        constants.BATCH_BUCKET: "test-bucket",
        constants.ROOT_PATH: "root",
        constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
        constants.FILE_ERRORS: [],
    }
    parent_lookups = [
        (True, [child]),
        (True, []),
        (False, None),
    ]

    dao = MagicMock()
    dao.get_submission.return_value = submission

    def check_metadata_ids(node_type, node_ids, submission_id):
        return [
            live[node_id] for node_id in node_ids
            if live.get(node_id, {}).get(constants.NODE_TYPE) == node_type
        ]

    def delete_data_records(nodes):
        for node in nodes:
            live.pop(node.get(constants.NODE_ID), None)
        return (True, None)

    def get_nodes_by_parents(parents, submission_id):
        if parent_lookups:
            return parent_lookups.pop(0)
        found = [child] if any(
            parent.get(constants.NODE_ID) == "study_a" for parent in parents
        ) else []
        return True, found

    dao.check_metadata_ids.side_effect = check_metadata_ids
    dao.delete_data_records.side_effect = delete_data_records
    dao.get_nodes_by_parents.side_effect = get_nodes_by_parents
    dao.get_files_by_submission.return_value = []
    dao.find_batch_by_file_name.return_value = None
    dao.node_keys_by_submission.return_value = set()
    dao.parent_refs_by_submission.return_value = []
    dao.update_data_records.return_value = (True, None)

    bucket = MagicMock()
    bucket.bucket_name = "test-bucket"
    bucket.client.list_objects_v2.return_value = _s3_list(["orphan.csv"])

    msg = _make_delete_message({
        constants.NODE_TYPE: "study",
        constants.NODE_IDS: ["study_a"],
        constants.DELETE_ORPHANED_DATA_FILES: False,
    })
    deliveries = [[msg] for _ in range(passes)]
    job_queue = MagicMock()
    job_queue.receiveMsgs.side_effect = deliveries + [KeyboardInterrupt]

    wire_mock_dao_replace_f008_qc_results(dao)

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
    return submission, msg, dao, bucket


class TestPartialDeleteRedelivery:
    """A delete that removes roots and then fails is finished when the message returns."""

    def test_partial_delete_stores_plan_and_keeps_the_message(self, monkeypatch):
        """The first pass keeps the message and records the nodes still to delete."""
        submission, msg, dao, _bucket = _run_interrupted_delete(monkeypatch, passes=1)

        msg.delete.assert_not_called()
        dao.set_submission_validation_status.assert_not_called()
        plan = submission.get("pendingMetadataDelete")
        assert isinstance(plan, dict)
        assert plan["nodeType"] == "study"
        assert plan["nodeIDs"] == ["study_a"]
        assert plan["deleteAll"] is False
        assert plan["deleteOrphanedDataFiles"] is False
        assert "nodes" not in plan
        assert "s3FileNames" not in plan
        assert "removedFileNames" not in plan

    def test_redelivery_finishes_cleanup_and_writes_file_errors(self, monkeypatch):
        """Redelivery deletes the remaining child, writes the orphan qcResult, and then acknowledges."""
        child = {
            constants.NODE_TYPE: "sample",
            constants.NODE_ID: "file_1",
            constants.QC_RESULT_ID: "qc-node",
            constants.S3_FILE_INFO: {constants.QC_RESULT_ID: "qc-file"},
            constants.PARENTS: [{
                constants.PARENT_TYPE: "study",
                constants.PARENT_ID_VAL: "study_a",
            }],
        }
        _submission, msg, dao, _bucket = _run_interrupted_delete(monkeypatch, passes=2, child=child)

        deleted_children = [
            node for call in dao.delete_data_records.call_args_list
            for node in call.args[0]
            if node.get(constants.NODE_ID) == "file_1"
        ]
        assert deleted_children
        assert deleted_children[-1].get(constants.QC_RESULT_ID) == "qc-node"
        assert deleted_children[-1][constants.S3_FILE_INFO][constants.QC_RESULT_ID] == "qc-file"
        assert dao.set_submission_validation_status.call_args[0][3] == []
        saved = [
            row for call in dao.save_qc_results.call_args_list
            for row in call.args[0]
        ]
        assert [row.get("submittedID") for row in saved] == ["orphan.csv"]
        assert saved[0]["_id"]
        msg.delete.assert_called_once()


class TestCheckboxOffDedupesFileErrors:
    """Checkbox off writes the scan to qcResults and clears embedded fileErrors."""

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
        assert call_args[3] == []
        dao.delete_f008_qc_results.assert_called_once_with("sub-1")
        saved = dao.save_qc_results.call_args[0][0]
        assert {row["submittedID"] for row in saved} == {"orphan.csv", "new.csv"}
        assert all(row["_id"] for row in saved)
        assert all(row["submittedID"] != "orphan.csv" or row["validatedDate"] != "stored-date" for row in saved)

    def test_empty_listing_clears_embedded_file_errors(self, monkeypatch):
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
        assert call_args[1] is None
        assert call_args[3] == []
        dao.save_qc_results.assert_not_called()

    def test_new_orphan_is_a_qc_result_and_embedded_errors_are_cleared(self, monkeypatch):
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
        assert call_args[3] == []
        saved = dao.save_qc_results.call_args[0][0]
        assert [row["submittedID"] for row in saved] == ["new.csv"]


class TestConflictingPendingPlan:
    """A mismatched delete message must not overwrite pendingMetadataDelete."""

    def test_conflicting_pending_plan_keeps_the_message(self, monkeypatch):
        monkeypatch.delenv("ECS_AGENT_URI", raising=False)
        submission = {
            constants.ID: "sub-1",
            constants.DATA_COMMON_NAME: "CRDC",
            constants.MODEL_VERSION: "1.0.0",
            constants.BATCH_BUCKET: "test-bucket",
            constants.ROOT_PATH: "root",
            constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
            constants.FILE_ERRORS: [],
            "pendingMetadataDelete": {
                constants.NODE_TYPE: "study",
                constants.NODE_IDS: ["study_a"],
                constants.DELETE_ALL: False,
                constants.EXCLUSIVE_IDS: [],
                constants.DELETE_ORPHANED_DATA_FILES: False,
            },
        }
        dao = MagicMock()
        dao.get_submission.return_value = submission
        msg = _make_delete_message({
            constants.NODE_TYPE: "study",
            constants.NODE_IDS: ["study_b"],
            constants.DELETE_ORPHANED_DATA_FILES: False,
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
                with patch("metadata_remover.S3Bucket", return_value=MagicMock()):
                    try:
                        essentialValidate(configs, job_queue, dao)
                    except KeyboardInterrupt:
                        pass

        msg.delete.assert_not_called()
        dao.delete_data_records.assert_not_called()
        dao.set_pending_metadata_delete.assert_not_called()
        assert submission["pendingMetadataDelete"]["nodeIDs"] == ["study_a"]


class TestFileRecordsReloadAfterDelete:
    """Checkbox-on status update fails closed when the file manifest cannot be reloaded."""

    def test_none_manifest_after_delete_keeps_the_message(self, monkeypatch):
        manifest_reads = []

        def get_files(_submission_id):
            manifest_reads.append(1)
            if len(manifest_reads) <= 2:
                return []
            return None

        msg, dao, _bucket = _run_real_delete(
            monkeypatch,
            _s3_list([]),
            delete_orphaned=True,
            get_files_by_submission=get_files,
        )

        msg.delete.assert_not_called()
        dao.set_submission_validation_status.assert_not_called()


class TestDeleteAllResumeAndPlanClear:
    """deleteAll resume does not depend on an expanded id list."""

    def test_delete_all_redelivery_finishes_without_stored_id_list(self, monkeypatch):
        """Redelivery resolves remaining roots in memory; the child is still deleted."""
        monkeypatch.delenv("ECS_AGENT_URI", raising=False)
        study = {constants.NODE_TYPE: "study", constants.NODE_ID: "study_a"}
        child = {
            constants.NODE_TYPE: "sample",
            constants.NODE_ID: "file_1",
            constants.PARENTS: [{
                constants.PARENT_TYPE: "study",
                constants.PARENT_ID_VAL: "study_a",
            }],
        }
        submission = {
            constants.ID: "sub-1",
            constants.DATA_COMMON_NAME: "CRDC",
            constants.MODEL_VERSION: "1.0.0",
            constants.BATCH_BUCKET: "test-bucket",
            constants.ROOT_PATH: "root",
            constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
            constants.FILE_ERRORS: [],
        }
        search_ids = [["study_a"], ["study_a"], []]
        parent_lookups = [
            (True, [child]),
            (True, []),
            (False, None),
        ]
        dao = MagicMock()
        dao.get_submission.return_value = submission

        def search_nodes(node_type, submission_id, exclusive_ids=None):
            return search_ids.pop(0) if search_ids else []

        def get_nodes_by_parents(parents, submission_id):
            if parent_lookups:
                return parent_lookups.pop(0)
            found = [child] if any(parent.get(constants.NODE_ID) == "study_a" for parent in parents) else []
            return True, found

        dao.search_nodes_by_type_and_submission.side_effect = search_nodes
        dao.check_metadata_ids.return_value = [study]
        dao.get_nodes_by_parents.side_effect = get_nodes_by_parents
        dao.delete_data_records.return_value = (True, None)
        dao.update_data_records.return_value = (True, None)
        dao.get_files_by_submission.return_value = []
        dao.find_batch_by_file_name.return_value = None
        dao.node_keys_by_submission.return_value = {("sample", "file_1")}
        dao.parent_refs_by_submission.return_value = [{
            constants.PARENTS: child[constants.PARENTS],
        }]
        bucket = MagicMock()
        bucket.bucket_name = "test-bucket"
        bucket.client.list_objects_v2.return_value = _s3_list(["orphan.csv"])
        msg = _make_delete_message({
            constants.NODE_TYPE: "study",
            constants.NODE_IDS: [],
            constants.DELETE_ALL: True,
            constants.EXCLUSIVE_IDS: ["keep_me"],
            constants.DELETE_ORPHANED_DATA_FILES: False,
        })
        job_queue = MagicMock()
        job_queue.receiveMsgs.side_effect = [[msg], [msg], KeyboardInterrupt]
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

        assert dao.search_nodes_by_type_and_submission.call_count >= 2
        stored_plan = dao.set_pending_metadata_delete.call_args_list[0].args[1]
        assert stored_plan["nodeIDs"] == []
        assert stored_plan["deleteAll"] is True
        assert "nodes" not in stored_plan
        deleted_ids = [
            node.get(constants.NODE_ID)
            for call in dao.delete_data_records.call_args_list
            for node in call.args[0]
        ]
        assert "file_1" in deleted_ids
        msg.delete.assert_called_once()

    def test_resume_deletes_file_whose_parent_record_is_gone(self, monkeypatch):
        """A file that only points at an already-deleted parent is removed on resume."""
        monkeypatch.delenv("ECS_AGENT_URI", raising=False)
        orphan_file = {
            constants.NODE_TYPE: "CDSFile",
            constants.NODE_ID: "file_orphan",
            constants.QC_RESULT_ID: "qc-node",
            constants.S3_FILE_INFO: {constants.FILE_NAME: "gone.tsv", constants.QC_RESULT_ID: "qc-file"},
            constants.PARENTS: [{
                constants.PARENT_TYPE: "sample",
                constants.PARENT_ID_VAL: "sample_1",
            }],
        }
        submission = {
            constants.ID: "sub-1",
            constants.DATA_COMMON_NAME: "CRDC",
            constants.MODEL_VERSION: "1.0.0",
            constants.BATCH_BUCKET: "test-bucket",
            constants.ROOT_PATH: "root",
            constants.METADATA_VALIDATION_STATUS: constants.STATUS_PASSED,
            constants.FILE_ERRORS: [],
            "pendingMetadataDelete": {
                "nodeType": "study",
                "nodeIDs": ["study_a"],
                "deleteAll": False,
                "exclusiveIDs": [],
                "deleteOrphanedDataFiles": False,
            },
        }
        dao = MagicMock()
        dao.get_submission.return_value = submission
        dao.check_metadata_ids.return_value = []
        dao.get_files_by_submission.return_value = []
        dao.find_batch_by_file_name.return_value = None
        dao.node_keys_by_submission.return_value = {("CDSFile", "file_orphan")}
        dao.parent_refs_by_submission.return_value = [{constants.PARENTS: orphan_file[constants.PARENTS]}]
        dao.delete_data_records.return_value = (True, None)
        dao.update_data_records.return_value = (True, None)

        def get_nodes_by_parents(parents, submission_id):
            if any(parent.get(constants.NODE_ID) == "sample_1" for parent in parents):
                return True, [orphan_file]
            return True, []

        dao.get_nodes_by_parents.side_effect = get_nodes_by_parents
        bucket = MagicMock()
        bucket.bucket_name = "test-bucket"
        bucket.client.list_objects_v2.return_value = _s3_list([])
        msg = _make_delete_message({
            constants.NODE_TYPE: "study",
            constants.NODE_IDS: ["study_a"],
            constants.DELETE_ORPHANED_DATA_FILES: False,
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

        deleted = [
            node for call in dao.delete_data_records.call_args_list
            for node in call.args[0]
        ]
        deleted_orphan = next(node for node in deleted if node.get(constants.NODE_ID) == "file_orphan")
        assert deleted_orphan.get(constants.QC_RESULT_ID) == "qc-node"
        assert deleted_orphan[constants.S3_FILE_INFO][constants.QC_RESULT_ID] == "qc-file"
        msg.delete.assert_called_once()

    def test_failed_plan_clear_does_not_acknowledge(self, monkeypatch):
        """A failed unset leaves the message and does not rewrite validation status."""
        msg, dao, _bucket = _run_real_delete(monkeypatch, _s3_list([]), plan_clear_fails=True)

        msg.delete.assert_not_called()
        dao.set_submission_validation_status.assert_not_called()
