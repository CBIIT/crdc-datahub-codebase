import pytest
from unittest.mock import MagicMock
from datetime import datetime, timedelta

from file_validator import compose_validation_update_ops, compose_updated_validation_and_submission, get_validation_status_from_worse_value,\
     COMPLETED_FILE_MESSAGES, WORST_FILE_STATUS 
from common.constants import FILE_ENDED, FILE_STATUS, VALIDATION_ENDED, FILE_VALIDATION_STATUS, VALIDATION_TYPE_FILE, VALIDATION_TYPE_METADATA, \
    ENDED, VALIDATION_STATUS, METADATA_STATUS, METADATA_ENDED, WORST_BATCH_STATUS
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