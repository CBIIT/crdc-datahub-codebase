import pytest
from unittest.mock import MagicMock, call
from datetime import datetime, timedelta

from file_validator import record_task_result, gather_highest_validation_values
from common.constants import (
    FILE_ENDED, FILE_STATUS, VALIDATION_ENDED, FILE_VALIDATION_STATUS, VALIDATION_TYPE_FILE,
    VALIDATION_TYPE_METADATA, ENDED, VALIDATION_STATUS, METADATA_STATUS, METADATA_ENDED,
    WORST_BATCH_STATUS, WORST_FILE_STATUS, SUBMISSION_ID, STATUS_ERROR, STATUS_WARNING,
    STATUS_PASSED, S3_FILE_INFO, STATUS, STATUS_PRECEDENCE, TYPE, ID, EXPECTED_FILE_TASK_KEYS,
    PROCESSED_FILE_TASK_KEYS, STATUS_FAILED, VALIDATION_ABORTED,
)
from common.mongo_dao import ensure_update_ops
from common.validation_completion import (
    apply_current_task_completion, close_out_query, updates_to_close_out, validation_status_from_value,
)

log = MagicMock()
first_ended_at = datetime(2026, 1, 1, 0, 0, 0)
second_ended_at = first_ended_at + timedelta(seconds=1)
VALIDATION_ID = 'val-1'
SUBMISSION = 'sub-1'
TASK_KEY = 'file:file-1'


def _file_doc(**overrides):
    doc = {
        TYPE: [VALIDATION_TYPE_FILE],
        SUBMISSION_ID: SUBMISSION,
        WORST_FILE_STATUS: 0,
        EXPECTED_FILE_TASK_KEYS: [TASK_KEY, 'submission:sub-1'],
        PROCESSED_FILE_TASK_KEYS: [TASK_KEY],
    }
    doc.update(overrides)
    return doc


@pytest.mark.parametrize("value, expected", [
    pytest.param(-1, None, id='out of range'),
    pytest.param(0, 'Passed', id='passed'),
    pytest.param(1, 'Warning', id='warning'),
    pytest.param(2, 'Error', id='error'),
    pytest.param(3, 'Failed', id='failed'),
])
def test_get_validation_status_from_worse_value(value, expected):
    assert validation_status_from_value(value) == expected


def test_close_out_waits_for_metadata_and_file():
    open_file = {
        TYPE: [VALIDATION_TYPE_METADATA, VALIDATION_TYPE_FILE],
        METADATA_ENDED: first_ended_at,
        WORST_BATCH_STATUS: 1,
    }
    assert updates_to_close_out(open_file) == (None, None)

    closed = {
        **open_file,
        FILE_ENDED: second_ended_at,
        WORST_FILE_STATUS: 2,
    }
    validation_updates, submission_updates = updates_to_close_out(closed)
    assert validation_updates[VALIDATION_STATUS] == STATUS_ERROR
    assert validation_updates[ENDED] == second_ended_at
    assert submission_updates == {VALIDATION_ENDED: second_ended_at}


def test_close_out_file_only_does_not_require_metadata():
    validation_updates, submission_updates = updates_to_close_out({
        TYPE: [VALIDATION_TYPE_FILE],
        FILE_ENDED: first_ended_at,
        WORST_FILE_STATUS: 0,
    })
    assert validation_updates[VALIDATION_STATUS] == STATUS_PASSED
    assert submission_updates[VALIDATION_ENDED] == first_ended_at


def test_cross_submission_does_not_block_close_out():
    validation_updates, _ = updates_to_close_out({
        TYPE: [VALIDATION_TYPE_METADATA, 'cross-submission'],
        METADATA_ENDED: first_ended_at,
        WORST_BATCH_STATUS: 0,
    })
    assert validation_updates[VALIDATION_STATUS] == STATUS_PASSED


def test_close_out_keeps_aborted_error():
    validation_updates, _ = updates_to_close_out({
        TYPE: [VALIDATION_TYPE_METADATA],
        METADATA_ENDED: first_ended_at,
        WORST_BATCH_STATUS: 0,
        VALIDATION_STATUS: STATUS_ERROR,
    })
    assert validation_updates[VALIDATION_STATUS] == STATUS_ERROR


def test_close_out_query_requires_file_when_type_includes_file():
    query = close_out_query(VALIDATION_ID, {
        TYPE: [VALIDATION_TYPE_METADATA, 'file'],
        WORST_BATCH_STATUS: 1,
        WORST_FILE_STATUS: 2,
    })
    assert query[METADATA_ENDED] == {"$exists": True, "$ne": None}
    assert query[FILE_ENDED] == {"$exists": True, "$ne": None}
    assert query[WORST_FILE_STATUS] == 2
    assert 'crossSubmissionEnded' not in query


@pytest.mark.parametrize("status", [None, ""])
def test_record_validation_progress_skips_missing_status(status):
    mongo_dao = MagicMock()

    record_task_result(status, VALIDATION_ID, mongo_dao, MagicMock(), TASK_KEY)

    mongo_dao.record_file_task_completion.assert_not_called()


def test_record_validation_progress_raises_on_invalid_status():
    mongo_dao = MagicMock()

    with pytest.raises(ValueError, match='Invalid file status: Unknown'):
        record_task_result('Unknown', VALIDATION_ID, mongo_dao, MagicMock(), TASK_KEY)

    mongo_dao.record_file_task_completion.assert_not_called()


def test_record_validation_progress_retries_failed_task_without_counting_it():
    mongo_dao = MagicMock()

    with pytest.raises(Exception, match='File validation task failed'):
        record_task_result(STATUS_FAILED, VALIDATION_ID, mongo_dao, MagicMock(), TASK_KEY)

    mongo_dao.record_file_task_completion.assert_not_called()


def test_record_validation_progress_raises_when_progress_write_fails():
    mongo_dao = MagicMock()
    mongo_dao.record_file_task_completion.return_value = None

    with pytest.raises(Exception, match=f'Failed to update validation record for {VALIDATION_ID}'):
        record_task_result(STATUS_ERROR, VALIDATION_ID, mongo_dao, MagicMock(), TASK_KEY)


def test_record_validation_progress_retries_when_expected_keys_are_not_persisted():
    mongo_dao = MagicMock()
    mongo_dao.record_file_task_completion.side_effect = RuntimeError(
        f'Validation {VALIDATION_ID} is missing expectedFileTaskKeys'
    )

    with pytest.raises(RuntimeError, match='expectedFileTaskKeys'):
        record_task_result(STATUS_PASSED, VALIDATION_ID, mongo_dao, MagicMock(), TASK_KEY)

    mongo_dao.get_validation.assert_not_called()


def test_record_validation_progress_does_not_finalize_incomplete_validation():
    mongo_dao = MagicMock()
    incomplete = _file_doc()
    mongo_dao.record_file_task_completion.return_value = incomplete
    mongo_dao.get_validation.return_value = incomplete

    record_task_result(STATUS_PASSED, VALIDATION_ID, mongo_dao, MagicMock(), TASK_KEY)

    mongo_dao.conditional_update_validation.assert_not_called()
    mongo_dao.atomic_update_submission.assert_not_called()


def test_record_validation_progress_retries_when_new_scope_rescan_write_fails():
    mongo_dao = MagicMock()
    complete = _file_doc(**{
        'scope': 'New',
        EXPECTED_FILE_TASK_KEYS: [TASK_KEY],
        PROCESSED_FILE_TASK_KEYS: [TASK_KEY],
    })
    mongo_dao.record_file_task_completion.return_value = complete
    mongo_dao.get_files_by_submission.return_value = [
        {S3_FILE_INFO: {STATUS: STATUS_ERROR}}
    ]
    mongo_dao.atomic_update_validation.return_value = None

    with pytest.raises(RuntimeError, match='rescanned file status'):
        record_task_result(STATUS_PASSED, VALIDATION_ID, mongo_dao, MagicMock(), TASK_KEY)

    mongo_dao.get_validation.assert_not_called()


def test_record_validation_progress_waits_for_open_metadata():
    before = _file_doc(**{
        TYPE: [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        EXPECTED_FILE_TASK_KEYS: [TASK_KEY],
        PROCESSED_FILE_TASK_KEYS: [TASK_KEY],
    })
    task_done = {
        **before,
        FILE_ENDED: second_ended_at,
        FILE_STATUS: STATUS_PASSED,
    }
    mongo_dao = MagicMock()
    mongo_dao.record_file_task_completion.return_value = before
    mongo_dao.get_validation.return_value = before
    mongo_dao.conditional_update_validation.return_value = task_done
    mongo_dao.atomic_update_submission.return_value = {ID: SUBMISSION}

    with pytest.MonkeyPatch.context() as patcher:
        patcher.setattr('file_validator.current_datetime', lambda: second_ended_at)
        record_task_result(STATUS_PASSED, VALIDATION_ID, mongo_dao, MagicMock(), TASK_KEY)

    mongo_dao.atomic_update_submission.assert_called_once_with(
        SUBMISSION, {FILE_VALIDATION_STATUS: STATUS_PASSED}
    )
    close_updates = [
        call_args[0][1] for call_args in mongo_dao.conditional_update_validation.call_args_list
        if VALIDATION_STATUS in call_args[0][1]
    ]
    assert close_updates == []


def test_record_validation_progress_closes_when_metadata_already_ended():
    before = _file_doc(**{
        TYPE: [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        EXPECTED_FILE_TASK_KEYS: [TASK_KEY],
        PROCESSED_FILE_TASK_KEYS: [TASK_KEY],
        METADATA_ENDED: first_ended_at,
        METADATA_STATUS: STATUS_WARNING,
        WORST_BATCH_STATUS: 1,
        WORST_FILE_STATUS: 2,
    })
    task_done = {
        **before,
        FILE_ENDED: second_ended_at,
        FILE_STATUS: STATUS_ERROR,
    }
    closed = {
        **task_done,
        ENDED: second_ended_at,
        VALIDATION_STATUS: STATUS_ERROR,
    }
    mongo_dao = MagicMock()
    mongo_dao.record_file_task_completion.return_value = before
    mongo_dao.get_validation.return_value = before
    mongo_dao.conditional_update_validation.side_effect = [task_done, closed]
    mongo_dao.atomic_update_submission.return_value = {ID: SUBMISSION}

    with pytest.MonkeyPatch.context() as patcher:
        patcher.setattr('file_validator.current_datetime', lambda: second_ended_at)
        record_task_result(STATUS_ERROR, VALIDATION_ID, mongo_dao, MagicMock(), TASK_KEY)

    close_query, close_updates = mongo_dao.conditional_update_validation.call_args_list[1][0]
    assert close_query[WORST_FILE_STATUS] == 2
    assert close_query[WORST_BATCH_STATUS] == 1
    assert close_updates[VALIDATION_STATUS] == STATUS_ERROR
    mongo_dao.atomic_update_submission.assert_has_calls([
        call(SUBMISSION, {FILE_VALIDATION_STATUS: STATUS_ERROR}),
        call(SUBMISSION, {VALIDATION_ENDED: second_ended_at}),
    ])


def test_apply_current_task_completion_corrects_stale_status_from_stored_worst():
    stale = {
        TYPE: [VALIDATION_TYPE_METADATA],
        SUBMISSION_ID: SUBMISSION,
        METADATA_ENDED: first_ended_at,
        METADATA_STATUS: STATUS_PASSED,
        WORST_BATCH_STATUS: STATUS_PRECEDENCE[STATUS_ERROR],
    }
    corrected = {**stale, METADATA_STATUS: STATUS_ERROR}
    closed = {**corrected, ENDED: first_ended_at, VALIDATION_STATUS: STATUS_ERROR}
    mongo_dao = MagicMock()
    mongo_dao.get_validation.return_value = stale
    mongo_dao.conditional_update_validation.side_effect = [corrected, closed]
    mongo_dao.atomic_update_submission.return_value = {ID: SUBMISSION}

    apply_current_task_completion(
        mongo_dao, VALIDATION_ID, first_ended_at, VALIDATION_TYPE_METADATA, MagicMock()
    )

    status_query, status_updates = mongo_dao.conditional_update_validation.call_args_list[0][0]
    assert status_query[WORST_BATCH_STATUS] == STATUS_PRECEDENCE[STATUS_ERROR]
    assert status_updates == {METADATA_STATUS: STATUS_ERROR}
    _, close_updates = mongo_dao.conditional_update_validation.call_args_list[1][0]
    assert close_updates[VALIDATION_STATUS] == STATUS_ERROR


def test_apply_current_task_completion_preserves_existing_end_time_on_retry():
    closed = {
        TYPE: [VALIDATION_TYPE_METADATA],
        SUBMISSION_ID: SUBMISSION,
        METADATA_ENDED: first_ended_at,
        METADATA_STATUS: STATUS_PASSED,
        WORST_BATCH_STATUS: 0,
        ENDED: first_ended_at,
        VALIDATION_STATUS: STATUS_PASSED,
    }
    mongo_dao = MagicMock()
    mongo_dao.get_validation.return_value = closed
    mongo_dao.atomic_update_submission.return_value = {ID: SUBMISSION}

    apply_current_task_completion(
        mongo_dao, VALIDATION_ID, second_ended_at, VALIDATION_TYPE_METADATA, MagicMock()
    )

    mongo_dao.conditional_update_validation.assert_not_called()
    mongo_dao.atomic_update_submission.assert_called_once_with(
        SUBMISSION, {VALIDATION_ENDED: first_ended_at}
    )


def test_apply_current_task_completion_raises_after_close_out_contention():
    open_task = {
        TYPE: [VALIDATION_TYPE_METADATA],
        SUBMISSION_ID: SUBMISSION,
        WORST_BATCH_STATUS: 0,
        EXPECTED_FILE_TASK_KEYS: [],
    }
    open_task['expectedBatchIndexes'] = [0]
    open_task['processedBatchIndexes'] = [0]
    mongo_dao = MagicMock()
    mongo_dao.get_validation.return_value = open_task
    mongo_dao.conditional_update_validation.return_value = None

    with pytest.raises(RuntimeError, match='could not be reconciled'):
        apply_current_task_completion(
            mongo_dao, VALIDATION_ID, first_ended_at, VALIDATION_TYPE_METADATA, MagicMock()
        )

    assert mongo_dao.conditional_update_validation.call_count == 5


def test_apply_current_task_completion_skips_aborted_validation():
    aborted = {
        TYPE: [VALIDATION_TYPE_METADATA],
        SUBMISSION_ID: SUBMISSION,
        VALIDATION_ABORTED: True,
        ENDED: first_ended_at,
        VALIDATION_STATUS: STATUS_ERROR,
    }
    mongo_dao = MagicMock()
    mongo_dao.get_validation.return_value = aborted

    result = apply_current_task_completion(
        mongo_dao, VALIDATION_ID, second_ended_at, VALIDATION_TYPE_METADATA, MagicMock()
    )

    assert result == aborted
    mongo_dao.conditional_update_validation.assert_not_called()
    mongo_dao.atomic_update_submission.assert_not_called()


def test_stale_close_out_reloads_abort_without_updating_submission():
    open_task = {
        TYPE: [VALIDATION_TYPE_METADATA],
        SUBMISSION_ID: SUBMISSION,
        VALIDATION_STATUS: 'Validating',
        WORST_BATCH_STATUS: 0,
        'expectedBatchIndexes': [0],
        'processedBatchIndexes': [0],
    }
    task_done = {
        **open_task,
        METADATA_ENDED: first_ended_at,
        METADATA_STATUS: STATUS_PASSED,
    }
    aborted = {
        **task_done,
        VALIDATION_ABORTED: True,
        ENDED: second_ended_at,
        VALIDATION_STATUS: STATUS_ERROR,
    }
    mongo_dao = MagicMock()
    mongo_dao.get_validation.side_effect = [open_task, aborted]
    mongo_dao.conditional_update_validation.side_effect = [task_done, None]

    result = apply_current_task_completion(
        mongo_dao, VALIDATION_ID, first_ended_at, VALIDATION_TYPE_METADATA, MagicMock()
    )

    assert result == aborted
    close_query = mongo_dao.conditional_update_validation.call_args_list[1][0][0]
    assert close_query[VALIDATION_STATUS] == 'Validating'
    mongo_dao.atomic_update_submission.assert_not_called()


def test_last_metadata_batch_does_not_close_while_file_task_is_open():
    from metadata_validator import _finalize_metadata_current_task
    open_file = {
        TYPE: [VALIDATION_TYPE_METADATA, VALIDATION_TYPE_FILE],
        SUBMISSION_ID: SUBMISSION,
        WORST_BATCH_STATUS: 0,
        'expectedBatchIndexes': [0],
        'processedBatchIndexes': [0],
    }
    metadata_done = {**open_file, METADATA_ENDED: first_ended_at, METADATA_STATUS: STATUS_PASSED}
    mongo_dao = MagicMock()
    mongo_dao.get_validation.return_value = open_file
    mongo_dao.conditional_update_validation.return_value = metadata_done

    result = _finalize_metadata_current_task(
        mongo_dao, VALIDATION_ID, first_ended_at, MagicMock()
    )

    assert result[METADATA_ENDED] == first_ended_at
    mongo_dao.atomic_update_submission.assert_not_called()


@pytest.mark.parametrize("updates, expected", [
    pytest.param({'$inc': {}}, {'$inc': {}}, id='Should return original operation when it is not a pure data dict'),
    pytest.param({"prop1": "value1", "prop2": "value2"}, {'$set': {"prop1": "value1", "prop2": "value2"}}, id='Should return $set operation when updates is a pure data dict'),
    pytest.param({"$inc": {"prop1": 1}, "prop2": "value2"}, {'$inc': {"prop1": 1}, '$set': {"prop2": "value2"}}, id='Should return $inc and $set operations when updates contains both'),
])
def test_ensure_update_ops(updates: dict, expected: dict):
    assert ensure_update_ops(updates) == expected


@pytest.mark.parametrize("file_records, expected", [
    pytest.param([{S3_FILE_INFO: {STATUS: STATUS_ERROR}}, {S3_FILE_INFO: {STATUS: STATUS_WARNING}}, {S3_FILE_INFO: {STATUS: STATUS_PASSED}}], 2, id='Should return 2 when the worst file status is Error'),
    pytest.param([{S3_FILE_INFO: {STATUS: STATUS_WARNING}}, {S3_FILE_INFO: {STATUS: STATUS_PASSED}}], 1, id='Should return 1 when the worst file status is Warning'),
    pytest.param([{S3_FILE_INFO: {STATUS: STATUS_PASSED}}, {S3_FILE_INFO: {STATUS: STATUS_PASSED}}], 0, id='Should return 0 when the worst file status is Passed'),
])
def test_gether_highest_validation_values(file_records: list, expected: int):
    assert gather_highest_validation_values(file_records) == expected
