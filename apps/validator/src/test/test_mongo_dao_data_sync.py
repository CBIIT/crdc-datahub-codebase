"""Unit tests for MongoDao DataSync tracking writes."""
from datetime import datetime
from unittest.mock import MagicMock, patch

from pymongo.errors import DuplicateKeyError

from common.mongo_dao import MongoDao
from common.constants import (
    ID,
    UPDATED_AT,
    DATA_SYNC_SOURCE_FOLDER,
    DATA_SYNC_TARGET_FOLDER,
    DATA_SYNC_START_TIME,
    DATA_SYNC_LIST_PENDING,
    DATA_SYNC_ROLLUP_PENDING,
    DATA_SYNC_CLEANUP_AFTER,
    DATA_SYNC_TASK_ARN,
    DATA_SYNC_COLLECTION,
    SUBMISSION_COLLECTION,
    DATA_SYNC_TYPE_METADATA,
    DATA_SYNC_TYPE_FILE,
    DATA_SYNC_STATUS_IN_PROGRESS,
    DATA_SYNC_STATUS_SUCCEEDED,
    DATA_SYNC_STATUS_FAILED,
    METADATA_DATA_SYNC_STATUS,
    FILE_DATA_SYNC_STATUS,
    METADATA_DATA_SYNC_ACTIVE,
    FILE_DATA_SYNC_ACTIVE,
    METADATA_DATA_SYNC_OVERLAP_FAILED,
    FILE_DATA_SYNC_OVERLAP_FAILED,
    DATA_SYNC_WRITE_APPLIED,
    DATA_SYNC_WRITE_STALE,
    DATA_SYNC_WRITE_ERROR,
    STATUS,
)

START = datetime(2026, 1, 1, 0, 0, 0)
SYNC_ID = "sync-1"


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


def _matched(count):
    result = MagicMock()
    result.matched_count = count
    return result


def _assert_no_updated_at(update):
    text = str(update)
    assert UPDATED_AT not in text


@patch("common.mongo_dao.MongoClient")
def test_insert_data_sync_uses_given_id_and_sets_list_pending(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, DATA_SYNC_COLLECTION)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    outcome = dao.insert_data_sync(
        "sub_1", DATA_SYNC_TYPE_METADATA, "src", "dest", DATA_SYNC_STATUS_IN_PROGRESS, SYNC_ID, START,
    )

    assert outcome == DATA_SYNC_WRITE_APPLIED
    doc = collections[DATA_SYNC_COLLECTION].insert_one.call_args.args[0]
    assert doc[ID] == SYNC_ID
    assert doc[DATA_SYNC_START_TIME] == START
    assert doc[DATA_SYNC_LIST_PENDING] is True
    assert doc[DATA_SYNC_ROLLUP_PENDING] is False
    assert doc[DATA_SYNC_SOURCE_FOLDER] == "src"
    assert doc[DATA_SYNC_TARGET_FOLDER] == "dest"
    assert DATA_SYNC_TASK_ARN not in doc
    _assert_no_updated_at(doc)


@patch("common.mongo_dao.MongoClient")
def test_insert_data_sync_duplicate_key_is_applied(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, DATA_SYNC_COLLECTION)
    collections[DATA_SYNC_COLLECTION].insert_one.side_effect = DuplicateKeyError("duplicate")
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.insert_data_sync(
        "sub_1", DATA_SYNC_TYPE_FILE, "src", "dest", DATA_SYNC_STATUS_IN_PROGRESS, SYNC_ID, START,
    ) == DATA_SYNC_WRITE_APPLIED


@patch("common.mongo_dao.MongoClient")
def test_insert_data_sync_returns_error_and_logs_ids(mock_client_class, caplog):
    collections = _setup_mock_collections(mock_client_class, DATA_SYNC_COLLECTION)
    collections[DATA_SYNC_COLLECTION].insert_one.side_effect = Exception("down")
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.insert_data_sync(
        "sub_1", DATA_SYNC_TYPE_METADATA, "src", "dest", DATA_SYNC_STATUS_IN_PROGRESS, SYNC_ID, START,
    ) == DATA_SYNC_WRITE_ERROR
    assert "sub_1" in caplog.text
    assert SYNC_ID in caplog.text


@patch("common.mongo_dao.MongoClient")
def test_update_data_sync_never_upserts_and_returns_stale_when_missing(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, DATA_SYNC_COLLECTION)
    collections[DATA_SYNC_COLLECTION].update_one.return_value = _matched(0)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    outcome = dao.update_data_sync(SYNC_ID, {STATUS: DATA_SYNC_STATUS_FAILED})

    assert outcome == DATA_SYNC_WRITE_STALE
    args, kwargs = collections[DATA_SYNC_COLLECTION].update_one.call_args
    assert args[0] == {ID: SYNC_ID}
    assert kwargs.get("upsert") is not True
    assert "upsert" not in kwargs
    _assert_no_updated_at(args[1])


@patch("common.mongo_dao.MongoClient")
def test_update_data_sync_merges_match_fields_and_returns_stale_when_guard_misses(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, DATA_SYNC_COLLECTION)
    collections[DATA_SYNC_COLLECTION].update_one.return_value = _matched(0)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    outcome = dao.update_data_sync(
        SYNC_ID,
        {STATUS: DATA_SYNC_STATUS_FAILED},
        match_fields={STATUS: DATA_SYNC_STATUS_IN_PROGRESS},
    )

    assert outcome == DATA_SYNC_WRITE_STALE
    filt, update = collections[DATA_SYNC_COLLECTION].update_one.call_args.args
    assert filt == {ID: SYNC_ID, STATUS: DATA_SYNC_STATUS_IN_PROGRESS}
    assert update["$set"][STATUS] == DATA_SYNC_STATUS_FAILED


@patch("common.mongo_dao.MongoClient")
def test_update_data_sync_returns_error_and_logs_id(mock_client_class, caplog):
    collections = _setup_mock_collections(mock_client_class, DATA_SYNC_COLLECTION)
    collections[DATA_SYNC_COLLECTION].update_one.side_effect = Exception("down")
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.update_data_sync(SYNC_ID, {STATUS: DATA_SYNC_STATUS_FAILED}) == DATA_SYNC_WRITE_ERROR
    assert SYNC_ID in caplog.text


@patch("common.mongo_dao.MongoClient")
def test_add_active_uses_add_to_set_and_sets_in_progress(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.return_value = _matched(1)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    outcome = dao.add_active_submission_data_sync("sub_1", DATA_SYNC_TYPE_METADATA, SYNC_ID)

    assert outcome == DATA_SYNC_WRITE_APPLIED
    filt, update = collections[SUBMISSION_COLLECTION].update_one.call_args.args
    assert filt == {ID: "sub_1"}
    assert update["$addToSet"] == {METADATA_DATA_SYNC_ACTIVE: SYNC_ID}
    assert update["$set"] == {METADATA_DATA_SYNC_STATUS: DATA_SYNC_STATUS_IN_PROGRESS}
    _assert_no_updated_at(update)


@patch("common.mongo_dao.MongoClient")
def test_add_active_returns_stale_when_submission_is_missing(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.return_value = _matched(0)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.add_active_submission_data_sync("sub_1", DATA_SYNC_TYPE_FILE, SYNC_ID) == DATA_SYNC_WRITE_STALE


@patch("common.mongo_dao.MongoClient")
def test_add_active_unrecognized_type_makes_no_database_call(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.add_active_submission_data_sync("sub_1", "unknown", SYNC_ID) == DATA_SYNC_WRITE_ERROR
    collections[SUBMISSION_COLLECTION].update_one.assert_not_called()


@patch("common.mongo_dao.MongoClient")
def test_finish_last_one_out_sets_succeeded_and_clears_the_list(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.side_effect = [_matched(0), _matched(1)]
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    outcome = dao.finish_submission_data_sync("sub_1", DATA_SYNC_TYPE_FILE, SYNC_ID, DATA_SYNC_STATUS_SUCCEEDED)

    assert outcome == DATA_SYNC_WRITE_APPLIED
    flag_filter, _flag_update = collections[SUBMISSION_COLLECTION].update_one.call_args_list[0].args
    exact_filter, exact_update = collections[SUBMISSION_COLLECTION].update_one.call_args_list[1].args
    assert flag_filter[FILE_DATA_SYNC_ACTIVE] == [SYNC_ID]
    assert exact_filter[FILE_DATA_SYNC_ACTIVE] == [SYNC_ID]
    assert exact_filter[FILE_DATA_SYNC_OVERLAP_FAILED] == {"$ne": True}
    assert exact_update["$set"][FILE_DATA_SYNC_STATUS] == DATA_SYNC_STATUS_SUCCEEDED
    assert exact_update["$set"][FILE_DATA_SYNC_ACTIVE] == []
    assert FILE_DATA_SYNC_OVERLAP_FAILED in exact_update["$unset"]
    _assert_no_updated_at(exact_update)


@patch("common.mongo_dao.MongoClient")
def test_finish_last_one_out_sets_failed_when_overlap_flag_is_set(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.return_value = _matched(1)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    outcome = dao.finish_submission_data_sync("sub_1", DATA_SYNC_TYPE_METADATA, SYNC_ID, DATA_SYNC_STATUS_SUCCEEDED)

    assert outcome == DATA_SYNC_WRITE_APPLIED
    filt, update = collections[SUBMISSION_COLLECTION].update_one.call_args.args
    assert filt[METADATA_DATA_SYNC_OVERLAP_FAILED] is True
    assert update["$set"][METADATA_DATA_SYNC_STATUS] == DATA_SYNC_STATUS_FAILED
    assert update["$set"][METADATA_DATA_SYNC_ACTIVE] == []


@patch("common.mongo_dao.MongoClient")
def test_finish_not_the_last_pulls_id_and_does_not_change_status(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.side_effect = [_matched(0), _matched(1)]
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    outcome = dao.finish_submission_data_sync("sub_1", DATA_SYNC_TYPE_FILE, SYNC_ID, DATA_SYNC_STATUS_FAILED)

    assert outcome == DATA_SYNC_WRITE_APPLIED
    filt, update = collections[SUBMISSION_COLLECTION].update_one.call_args.args
    assert filt[FILE_DATA_SYNC_ACTIVE] == SYNC_ID
    assert filt[f"{FILE_DATA_SYNC_ACTIVE}.1"] == {"$exists": True}
    assert update["$pull"] == {FILE_DATA_SYNC_ACTIVE: SYNC_ID}
    assert update["$set"] == {FILE_DATA_SYNC_OVERLAP_FAILED: True}
    assert FILE_DATA_SYNC_STATUS not in update["$set"]
    _assert_no_updated_at(update)


@patch("common.mongo_dao.MongoClient")
def test_finish_returns_stale_when_id_is_absent(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.return_value = _matched(0)
    collections[SUBMISSION_COLLECTION].find_one.return_value = None
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.finish_submission_data_sync(
        "sub_1", DATA_SYNC_TYPE_METADATA, SYNC_ID, DATA_SYNC_STATUS_SUCCEEDED,
    ) == DATA_SYNC_WRITE_STALE


@patch("common.mongo_dao.MongoClient")
def test_finish_retries_while_id_remains_then_returns_error(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.return_value = _matched(0)
    collections[SUBMISSION_COLLECTION].find_one.return_value = {ID: "sub_1"}
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.finish_submission_data_sync(
        "sub_1", DATA_SYNC_TYPE_METADATA, SYNC_ID, DATA_SYNC_STATUS_SUCCEEDED,
    ) == DATA_SYNC_WRITE_ERROR
    assert collections[SUBMISSION_COLLECTION].update_one.call_count == 9
    assert collections[SUBMISSION_COLLECTION].find_one.call_count == 3


@patch("common.mongo_dao.MongoClient")
def test_finish_returns_error_and_logs_ids_on_exception(mock_client_class, caplog):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION)
    collections[SUBMISSION_COLLECTION].update_one.side_effect = Exception("down")
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.finish_submission_data_sync(
        "sub_1", DATA_SYNC_TYPE_FILE, SYNC_ID, DATA_SYNC_STATUS_FAILED,
    ) == DATA_SYNC_WRITE_ERROR
    assert "sub_1" in caplog.text
    assert SYNC_ID in caplog.text


@patch("common.mongo_dao.MongoClient")
def test_finish_unrecognized_type_makes_no_database_call(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, SUBMISSION_COLLECTION)
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.finish_submission_data_sync("sub_1", "unknown", SYNC_ID, DATA_SYNC_STATUS_FAILED) == DATA_SYNC_WRITE_ERROR
    collections[SUBMISSION_COLLECTION].update_one.assert_not_called()


@patch("common.mongo_dao.MongoClient")
def test_find_unfinished_data_syncs_includes_list_pending(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, DATA_SYNC_COLLECTION)
    collections[DATA_SYNC_COLLECTION].find.return_value = []
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.find_unfinished_data_syncs() == []
    filt = collections[DATA_SYNC_COLLECTION].find.call_args.args[0]
    clauses = filt["$or"]
    assert {STATUS: DATA_SYNC_STATUS_IN_PROGRESS} in clauses
    assert {DATA_SYNC_LIST_PENDING: True} in clauses
    assert {DATA_SYNC_ROLLUP_PENDING: True} in clauses
    assert {DATA_SYNC_CLEANUP_AFTER: {"$exists": True, "$ne": None}} in clauses


@patch("common.mongo_dao.MongoClient")
def test_find_unfinished_data_syncs_returns_none_on_error(mock_client_class):
    collections = _setup_mock_collections(mock_client_class, DATA_SYNC_COLLECTION)
    collections[DATA_SYNC_COLLECTION].find.side_effect = Exception("down")
    dao = MongoDao("mongodb://localhost:27017", "test_db")

    assert dao.find_unfinished_data_syncs() is None
