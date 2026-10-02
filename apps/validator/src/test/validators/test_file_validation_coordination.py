import pytest
from unittest.mock import MagicMock, patch, call
from datetime import datetime, timedelta

from file_validator import record_task_result, _handle_file_message
from common.validation_closeout import (
    updates_to_mark_task_done, updates_to_consolidate, validation_status_from_value,
    updates_to_mark_type_done, FILE_PROGRESS, METADATA_PROGRESS,
    COMPLETED_FILE_MESSAGES, WORST_FILE_STATUS, TOTAL_FILE_MESSAGES,
    process_validation_message, InvalidValidationMessage, STATUS_VALIDATING,
    fail_validation_fast,
)
from common.constants import FILE_ENDED, FILE_STATUS, VALIDATION_ENDED, FILE_VALIDATION_STATUS, VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA, \
    ENDED, VALIDATION_STATUS, METADATA_STATUS, METADATA_ENDED, WORST_BATCH_STATUS, SUBMISSION_ID, STATUS_ERROR, STATUS_WARNING, STATUS_PASSED, \
    STATUS_FAILED, METADATA_VALIDATION_STATUS, CROSS_SUBMISSION_VALIDATION_STATUS, SCOPE, FILE_ID, SQS_TYPE
from common.mongo_dao import ensure_update_ops

log = MagicMock()
first_ended_at = datetime.now()
second_ended_at = first_ended_at + timedelta(seconds=1)

validation_completed_test_data = [
    pytest.param({
        "type": [VALIDATION_TYPE_FILE],
        WORST_FILE_STATUS: 0
    }, 
    first_ended_at, 
    (
        {
            FILE_ENDED: first_ended_at,
            FILE_STATUS: 'Passed',
            ENDED: first_ended_at,
            VALIDATION_STATUS: 'Passed'
        },
        {
            FILE_VALIDATION_STATUS: 'Passed',
            VALIDATION_ENDED: first_ended_at
        }
    ),
    id='Should update both file and overall validation status and ended time for data file validation only'),
    pytest.param({
        "type": [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        WORST_FILE_STATUS: 0
    }, 
    second_ended_at, 
    (
        {
            FILE_ENDED: second_ended_at,
            FILE_STATUS: 'Passed'
        },
        {
            FILE_VALIDATION_STATUS: 'Passed'
        }
    ),
    id='Should only update file validation status and ended time for Metadata and data file validation'),
]

@pytest.mark.parametrize("validation, ended_at, expected", validation_completed_test_data)
def test_compse_updates_when_file_validation_done(validation: dict, ended_at: object, expected: dict):
    assert updates_to_mark_type_done(validation, ended_at, FILE_PROGRESS, METADATA_PROGRESS) == expected


validation_status_test_data = [
    pytest.param({
        "type": [VALIDATION_TYPE_FILE],
        WORST_FILE_STATUS: 0
    }, 
    (None, None),
    id='Should return None, None when data file validation only '),
    pytest.param({
        "type": [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        WORST_FILE_STATUS: 0,
        WORST_BATCH_STATUS: 1,
        FILE_ENDED: second_ended_at,
        METADATA_ENDED: first_ended_at
    }, 
    (
        {
            ENDED: second_ended_at,
            VALIDATION_STATUS: 'Warning'
        },
        {
            VALIDATION_ENDED: second_ended_at
        }
    ),
    id='Metadata and data file validation, metadata status is higher, ended earlier'),
    pytest.param({
        "type": [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        WORST_FILE_STATUS: 2,
        WORST_BATCH_STATUS: 1,
        METADATA_ENDED: first_ended_at,
        FILE_ENDED: second_ended_at
    }, 
    (
        {
            ENDED: second_ended_at,
            VALIDATION_STATUS: 'Error'
        },
        {
            VALIDATION_ENDED: second_ended_at
        }
    ),
    id='Metadata and data file validation, metadata status is lower ended earlier'),
    pytest.param({
        "type": [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        WORST_FILE_STATUS: 1,
        WORST_BATCH_STATUS: 2,
        METADATA_ENDED: second_ended_at,
        FILE_ENDED: first_ended_at
    }, 
    (
        {
            ENDED: second_ended_at,
            VALIDATION_STATUS: 'Error'
        },
        {
            VALIDATION_ENDED: second_ended_at
        }
    ),
    id='Metadata and data file validation, metadata status is higher ended later, although not likely to happen'),
    pytest.param({
        "type": [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        WORST_FILE_STATUS: 0,
        WORST_BATCH_STATUS: 2,
        FILE_ENDED: first_ended_at
    }, 
    (None, None),
    id='Metadata and data file validation, metadata not finished yet, should not update overall status and end time'),
]

@pytest.mark.parametrize("validation, expected", validation_status_test_data)
def test_compose_updates_after_validating_metadata_and_file(validation: dict, expected: dict):
    assert updates_to_consolidate(validation, FILE_PROGRESS, METADATA_PROGRESS) == expected

validation_fields_test_data = [
    pytest.param('Error', {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 2}}, id='Should increment completedFileMessages by 1 and try to increase worstFileStatus to 2 when error'),
    pytest.param('Warning', {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 1}}, id='Should increment completedFileMessages by 1 and try to increase worstFileStatus to 1 when warning'),
    pytest.param('Passed', {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 0}}, id='Should increment completedFileMessages by 1 and try to increase worstFileStatus to 0 when passed'),
]
@pytest.mark.parametrize("status, expected", validation_fields_test_data)
def test_compose_validaton_updates_one_task_done(status: str, expected: dict):
    assert updates_to_mark_task_done(status, FILE_PROGRESS) == expected

status_precedence_test_data = [
    pytest.param(-1, None, id='Should return None when value is out of range'),
    pytest.param(0, 'Passed', id='Should return Passed when value is 0'),
    pytest.param(1, 'Warning', id='Should return Warning when value is 1'),
    pytest.param(2, 'Error', id='Should return Error when value is 2'),
    pytest.param(3, 'Failed', id='Should return Failed when value is 3'),
    pytest.param(4, None, id='Should return None when value greater than 3')
]
@pytest.mark.parametrize("value, expected", status_precedence_test_data)
def test_get_validation_status_from_worse_value(value: int, expected: str):
    assert validation_status_from_value(value) == expected

VALIDATION_ID = 'val-1'
SUBMISSION = 'sub-1'
progress_ended_at = datetime(2026, 9, 26, 12, 0, 0)
metadata_ended_at = progress_ended_at - timedelta(seconds=1)

def _validation_doc(**overrides):
    doc = {
        TOTAL_FILE_MESSAGES: 2,
        COMPLETED_FILE_MESSAGES: 1,
        WORST_FILE_STATUS: 0,
        'type': [VALIDATION_TYPE_FILE],
        SUBMISSION_ID: SUBMISSION,
    }
    doc.update(overrides)
    return doc

skip_status_test_data = [
    pytest.param(None, id='Should skip progress when status is None'),
    pytest.param('', id='Should skip progress when status is empty'),
]
@pytest.mark.parametrize("status", skip_status_test_data)
def test_record_validation_progress_skips_missing_status(status):
    mongo_dao = MagicMock()
    progress_log = MagicMock()

    record_task_result(status, VALIDATION_ID, mongo_dao, progress_log)

    mongo_dao.atomic_update_validation.assert_not_called()
    mongo_dao.atomic_update_submission.assert_not_called()
    progress_log.info.assert_called_once_with(
        f'record_validation_progress: status={status}, validation_id={VALIDATION_ID}, type={FILE_PROGRESS.type_name}'
    )

def test_record_validation_progress_raises_on_invalid_status():
    mongo_dao = MagicMock()

    with pytest.raises(ValueError, match='Invalid status: Unknown'):
        record_task_result('Unknown', VALIDATION_ID, mongo_dao, MagicMock())

    mongo_dao.atomic_update_validation.assert_not_called()
    mongo_dao.atomic_update_submission.assert_not_called()

failed_update_test_data = [
    pytest.param(None, id='Should raise when atomic update returns None'),
    pytest.param({}, id='Should raise when atomic update returns an empty document'),
]
@pytest.mark.parametrize("updated_validation", failed_update_test_data)
def test_record_validation_progress_raises_when_atomic_update_fails(updated_validation):
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.return_value = updated_validation

    with pytest.raises(Exception, match=f'Failed to update validation record for {VALIDATION_ID}'):
        record_task_result('Error', VALIDATION_ID, mongo_dao, MagicMock())

    mongo_dao.atomic_update_validation.assert_called_once_with(
        VALIDATION_ID, updates_to_mark_task_done('Error', FILE_PROGRESS)
    )
    mongo_dao.atomic_update_submission.assert_not_called()

incomplete_progress_test_data = [
    pytest.param('Error', 2, id='Should record an error without finalizing when messages remain'),
    pytest.param('Warning', 1, id='Should record a warning without finalizing when messages remain'),
    pytest.param('Passed', 0, id='Should record a pass without finalizing when messages remain'),
]
@pytest.mark.parametrize("status, worst_file_status", incomplete_progress_test_data)
def test_record_validation_progress_does_not_finalize_incomplete_validation(status, worst_file_status):
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.return_value = _validation_doc(
        **{WORST_FILE_STATUS: worst_file_status}
    )

    record_task_result(status, VALIDATION_ID, mongo_dao, MagicMock())

    mongo_dao.atomic_update_validation.assert_called_once_with(
        VALIDATION_ID,
        {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: worst_file_status}},
    )
    mongo_dao.atomic_update_submission.assert_not_called()

finalize_progress_test_data = [
    pytest.param(
        'Passed',
        _validation_doc(**{
            TOTAL_FILE_MESSAGES: 1,
            COMPLETED_FILE_MESSAGES: 1,
            WORST_FILE_STATUS: 0,
            FILE_ENDED: progress_ended_at,
        }),
        [
            {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 0}},
            {
                FILE_ENDED: progress_ended_at,
                FILE_STATUS: 'Passed',
                ENDED: progress_ended_at,
                VALIDATION_STATUS: 'Passed',
            },
        ],
        [
            {
                FILE_VALIDATION_STATUS: 'Passed',
                VALIDATION_ENDED: progress_ended_at,
            },
        ],
        id='Should finalize file-only validation when the last file message completes',
    ),
    pytest.param(
        'Error',
        _validation_doc(**{
            TOTAL_FILE_MESSAGES: 2,
            COMPLETED_FILE_MESSAGES: 2,
            WORST_FILE_STATUS: 2,
            'type': [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
            METADATA_STATUS: 'Warning',
            WORST_BATCH_STATUS: 1,
            METADATA_ENDED: metadata_ended_at,
            FILE_ENDED: progress_ended_at,
        }),
        [
            {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 2}},
            {
                FILE_ENDED: progress_ended_at,
                FILE_STATUS: 'Error',
                ENDED: progress_ended_at,
                VALIDATION_STATUS: 'Error',
            },
        ],
        [
            {
                FILE_VALIDATION_STATUS: 'Error',
                VALIDATION_ENDED: progress_ended_at,
            },
        ],
        id='Should consolidate overall status when metadata already finished',
    ),
    pytest.param(
        'Passed',
        _validation_doc(**{
            TOTAL_FILE_MESSAGES: 1,
            COMPLETED_FILE_MESSAGES: 1,
            WORST_FILE_STATUS: 0,
            'type': [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
            WORST_BATCH_STATUS: 2,
            FILE_ENDED: progress_ended_at,
        }),
        [
            {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 0}},
            {FILE_ENDED: progress_ended_at, FILE_STATUS: 'Passed'},
        ],
        [
            {FILE_VALIDATION_STATUS: 'Passed'},
        ],
        id='Should update file status only when metadata has not finished',
    ),
]
@pytest.mark.parametrize("status, updated_validation, validation_updates, submission_updates", finalize_progress_test_data)
def test_record_validation_progress_finalizes_last_file_message(status, updated_validation, validation_updates, submission_updates):
    """The last file task writes the expected type and overall close-out state.

    Return a completed validation document and compare every DAO call with
    literal update payloads so the assertions do not reuse production helpers.
    """
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.return_value = updated_validation
    progress_log = MagicMock()

    with patch('file_validator.current_datetime', return_value=progress_ended_at):
        record_task_result(status, VALIDATION_ID, mongo_dao, progress_log)

    expected_validation_calls = [call(VALIDATION_ID, validation_updates[0])]
    for update in validation_updates[1:]:
        expected_validation_calls.append(
            call(VALIDATION_ID, update, expected_status=STATUS_VALIDATING)
        )
    assert mongo_dao.atomic_update_validation.call_args_list == expected_validation_calls
    assert mongo_dao.atomic_update_submission.call_args_list == [
        call(SUBMISSION, update) for update in submission_updates
    ]
    progress_log.info.assert_any_call('data file validation is completed, updating validation and submission records')


@pytest.mark.parametrize("updates, expected", [
    pytest.param({'$inc': {}}, {'$inc': {}}, id='Should return original operation when it is not a pure data dict'),
    pytest.param({"prop1": "value1", "prop2": "value2"}, {'$set': {"prop1": "value1", "prop2": "value2"}}, id='Should return $set operation when updates is a pure data dict'),
    pytest.param({"$inc": {"prop1": 1}, "prop2": "value2"}, {'$inc': {"prop1": 1}, '$set': {"prop2": "value2"}}, id='Should return $inc and $set operations when updates contains both'),
])
def test_ensure_update_ops(updates: dict, expected: dict):
    assert ensure_update_ops(updates) == expected


def test_new_scope_keeps_worse_submission_file_status():
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.return_value = _validation_doc(**{
        TOTAL_FILE_MESSAGES: 1,
        COMPLETED_FILE_MESSAGES: 1,
        WORST_FILE_STATUS: 0,
        FILE_ENDED: progress_ended_at,
        SCOPE: 'New',
    })
    mongo_dao.get_submission.return_value = {FILE_VALIDATION_STATUS: STATUS_ERROR}
    mongo_dao.submission_file_status_from_records.return_value = STATUS_PASSED
    mongo_dao.atomic_update_submission.return_value = {'_id': SUBMISSION}

    with patch('file_validator.current_datetime', return_value=progress_ended_at):
        record_task_result('Passed', VALIDATION_ID, mongo_dao, MagicMock())

    mongo_dao.atomic_update_submission.assert_called_once_with(
        SUBMISSION,
        {
            FILE_VALIDATION_STATUS: STATUS_ERROR,
            VALIDATION_ENDED: progress_ended_at,
        },
    )


def test_record_validation_progress_does_not_overwrite_failed_validation():
    """A validation already marked Failed receives only the task increment.

    Return an already-Failed document from the increment and verify no close-out
    or submission write follows it.
    """
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.return_value = _validation_doc(**{
        TOTAL_FILE_MESSAGES: 1,
        COMPLETED_FILE_MESSAGES: 1,
        WORST_FILE_STATUS: 0,
        VALIDATION_STATUS: STATUS_FAILED,
    })

    record_task_result('Passed', VALIDATION_ID, mongo_dao, MagicMock())

    mongo_dao.atomic_update_validation.assert_called_once_with(
        VALIDATION_ID,
        {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 0}},
    )
    mongo_dao.atomic_update_submission.assert_not_called()


def test_consolidate_ignores_cross_submission_status():
    """Cross-submission Error does not influence file/metadata consolidation.

    Give file and metadata Passed precedence with cross-submission Error and
    inspect the returned updates for an overall Passed result and no cross field.
    """
    validation = {
        "type": [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        WORST_FILE_STATUS: 0,
        WORST_BATCH_STATUS: 0,
        FILE_ENDED: second_ended_at,
        METADATA_ENDED: first_ended_at,
        CROSS_SUBMISSION_VALIDATION_STATUS: STATUS_ERROR,
    }
    validation_updates, submission_updates = updates_to_consolidate(validation, FILE_PROGRESS, METADATA_PROGRESS)
    assert CROSS_SUBMISSION_VALIDATION_STATUS not in validation_updates
    assert CROSS_SUBMISSION_VALIDATION_STATUS not in submission_updates
    assert validation_updates[VALIDATION_STATUS] == STATUS_PASSED


def test_content_error_fails_fast_and_deletes_message():
    msg = MagicMock()
    msg.body = '{"type": "not-a-validation"}'
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.return_value = {SUBMISSION_ID: SUBMISSION}
    mongo_dao.get_submission.return_value = {
        METADATA_VALIDATION_STATUS: STATUS_VALIDATING,
        FILE_VALIDATION_STATUS: STATUS_VALIDATING,
    }
    mongo_dao.atomic_update_submission.return_value = {'_id': SUBMISSION}

    def handler(_data):
        raise InvalidValidationMessage(
            'missing scope',
            validation_id=VALIDATION_ID,
            submission_id=SUBMISSION,
            submission_status_field=METADATA_VALIDATION_STATUS,
        )

    deleted = process_validation_message(msg, MagicMock(), mongo_dao, handler, 20)

    assert deleted is True
    msg.delete.assert_called_once()
    fail_update = mongo_dao.atomic_update_validation.call_args
    assert fail_update[0][1][VALIDATION_STATUS] == STATUS_FAILED
    assert fail_update[0][1]['statusDetail'] == ['missing scope']
    assert fail_update[1]['expected_status'] == STATUS_VALIDATING
    mongo_dao.atomic_update_submission.assert_called_once_with(
        SUBMISSION,
        {METADATA_VALIDATION_STATUS: STATUS_ERROR},
    )


def test_retryable_error_leaves_message_for_requeue():
    """A transient handler failure neither deletes nor changes persisted state.

    Raise RuntimeError from the handler and verify the message and both DAO
    update methods remain untouched for SQS redelivery.
    """
    msg = MagicMock()
    msg.body = '{}'
    mongo_dao = MagicMock()

    def handler(_data):
        raise RuntimeError('database unavailable')

    deleted = process_validation_message(msg, MagicMock(), mongo_dao, handler, 20)

    assert deleted is False
    msg.delete.assert_not_called()
    mongo_dao.atomic_update_validation.assert_not_called()
    mongo_dao.atomic_update_submission.assert_not_called()


def test_new_scope_rescans_files_when_submission_is_validating():
    """A New-scope pass does not overwrite leftover Error files.

    Backend has already set fileValidationStatus to Validating. Rescan leftover
    file records as Error and persist that on both documents.
    """
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.return_value = _validation_doc(**{
        TOTAL_FILE_MESSAGES: 1,
        COMPLETED_FILE_MESSAGES: 1,
        WORST_FILE_STATUS: 0,
        FILE_ENDED: progress_ended_at,
        SCOPE: 'New',
    })
    mongo_dao.get_submission.return_value = {FILE_VALIDATION_STATUS: STATUS_VALIDATING}
    mongo_dao.submission_file_status_from_records.return_value = STATUS_ERROR
    mongo_dao.atomic_update_submission.return_value = {'_id': SUBMISSION}

    with patch('file_validator.current_datetime', return_value=progress_ended_at):
        record_task_result('Passed', VALIDATION_ID, mongo_dao, MagicMock())

    mongo_dao.submission_file_status_from_records.assert_called_once_with(SUBMISSION, STATUS_PASSED)
    assert mongo_dao.atomic_update_validation.call_args_list[1] == call(
        VALIDATION_ID,
        {
            FILE_ENDED: progress_ended_at,
            FILE_STATUS: STATUS_ERROR,
            ENDED: progress_ended_at,
            VALIDATION_STATUS: STATUS_ERROR,
        },
        expected_status=STATUS_VALIDATING,
    )
    mongo_dao.atomic_update_submission.assert_called_once_with(
        SUBMISSION,
        {
            FILE_VALIDATION_STATUS: STATUS_ERROR,
            VALIDATION_ENDED: progress_ended_at,
        },
    )


def test_missing_file_record_records_error_progress():
    """A missing file record counts as Error so the file counter can finish."""
    mongo_dao = MagicMock()
    mongo_dao.get_file.return_value = None
    mongo_dao.atomic_update_validation.return_value = _validation_doc(**{
        TOTAL_FILE_MESSAGES: 2,
        COMPLETED_FILE_MESSAGES: 1,
        WORST_FILE_STATUS: 2,
    })

    _handle_file_message(mongo_dao, MagicMock(), {
        'validationID': VALIDATION_ID,
        SUBMISSION_ID: SUBMISSION,
        SQS_TYPE: 'Validate File',
        FILE_ID: 'file-1',
    })

    increment = mongo_dao.atomic_update_validation.call_args_list[0][0][1]
    assert increment == {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 2}}
    for update_call in mongo_dao.atomic_update_validation.call_args_list:
        assert update_call[0][1].get(VALIDATION_STATUS) != STATUS_FAILED
    mongo_dao.atomic_update_submission.assert_not_called()


def test_missing_file_record_finalizes_combined_run_as_error():
    """The last missing-file task closes a combined run as Error, not Failed."""
    mongo_dao = MagicMock()
    mongo_dao.get_file.return_value = None
    mongo_dao.atomic_update_validation.return_value = _validation_doc(**{
        TOTAL_FILE_MESSAGES: 2,
        COMPLETED_FILE_MESSAGES: 2,
        WORST_FILE_STATUS: 2,
        'type': [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        METADATA_STATUS: STATUS_PASSED,
        WORST_BATCH_STATUS: 0,
        METADATA_ENDED: metadata_ended_at,
        FILE_ENDED: progress_ended_at,
    })
    mongo_dao.atomic_update_submission.return_value = {'_id': SUBMISSION}

    with patch('file_validator.current_datetime', return_value=progress_ended_at):
        _handle_file_message(mongo_dao, MagicMock(), {
            'validationID': VALIDATION_ID,
            SUBMISSION_ID: SUBMISSION,
            SQS_TYPE: 'Validate File',
            FILE_ID: 'file-1',
        })

    assert mongo_dao.atomic_update_validation.call_args_list[1] == call(
        VALIDATION_ID,
        {
            FILE_ENDED: progress_ended_at,
            FILE_STATUS: STATUS_ERROR,
            ENDED: progress_ended_at,
            VALIDATION_STATUS: STATUS_ERROR,
        },
        expected_status=STATUS_VALIDATING,
    )
    mongo_dao.atomic_update_submission.assert_called_once_with(
        SUBMISSION,
        {
            FILE_VALIDATION_STATUS: STATUS_ERROR,
            VALIDATION_ENDED: progress_ended_at,
        },
    )


def test_fail_validation_fast_updates_only_file_status():
    """A file content error does not release a still-Validating metadata status."""
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.return_value = {SUBMISSION_ID: SUBMISSION}
    mongo_dao.get_submission.return_value = {
        METADATA_VALIDATION_STATUS: STATUS_VALIDATING,
        FILE_VALIDATION_STATUS: STATUS_VALIDATING,
    }
    mongo_dao.atomic_update_submission.return_value = {'_id': SUBMISSION}

    fail_validation_fast(
        mongo_dao, VALIDATION_ID, 'missing file id', SUBMISSION,
        submission_status_field=FILE_VALIDATION_STATUS,
    )

    mongo_dao.atomic_update_submission.assert_called_once_with(
        SUBMISSION,
        {FILE_VALIDATION_STATUS: STATUS_ERROR},
    )