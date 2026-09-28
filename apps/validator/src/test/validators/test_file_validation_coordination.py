import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta

from file_validator import updates_to_mark_task_done, updates_to_consolidate_metadata_and_file_validations, validation_status_from_value,\
     record_task_result, updates_to_mark_file_validation_done, COMPLETED_FILE_MESSAGES, WORST_FILE_STATUS, TOTAL_FILE_MESSAGES
from common.constants import FILE_ENDED, FILE_STATUS, VALIDATION_ENDED, FILE_VALIDATION_STATUS, VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA, \
    ENDED, VALIDATION_STATUS, METADATA_STATUS, METADATA_ENDED, WORST_BATCH_STATUS, SUBMISSION_ID
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
    assert updates_to_mark_file_validation_done(validation, ended_at, log) == expected


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
    assert updates_to_consolidate_metadata_and_file_validations(validation, log) == expected

validation_fields_test_data = [
    pytest.param('Error', {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 2}}, id='Should increment completedFileMessages by 1 and try to increase worstFileStatus to 2 when error'),
    pytest.param('Warning', {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 1}}, id='Should increment completedFileMessages by 1 and try to increase worstFileStatus to 1 when warning'),
    pytest.param('Passed', {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 0}}, id='Should increment completedFileMessages by 1 and try to increase worstFileStatus to 0 when passed'),
]
@pytest.mark.parametrize("status, expected", validation_fields_test_data)
def test_compose_validaton_updates_one_task_done(status: str, expected: dict):
    assert updates_to_mark_task_done(status) == expected

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
    mongo_dao.update_validation.assert_not_called()
    mongo_dao.update_submission.assert_not_called()
    progress_log.info.assert_called_once_with(
        f'record_validation_progress: status={status}, validation_id={VALIDATION_ID}'
    )

def test_record_validation_progress_raises_on_invalid_status():
    mongo_dao = MagicMock()

    with pytest.raises(ValueError, match='Invalid file status: Unknown'):
        record_task_result('Unknown', VALIDATION_ID, mongo_dao, MagicMock())

    mongo_dao.atomic_update_validation.assert_not_called()
    mongo_dao.update_validation.assert_not_called()
    mongo_dao.update_submission.assert_not_called()

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
        VALIDATION_ID, updates_to_mark_task_done('Error')
    )
    mongo_dao.update_validation.assert_not_called()
    mongo_dao.update_submission.assert_not_called()

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
    mongo_dao.update_validation.assert_not_called()
    mongo_dao.update_submission.assert_not_called()

finalize_progress_test_data = [
    pytest.param(
        'Passed',
        _validation_doc(**{
            TOTAL_FILE_MESSAGES: 1,
            COMPLETED_FILE_MESSAGES: 1,
            WORST_FILE_STATUS: 0,
            FILE_ENDED: progress_ended_at,
        }),
        {
            FILE_ENDED: progress_ended_at,
            FILE_STATUS: 'Passed',
            ENDED: progress_ended_at,
            VALIDATION_STATUS: 'Passed',
        },
        {
            FILE_VALIDATION_STATUS: 'Passed',
            VALIDATION_ENDED: progress_ended_at,
        },
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
        {
            ENDED: progress_ended_at,
            VALIDATION_STATUS: 'Error',
        },
        {
            VALIDATION_ENDED: progress_ended_at,
        },
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
        {
            FILE_ENDED: progress_ended_at,
            FILE_STATUS: 'Passed',
        },
        {
            FILE_VALIDATION_STATUS: 'Passed',
        },
        id='Should update file status only when metadata has not finished',
    ),
]
@pytest.mark.parametrize("status, updated_validation, expected_validation, expected_submission", finalize_progress_test_data)
def test_record_validation_progress_finalizes_last_file_message(status, updated_validation, expected_validation, expected_submission):
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.return_value = updated_validation
    progress_log = MagicMock()

    with patch('file_validator.current_datetime', return_value=progress_ended_at):
        record_task_result(status, VALIDATION_ID, mongo_dao, progress_log)

    mongo_dao.atomic_update_validation.assert_called_once_with(
        VALIDATION_ID, updates_to_mark_task_done(status)
    )
    mongo_dao.update_validation.assert_called_with(VALIDATION_ID, expected_validation)
    mongo_dao.update_submission.assert_called_with(SUBMISSION, expected_submission)
    progress_log.info.assert_any_call('File validation is completed, updating validation and submission records')