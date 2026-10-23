"""Unit tests for MongoDao DataSync methods: insert_data_sync, update_data_sync,
set_submission_data_sync_status, and find_in_progress_data_syncs.
"""
import re
from datetime import datetime
from unittest.mock import MagicMock, patch

from common.mongo_dao import MongoDao
from common.constants import (
    ID,
    SUBMISSION_ID,
    TYPE,
    STATUS,
    DATA_SYNC_SOURCE_FOLDER,
    DATA_SYNC_TARGET_FOLDER,
    DATA_SYNC_START_TIME,
    DATA_SYNC_END_TIME,
    DATA_SYNC_TASK_ARN,
    DATA_SYNC_TASK_EXECUTION_ARN,
    UPDATED_AT,
    DATA_SYNC_COLLECTION,
    SUBMISSION_COLLECTION,
    DATA_SYNC_TYPE_METADATA,
    DATA_SYNC_TYPE_FILE,
    DATA_SYNC_STATUS_IN_PROGRESS,
    DATA_SYNC_STATUS_SUCCEEDED,
    DATA_SYNC_STATUS_FAILED,
    METADATA_DATA_SYNC_STATUS,
    FILE_DATA_SYNC_STATUS,
)

UUID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def _setup_mock_collection(mock_client_class, collection_name):
    """Wire a MongoDao whose db[collection_name] is a fresh mock collection."""
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_db = MagicMock()
    mock_client.__getitem__.return_value = mock_db
    collection = MagicMock()

    def db_getitem(key):
        if key == collection_name:
            return collection
        return MagicMock()

    mock_db.__getitem__.side_effect = db_getitem
    return collection


def _setup_mock_collections(mock_client_class, *collection_names):
    """Wire a MongoDao whose db returns a distinct mock for each named collection."""
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_db = MagicMock()
    mock_client.__getitem__.return_value = mock_db
    collections = {name: MagicMock() for name in collection_names}

    def db_getitem(key):
        if key in collections:
            return collections[key]
        return MagicMock()

    mock_db.__getitem__.side_effect = db_getitem
    return collections


@patch("common.mongo_dao.MongoClient")
def test_insert_data_sync_writes_a_string_uuid_id(mock_client_class):
    """The dataSync document _id is a string UUID, not an ObjectId PyMongo would otherwise create."""
    _setup_mock_collection(mock_client_class, DATA_SYNC_COLLECTION)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    data_sync_id = dao.insert_data_sync("sub_1", DATA_SYNC_TYPE_METADATA, "src", "dest", DATA_SYNC_STATUS_IN_PROGRESS)

    assert isinstance(data_sync_id, str)
    assert UUID_PATTERN.match(data_sync_id)


@patch("common.mongo_dao.MongoClient")
def test_insert_data_sync_required_shape(mock_client_class):
    """The required fields are written, and startTime is a real datetime."""
    collection = _setup_mock_collection(mock_client_class, DATA_SYNC_COLLECTION)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    data_sync_id = dao.insert_data_sync("sub_1", DATA_SYNC_TYPE_FILE, "src", "dest", DATA_SYNC_STATUS_IN_PROGRESS)

    doc = collection.insert_one.call_args[0][0]
    assert doc[ID] == data_sync_id
    assert doc[SUBMISSION_ID] == "sub_1"
    assert doc[TYPE] == DATA_SYNC_TYPE_FILE
    assert doc[DATA_SYNC_SOURCE_FOLDER] == "src"
    assert doc[DATA_SYNC_TARGET_FOLDER] == "dest"
    assert doc[STATUS] == DATA_SYNC_STATUS_IN_PROGRESS
    assert isinstance(doc[DATA_SYNC_START_TIME], datetime)


@patch("common.mongo_dao.MongoClient")
def test_insert_data_sync_omits_optional_fields_by_default(mock_client_class):
    """taskArn, taskExecutionArn, and endTime are left out when not given."""
    collection = _setup_mock_collection(mock_client_class, DATA_SYNC_COLLECTION)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    dao.insert_data_sync("sub_1", DATA_SYNC_TYPE_METADATA, "src", "dest", DATA_SYNC_STATUS_IN_PROGRESS)

    doc = collection.insert_one.call_args[0][0]
    assert DATA_SYNC_TASK_ARN not in doc
    assert DATA_SYNC_TASK_EXECUTION_ARN not in doc
    assert DATA_SYNC_END_TIME not in doc


@patch("common.mongo_dao.MongoClient")
def test_insert_data_sync_includes_optional_fields_when_given(mock_client_class):
    """taskArn, taskExecutionArn, and endTime are written when provided (e.g. a start failure)."""
    collection = _setup_mock_collection(mock_client_class, DATA_SYNC_COLLECTION)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    end_time = datetime(2026, 1, 1)

    dao.insert_data_sync(
        "sub_1", DATA_SYNC_TYPE_FILE, "src", "dest", DATA_SYNC_STATUS_FAILED,
        task_arn="task-arn", task_execution_arn="exec-arn", end_time=end_time,
    )

    doc = collection.insert_one.call_args[0][0]
    assert doc[DATA_SYNC_TASK_ARN] == "task-arn"
    assert doc[DATA_SYNC_TASK_EXECUTION_ARN] == "exec-arn"
    assert doc[DATA_SYNC_END_TIME] == end_time


@patch("common.mongo_dao.MongoClient")
def test_insert_data_sync_returns_none_on_db_error(mock_client_class):
    collection = _setup_mock_collection(mock_client_class, DATA_SYNC_COLLECTION)
    collection.insert_one.side_effect = Exception("db error")
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.insert_data_sync("sub_1", DATA_SYNC_TYPE_METADATA, "src", "dest", DATA_SYNC_STATUS_IN_PROGRESS) is None


@patch("common.mongo_dao.MongoClient")
def test_update_data_sync_sets_status_only_by_default(mock_client_class):
    collection = _setup_mock_collection(mock_client_class, DATA_SYNC_COLLECTION)
    collection.update_one.return_value = MagicMock(matched_count=1)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    result = dao.update_data_sync("sync_1", DATA_SYNC_STATUS_IN_PROGRESS)

    assert result is True
    filter_arg, update_arg = collection.update_one.call_args[0]
    assert filter_arg == {ID: "sync_1"}
    assert update_arg == {"$set": {STATUS: DATA_SYNC_STATUS_IN_PROGRESS}}


@patch("common.mongo_dao.MongoClient")
def test_update_data_sync_sets_status_and_end_time(mock_client_class):
    collection = _setup_mock_collection(mock_client_class, DATA_SYNC_COLLECTION)
    collection.update_one.return_value = MagicMock(matched_count=1)
    dao = MongoDao("mongodb://localhost:27017", "test_db")
    end_time = datetime(2026, 1, 2)

    dao.update_data_sync("sync_1", DATA_SYNC_STATUS_SUCCEEDED, end_time)

    _, update_arg = collection.update_one.call_args[0]
    assert update_arg["$set"] == {STATUS: DATA_SYNC_STATUS_SUCCEEDED, DATA_SYNC_END_TIME: end_time}


@patch("common.mongo_dao.MongoClient")
def test_update_data_sync_returns_false_when_no_document_matches(mock_client_class):
    collection = _setup_mock_collection(mock_client_class, DATA_SYNC_COLLECTION)
    collection.update_one.return_value = MagicMock(matched_count=0)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.update_data_sync("missing", DATA_SYNC_STATUS_FAILED) is False


@patch("common.mongo_dao.MongoClient")
def test_update_data_sync_returns_false_on_db_error(mock_client_class):
    collection = _setup_mock_collection(mock_client_class, DATA_SYNC_COLLECTION)
    collection.update_one.side_effect = Exception("db error")
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.update_data_sync("sync_1", DATA_SYNC_STATUS_FAILED) is False


@patch("common.mongo_dao.MongoClient")
def test_set_submission_data_sync_status_writes_metadata_field(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION, DATA_SYNC_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.return_value = MagicMock(matched_count=1)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    result = dao.set_submission_data_sync_status("sub_1", DATA_SYNC_TYPE_METADATA, DATA_SYNC_STATUS_IN_PROGRESS)

    assert result is True
    filter_arg, update_arg = collections[SUBMISSION_COLLECTION].update_one.call_args[0]
    assert filter_arg == {ID: "sub_1"}
    assert update_arg == {"$set": {METADATA_DATA_SYNC_STATUS: DATA_SYNC_STATUS_IN_PROGRESS}}


@patch("common.mongo_dao.MongoClient")
def test_set_submission_data_sync_status_writes_file_field(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION, DATA_SYNC_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.return_value = MagicMock(matched_count=1)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    dao.set_submission_data_sync_status("sub_1", DATA_SYNC_TYPE_FILE, DATA_SYNC_STATUS_FAILED)

    _, update_arg = collections[SUBMISSION_COLLECTION].update_one.call_args[0]
    assert update_arg == {"$set": {FILE_DATA_SYNC_STATUS: DATA_SYNC_STATUS_FAILED}}


@patch("common.mongo_dao.MongoClient")
def test_set_submission_data_sync_status_does_not_touch_updated_at(mock_client_class):
    """Archival retention (getToBeArchivedSubmissions) is measured from updatedAt;
    a sync status write must not bump it or a completed submission's archival date moves out."""
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION, DATA_SYNC_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.return_value = MagicMock(matched_count=1)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    dao.set_submission_data_sync_status("sub_1", DATA_SYNC_TYPE_FILE, DATA_SYNC_STATUS_SUCCEEDED)

    _, update_arg = collections[SUBMISSION_COLLECTION].update_one.call_args[0]
    assert UPDATED_AT not in update_arg["$set"]


@patch("common.mongo_dao.MongoClient")
def test_set_submission_data_sync_status_rejects_unrecognized_type(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION, DATA_SYNC_COLLECTION)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.set_submission_data_sync_status("sub_1", "unknown", DATA_SYNC_STATUS_FAILED) is False
    collections[SUBMISSION_COLLECTION].update_one.assert_not_called()


@patch("common.mongo_dao.MongoClient")
def test_set_submission_data_sync_status_returns_false_on_db_error(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION, DATA_SYNC_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.side_effect = Exception("db error")
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.set_submission_data_sync_status("sub_1", DATA_SYNC_TYPE_METADATA, DATA_SYNC_STATUS_FAILED) is False


@patch("common.mongo_dao.MongoClient")
def test_set_submission_data_sync_status_writes_when_record_is_newest(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION, DATA_SYNC_COLLECTION)
    collections[DATA_SYNC_COLLECTION].find_one.return_value = {ID: "sync_1"}
    collections[SUBMISSION_COLLECTION].update_one.return_value = MagicMock(matched_count=1)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    result = dao.set_submission_data_sync_status(
        "sub_1", DATA_SYNC_TYPE_METADATA, DATA_SYNC_STATUS_SUCCEEDED, data_sync_id="sync_1",
    )

    assert result is True
    collections[DATA_SYNC_COLLECTION].find_one.assert_called_once()
    filter_arg, kwargs = collections[DATA_SYNC_COLLECTION].find_one.call_args[0][0], collections[DATA_SYNC_COLLECTION].find_one.call_args[1]
    assert filter_arg == {SUBMISSION_ID: "sub_1", TYPE: DATA_SYNC_TYPE_METADATA}
    assert kwargs["sort"][0][0] == DATA_SYNC_START_TIME
    collections[SUBMISSION_COLLECTION].update_one.assert_called_once()


@patch("common.mongo_dao.MongoClient")
def test_set_submission_data_sync_status_skips_when_newer_record_exists(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION, DATA_SYNC_COLLECTION)
    collections[DATA_SYNC_COLLECTION].find_one.return_value = {ID: "sync_newer"}
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    result = dao.set_submission_data_sync_status(
        "sub_1", DATA_SYNC_TYPE_FILE, DATA_SYNC_STATUS_SUCCEEDED, data_sync_id="sync_older",
    )

    assert result is False
    collections[SUBMISSION_COLLECTION].update_one.assert_not_called()


@patch("common.mongo_dao.MongoClient")
def test_set_submission_data_sync_status_writes_unconditionally_when_data_sync_id_is_none(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION, DATA_SYNC_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.return_value = MagicMock(matched_count=1)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    result = dao.set_submission_data_sync_status(
        "sub_1", DATA_SYNC_TYPE_METADATA, DATA_SYNC_STATUS_FAILED, data_sync_id=None,
    )

    assert result is True
    collections[DATA_SYNC_COLLECTION].find_one.assert_not_called()
    collections[SUBMISSION_COLLECTION].update_one.assert_called_once()


@patch("common.mongo_dao.MongoClient")
def test_find_in_progress_data_syncs_filter_shape(mock_client_class):
    collection = _setup_mock_collection(mock_client_class, DATA_SYNC_COLLECTION)
    collection.find.return_value = [{ID: "sync_1"}]
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    result = dao.find_in_progress_data_syncs()

    assert result == [{ID: "sync_1"}]
    collection.find.assert_called_once_with({
        STATUS: DATA_SYNC_STATUS_IN_PROGRESS,
        DATA_SYNC_TASK_EXECUTION_ARN: {"$exists": True, "$nin": [None, ""]},
    })


@patch("common.mongo_dao.MongoClient")
def test_find_in_progress_data_syncs_returns_empty_list_on_error(mock_client_class):
    collection = _setup_mock_collection(mock_client_class, DATA_SYNC_COLLECTION)
    collection.find.side_effect = Exception("db error")
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.find_in_progress_data_syncs() == []
