import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta

from file_validator import compose_validation_update_ops, compose_updated_validation_and_submission, get_validation_status_from_worse_value,\
     record_validation_progress, COMPLETED_FILE_MESSAGES, WORST_FILE_STATUS, TOTAL_FILE_MESSAGES
from common.constants import FILE_ENDED, FILE_STATUS, VALIDATION_ENDED, FILE_VALIDATION_STATUS, VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA, \
    ENDED, VALIDATION_STATUS, METADATA_STATUS, METADATA_ENDED, WORST_BATCH_STATUS, SUBMISSION_ID
log = MagicMock()
first_ended_at = datetime.now()
second_ended_at = first_ended_at + timedelta(seconds=1)

validation_status_test_data = [
    pytest.param({
        "type": [VALIDATION_TYPE_FILE],
        WORST_FILE_STATUS: 0
    }, 
    first_ended_at, 
    ({
        FILE_ENDED: first_ended_at,
        FILE_STATUS: 'Passed',
        ENDED: first_ended_at,
        VALIDATION_STATUS: 'Passed'
    },
    {
        FILE_VALIDATION_STATUS: 'Passed',
        VALIDATION_ENDED: first_ended_at
    }),
    id='data file validation only'),
    pytest.param({
        "type": [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        WORST_FILE_STATUS: 0,
        METADATA_STATUS: 'Warning',
        WORST_BATCH_STATUS: 1,
        METADATA_ENDED: first_ended_at
    }, 
    second_ended_at, 
    ({
        FILE_ENDED: second_ended_at,
        FILE_STATUS: 'Passed',
        ENDED: second_ended_at,
        VALIDATION_STATUS: 'Warning'
    },
    {
        FILE_VALIDATION_STATUS: 'Passed',
        VALIDATION_ENDED: second_ended_at
    }),
    id='Metadata and data file validation, metadata status is higher, ended earlier'),
    pytest.param({
        "type": [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        WORST_FILE_STATUS: 2,
        METADATA_STATUS: 'Warning',
        WORST_BATCH_STATUS: 1,
        METADATA_ENDED: first_ended_at
    }, 
    second_ended_at, 
    ({
        FILE_ENDED: second_ended_at,
        FILE_STATUS: 'Error',
        ENDED: second_ended_at,
        VALIDATION_STATUS: 'Error'
    },
    {
        FILE_VALIDATION_STATUS: 'Error',
        VALIDATION_ENDED: second_ended_at
    }),
    id='Metadata and data file validation, metadata status is lower ended earlier'),
    pytest.param({
        "type": [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        WORST_FILE_STATUS: 1,
        METADATA_STATUS: 'Error',
        WORST_BATCH_STATUS: 2,
        METADATA_ENDED: second_ended_at
    }, 
    first_ended_at, 
    ({
        FILE_ENDED: first_ended_at,
        FILE_STATUS: 'Warning',
        ENDED: second_ended_at,
        VALIDATION_STATUS: 'Error'
    },
    {
        FILE_VALIDATION_STATUS: 'Warning',
        VALIDATION_ENDED: second_ended_at
    }),
    id='Metadata and data file validation, metadata status is higher ended later, although not likely to happen'),
    pytest.param({
        "type": [VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA],
        WORST_FILE_STATUS: 0,
        WORST_BATCH_STATUS: 2,
    }, 
    second_ended_at, 
    ({
        FILE_ENDED: second_ended_at,
        FILE_STATUS: 'Passed',
    },
    {
        FILE_VALIDATION_STATUS: 'Passed',
    }),
    id='Metadata and data file validation, metadata not finished yet, should not update overall status and end time'),
]

@pytest.mark.parametrize("validation, ended_at, expected", validation_status_test_data)
def test_compose_updated_validation_and_submission(validation: dict, ended_at: object, expected: dict):
    assert compose_updated_validation_and_submission(validation, ended_at, log) == expected

validation_fields_test_data = [
    pytest.param('Error', {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 2}}, id='Should increment completedFileMessages by 1 and try to increase worstFileStatus to 2 when error'),
    pytest.param('Warning', {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 1}}, id='Should increment completedFileMessages by 1 and try to increase worstFileStatus to 1 when warning'),
    pytest.param('Passed', {'$inc': {COMPLETED_FILE_MESSAGES: 1}, '$max': {WORST_FILE_STATUS: 0}}, id='Should increment completedFileMessages by 1 and try to increase worstFileStatus to 0 when passed'),
]
@pytest.mark.parametrize("status, expected", validation_fields_test_data)
def test_compose_validation_update_ops(status: str, expected: dict):
    assert compose_validation_update_ops(status) == expected

status_precedence_test_data = [
    pytest.param(-1, None, id='Should return None when value is out of range'),
    pytest.param(0, 'Passed', id='Should return Passed when value is 0'),
    pytest.param(1, 'Warning', id='Should return Warning when value is 1'),
    pytest.param(2, 'Error', id='Should return Error when value is 2'),
]
@pytest.mark.parametrize("value, expected", status_precedence_test_data)
def test_get_validation_status_from_worse_value(value: int, expected: str):
    assert get_validation_status_from_worse_value(value) == expected

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

    record_validation_progress(status, VALIDATION_ID, mongo_dao, progress_log)

    mongo_dao.atomic_update_validation.assert_not_called()
    mongo_dao.update_validation.assert_not_called()
    mongo_dao.update_submission.assert_not_called()
    progress_log.info.assert_called_once_with(
        f'record_validation_progress: status={status}, validation_id={VALIDATION_ID}'
    )

def test_record_validation_progress_raises_on_invalid_status():
    mongo_dao = MagicMock()

    with pytest.raises(ValueError, match='Invalid file status: Unknown'):
        record_validation_progress('Unknown', VALIDATION_ID, mongo_dao, MagicMock())

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
        record_validation_progress('Error', VALIDATION_ID, mongo_dao, MagicMock())

    mongo_dao.atomic_update_validation.assert_called_once_with(
        VALIDATION_ID, compose_validation_update_ops('Error')
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

    record_validation_progress(status, VALIDATION_ID, mongo_dao, MagicMock())

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
        }),
        {
            FILE_ENDED: progress_ended_at,
            FILE_STATUS: 'Error',
            ENDED: progress_ended_at,
            VALIDATION_STATUS: 'Error',
        },
        {
            FILE_VALIDATION_STATUS: 'Error',
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
        record_validation_progress(status, VALIDATION_ID, mongo_dao, progress_log)

    mongo_dao.update_validation.assert_called_once_with(VALIDATION_ID, expected_validation)
    mongo_dao.update_submission.assert_called_once_with(SUBMISSION, expected_submission)
    progress_log.info.assert_any_call('File validation is completed, updating validation and submission records')