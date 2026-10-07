"""Unit tests for MongoDao.set_submission_validation_status, especially scope='new' only-update-if-worse behavior."""
import pytest
from unittest.mock import MagicMock, patch
from pymongo import errors

from common.mongo_dao import MongoDao
from common.constants import (
    SUBMISSION_COLLECTION,
    DATA_COLLECTION,
    ID,
    SUBMISSION_ID,
    METADATA_VALIDATION_STATUS,
    VALIDATION_ENDED,
    FILE_ERRORS,
    FILE_VALIDATION_STATUS,
    STATUS_ERROR,
    STATUS_NEW,
    STATUS_PASSED,
    STATUS_WARNING,
    S3_FILE_INFO,
    STATUS,
    VALIDATION_COLLECTION,
    VALIDATION_STATUS,
)


def _setup_mock_db(mock_client_class):
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_db = MagicMock()
    mock_client.__getitem__.return_value = mock_db
    mock_submission_collection = MagicMock()
    mock_submission_collection.update_one.return_value = MagicMock(matched_count=1)

    def db_getitem(key):
        if key == SUBMISSION_COLLECTION:
            return mock_submission_collection
        return MagicMock()

    mock_db.__getitem__.side_effect = db_getitem
    return mock_submission_collection


@patch("common.mongo_dao.MongoClient")
def test_scope_new_current_worse_than_new_do_not_overwrite(mock_client_class):
    """scope='new', current status Error, new Passed: do not overwrite (keep Error)."""
    mock_submission_collection = _setup_mock_db(mock_client_class)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    with patch.object(dao, "count_docs", return_value=0):
        submission = {ID: "sub_1", METADATA_VALIDATION_STATUS: STATUS_ERROR}
        dao.set_submission_validation_status(
            submission, None, STATUS_PASSED, None, status_detail=None, scope="new"
        )
    update_one_call = mock_submission_collection.update_one.call_args
    set_payload = update_one_call[0][1]["$set"]
    assert set_payload[METADATA_VALIDATION_STATUS] == STATUS_ERROR


@patch("common.mongo_dao.MongoClient")
def test_scope_new_new_worse_than_current_update(mock_client_class):
    """scope='new', current Passed, new Error: update to Error."""
    mock_submission_collection = _setup_mock_db(mock_client_class)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    with patch.object(dao, "count_docs", return_value=0):
        submission = {ID: "sub_1", METADATA_VALIDATION_STATUS: STATUS_PASSED}
        dao.set_submission_validation_status(
            submission, None, STATUS_ERROR, None, status_detail=None, scope="new"
        )
    update_one_call = mock_submission_collection.update_one.call_args
    set_payload = update_one_call[0][1]["$set"]
    assert set_payload[METADATA_VALIDATION_STATUS] == STATUS_ERROR


@patch("common.mongo_dao.MongoClient")
def test_scope_new_current_none_treat_as_passed_passed(mock_client_class):
    """scope='new', no current status (treated as Passed): write Passed."""
    mock_submission_collection = _setup_mock_db(mock_client_class)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    with patch.object(dao, "count_docs", return_value=0):
        submission = {ID: "sub_1"}
        dao.set_submission_validation_status(
            submission, None, STATUS_PASSED, None, status_detail=None, scope="new"
        )
    update_one_call = mock_submission_collection.update_one.call_args
    set_payload = update_one_call[0][1]["$set"]
    assert set_payload[METADATA_VALIDATION_STATUS] == STATUS_PASSED


@patch("common.mongo_dao.MongoClient")
def test_scope_new_current_none_treat_as_passed_warning(mock_client_class):
    """scope='new', no current status (treated as Passed): write Warning when new is Warning."""
    mock_submission_collection = _setup_mock_db(mock_client_class)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    with patch.object(dao, "count_docs", return_value=0):
        submission = {ID: "sub_1"}
        dao.set_submission_validation_status(
            submission, None, STATUS_WARNING, None, status_detail=None, scope="new"
        )
    update_one_call = mock_submission_collection.update_one.call_args
    set_payload = update_one_call[0][1]["$set"]
    assert set_payload[METADATA_VALIDATION_STATUS] == STATUS_WARNING


@patch("common.mongo_dao.MongoClient")
def test_file_errors_persisted_without_file_status(mock_client_class):
    """fileErrors updates FILE_ERRORS when file_status is None (e.g. delete-metadata orphan F008)."""
    mock_submission_collection = _setup_mock_db(mock_client_class)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    file_err = [{"submittedID": "orphan.csv", "errors": [{"code": "F008"}]}]
    with patch.object(dao, "count_docs", return_value=0):
        with patch.object(dao.s3_service, "submissionHasDataFile", return_value=False):
            submission = {ID: "sub_1", METADATA_VALIDATION_STATUS: STATUS_PASSED}
            dao.set_submission_validation_status(
                submission, None, STATUS_PASSED, file_err, is_delete=True
            )
    update_one_call = mock_submission_collection.update_one.call_args
    set_payload = update_one_call[0][1]["$set"]
    assert set_payload[FILE_ERRORS] == file_err


@patch("common.mongo_dao.MongoClient")
def test_scope_all_overwrites_regardless(mock_client_class):
    """scope='all': overwrite current status (no only-if-worse rule)."""
    mock_submission_collection = _setup_mock_db(mock_client_class)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    with patch.object(dao, "count_docs", return_value=0):
        submission = {ID: "sub_1", METADATA_VALIDATION_STATUS: STATUS_ERROR}
        dao.set_submission_validation_status(
            submission, None, STATUS_PASSED, None, status_detail=None, scope="all"
        )
    update_one_call = mock_submission_collection.update_one.call_args
    set_payload = update_one_call[0][1]["$set"]
    assert set_payload[METADATA_VALIDATION_STATUS] == STATUS_PASSED


@patch("common.mongo_dao.MongoClient")
def test_set_cross_submission_status_writes_only_that_field(mock_client_class):
    """Cross-submission close-out writes crossSubmissionStatus and does not touch file or metadata status."""
    mock_submission_collection = _setup_mock_db(mock_client_class)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    from common.constants import CROSS_SUBMISSION_VALIDATION_STATUS, FILE_VALIDATION_STATUS
    submission = {ID: "sub_1"}
    dao.set_cross_submission_status(submission, STATUS_ERROR)
    set_payload = mock_submission_collection.update_one.call_args[0][1]["$set"]
    assert set_payload[CROSS_SUBMISSION_VALIDATION_STATUS] == STATUS_ERROR
    assert METADATA_VALIDATION_STATUS not in set_payload
    assert FILE_VALIDATION_STATUS not in set_payload


@patch("common.mongo_dao.MongoClient")
def test_atomic_update_validation_matches_expected_status(mock_client_class):
    """Terminal validation writes include the expected status in the match query."""
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_db = MagicMock()
    mock_client.__getitem__.return_value = mock_db
    mock_validation_collection = MagicMock()

    def db_getitem(key):
        if key == VALIDATION_COLLECTION:
            return mock_validation_collection
        return MagicMock()

    mock_db.__getitem__.side_effect = db_getitem
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    dao.atomic_update_validation(
        "val_1", {VALIDATION_STATUS: STATUS_ERROR}, expected_status="Validating",
    )
    query = mock_validation_collection.find_one_and_update.call_args[0][0]
    assert query == {ID: "val_1", VALIDATION_STATUS: "Validating"}


@patch("common.mongo_dao.MongoClient")
def test_get_submission_reraises_read_errors(mock_client_class):
    """A submission read exception is not converted into a missing submission."""
    mock_submission_collection = _setup_mock_db(mock_client_class)
    mock_submission_collection.find_one.side_effect = errors.PyMongoError("db error")
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    with pytest.raises(errors.PyMongoError):
        dao.get_submission("sub_1")


@patch("common.mongo_dao.MongoClient")
def test_get_file_reraises_read_errors(mock_client_class):
    """A file read exception is not converted into a missing file."""
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_db = MagicMock()
    mock_client.__getitem__.return_value = mock_db
    mock_file_collection = MagicMock()
    mock_file_collection.find_one.side_effect = errors.PyMongoError("db error")

    def db_getitem(key):
        if key == DATA_COLLECTION:
            return mock_file_collection
        return MagicMock()

    mock_db.__getitem__.side_effect = db_getitem
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    with pytest.raises(errors.PyMongoError):
        dao.get_file("file_1")


@patch("common.mongo_dao.MongoClient")
def test_get_validation_reraises_read_errors(mock_client_class):
    """A validation read exception is not converted into a missing validation."""
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_db = MagicMock()
    mock_client.__getitem__.return_value = mock_db
    mock_validation_collection = MagicMock()
    mock_validation_collection.find_one.side_effect = errors.PyMongoError("db error")

    def db_getitem(key):
        if key == VALIDATION_COLLECTION:
            return mock_validation_collection
        return MagicMock()

    mock_db.__getitem__.side_effect = db_getitem
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    with pytest.raises(errors.PyMongoError):
        dao.get_validation("val_1")


@patch("common.mongo_dao.MongoClient")
def test_set_cross_submission_status_reraises_write_errors(mock_client_class):
    """A cross-submission write exception is not converted into a false result."""
    mock_submission_collection = _setup_mock_db(mock_client_class)
    mock_submission_collection.update_one.side_effect = errors.PyMongoError("db error")
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    with pytest.raises(errors.PyMongoError):
        dao.set_cross_submission_status({ID: "sub_1"}, STATUS_ERROR)


@patch("common.mongo_dao.MongoClient")
def test_submission_file_status_from_records_uses_worst_stored_file(mock_client_class):
    """Leftover Error file nodes raise the run's Passed status to Error."""
    _setup_mock_db(mock_client_class)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    dao.get_files_by_submission = MagicMock(return_value=[
        {S3_FILE_INFO: {STATUS: STATUS_WARNING}},
        {S3_FILE_INFO: {STATUS: STATUS_ERROR}},
    ])
    assert dao.submission_file_status_from_records("sub_1", STATUS_PASSED) == STATUS_ERROR


@patch("common.mongo_dao.MongoClient")
def test_submission_file_status_from_records_raises_when_files_cannot_load(mock_client_class):
    """A file-record lookup failure is retryable."""
    _setup_mock_db(mock_client_class)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    dao.get_files_by_submission = MagicMock(return_value=None)
    with pytest.raises(Exception, match="Failed to load file records"):
        dao.submission_file_status_from_records("sub_1", STATUS_PASSED)


def _stub_s3_list(dao, pages):
    """Stub the boto paginator used by submissionHasDataFile."""
    paginator = MagicMock()
    paginator.paginate.return_value = pages
    dao.s3_service.s3_client.get_paginator = MagicMock(return_value=paginator)
    return paginator


def _delete_with_no_file_nodes(mock_client_class, pages):
    """Write a delete close-out when no file nodes remain and fileErrors is empty."""
    mock_submission_collection = _setup_mock_db(mock_client_class)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    paginator = _stub_s3_list(dao, pages)
    with patch.object(dao, "count_docs", return_value=0):
        dao.set_submission_validation_status(
            {
                ID: "sub_1",
                METADATA_VALIDATION_STATUS: STATUS_PASSED,
                "bucketName": "bucket",
                "rootPath": "root",
            },
            STATUS_PASSED,
            STATUS_PASSED,
            [],
            is_delete=True,
        )
    set_payload = mock_submission_collection.update_one.call_args[0][1]["$set"]
    return set_payload, paginator


@patch("common.mongo_dao.MongoClient")
def test_delete_with_no_file_nodes_and_no_s3_objects_clears_file_status(mock_client_class):
    """An empty delete scan with no remaining files stores null, not Passed."""
    set_payload, paginator = _delete_with_no_file_nodes(mock_client_class, [{}])
    paginator.paginate.assert_called()
    assert set_payload[FILE_VALIDATION_STATUS] is None


@patch("common.mongo_dao.MongoClient")
def test_delete_with_no_file_nodes_and_s3_objects_sets_new(mock_client_class):
    """An empty delete scan with S3 objects still in the file folder stores New, not Passed."""
    set_payload, paginator = _delete_with_no_file_nodes(
        mock_client_class,
        [{"Contents": [{"Key": "root/file/a.csv"}]}],
    )
    paginator.paginate.assert_called()
    assert set_payload[FILE_VALIDATION_STATUS] == STATUS_NEW
