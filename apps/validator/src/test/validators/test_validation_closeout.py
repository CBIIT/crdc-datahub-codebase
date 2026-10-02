import os
import sys
from datetime import datetime
from unittest.mock import MagicMock, call

_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, 'src'))

from common.constants import (
    BATCH_STATUS_DETAILS,
    COMPLETED_BATCHES,
    ENDED,
    FAILED_BATCHES,
    FILE_VALIDATION_STATUS,
    METADATA_ENDED,
    METADATA_STATUS,
    METADATA_VALIDATION_STATUS,
    SCOPE,
    STATUS_DETAIL,
    STATUS_ERROR,
    STATUS_FAILED,
    STATUS_PASSED,
    STATUS_WARNING,
    SUBMISSION_ID,
    TYPE,
    VALIDATION_ENDED,
    VALIDATION_STATUS,
    VALIDATION_TYPE_METADATA,
    WORST_BATCH_STATUS,
)
from common.validation_closeout import (
    FILE_PROGRESS, METADATA_PROGRESS, STATUS_VALIDATING, fail_validation_fast,
    record_type_progress, updates_to_mark_task_done,
)

VALIDATION_ID = 'val-1'
SUBMISSION = 'sub-1'
ENDED_AT = datetime(2026, 10, 2, 12, 0, 0)
PASSED_INCREMENT = {'$inc': {COMPLETED_BATCHES: 1}, '$max': {WORST_BATCH_STATUS: 0}}
FAILED_INCREMENT = {
    '$inc': {COMPLETED_BATCHES: 1, FAILED_BATCHES: 1},
    '$max': {WORST_BATCH_STATUS: 3},
}


def _metadata_validation(**overrides):
    """Post-increment validation document for a metadata-only run."""
    doc = {
        TYPE: [VALIDATION_TYPE_METADATA],
        SUBMISSION_ID: SUBMISSION,
        COMPLETED_BATCHES: 1,
        WORST_BATCH_STATUS: 0,
    }
    doc.update(overrides)
    return doc


def _dao(validation):
    """DAO whose validation writes echo the given post-increment document."""
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.return_value = validation
    mongo_dao.atomic_update_submission.return_value = {'_id': SUBMISSION}
    mongo_dao._metadata_status_from_nodes.return_value = STATUS_PASSED
    return mongo_dao


def _record(mongo_dao, status, total_count, status_detail=None):
    """Record one metadata task against the mocked DAO."""
    record_type_progress(
        status, VALIDATION_ID, mongo_dao, MagicMock(), METADATA_PROGRESS, FILE_PROGRESS,
        total_count=total_count, status_detail=status_detail, ended_at=ENDED_AT,
    )


def test_incomplete_batch_increments_without_closeout():
    """An unfinished run only records progress.

    Return a post-increment document below total_count and verify the exact
    counter update is the only persistence call.
    """
    mongo_dao = _dao(_metadata_validation(**{COMPLETED_BATCHES: 1}))

    _record(mongo_dao, STATUS_PASSED, total_count=3)

    mongo_dao.atomic_update_validation.assert_called_once_with(VALIDATION_ID, PASSED_INCREMENT)
    mongo_dao.atomic_update_submission.assert_not_called()


def test_last_batch_finalizes_stored_worst_status():
    """The last batch closes out with the worst status stored across all batches.

    Make the current task Passed but return a stored worst value for Warning,
    then inspect the literal validation and submission writes.
    """
    mongo_dao = _dao(_metadata_validation(**{
        COMPLETED_BATCHES: 3,
        WORST_BATCH_STATUS: 1,
    }))

    _record(mongo_dao, STATUS_PASSED, total_count=3)

    assert mongo_dao.atomic_update_validation.call_args_list == [
        call(VALIDATION_ID, PASSED_INCREMENT),
        call(VALIDATION_ID, {
            METADATA_ENDED: ENDED_AT,
            METADATA_STATUS: STATUS_WARNING,
            ENDED: ENDED_AT,
            VALIDATION_STATUS: STATUS_WARNING,
        }, expected_status=STATUS_VALIDATING),
    ]
    mongo_dao.atomic_update_submission.assert_called_once_with(SUBMISSION, {
        METADATA_VALIDATION_STATUS: STATUS_WARNING,
        VALIDATION_ENDED: ENDED_AT,
    })


def test_status_detail_is_stored_as_a_list_when_the_type_finishes():
    """Close-out persists accumulated details as a list on validation and submission.

    Complete a one-batch Error run whose increment already stored a detail,
    then inspect the type-finalization update.
    """
    detail = 'model version is not available'
    mongo_dao = _dao(_metadata_validation(**{
        COMPLETED_BATCHES: 1,
        WORST_BATCH_STATUS: 2,
        BATCH_STATUS_DETAILS: [detail],
    }))

    _record(mongo_dao, STATUS_ERROR, total_count=1, status_detail=detail)

    assert mongo_dao.atomic_update_validation.call_args_list[0] == call(
        VALIDATION_ID,
        updates_to_mark_task_done(STATUS_ERROR, METADATA_PROGRESS, detail),
    )
    assert mongo_dao.atomic_update_validation.call_args_list[1] == call(VALIDATION_ID, {
        METADATA_ENDED: ENDED_AT,
        METADATA_STATUS: STATUS_ERROR,
        ENDED: ENDED_AT,
        VALIDATION_STATUS: STATUS_ERROR,
        STATUS_DETAIL: [detail],
    }, expected_status=STATUS_VALIDATING)
    mongo_dao.atomic_update_submission.assert_called_once_with(SUBMISSION, {
        METADATA_VALIDATION_STATUS: STATUS_ERROR,
        VALIDATION_ENDED: ENDED_AT,
        STATUS_DETAIL: [detail],
    })


def test_status_detail_accumulates_across_failed_batches():
    """The finishing batch copies every stored batch detail onto statusDetail."""
    details = ['Batch 0: no study found', 'Batch 1: model not available']
    mongo_dao = _dao(_metadata_validation(**{
        COMPLETED_BATCHES: 2,
        WORST_BATCH_STATUS: 3,
        BATCH_STATUS_DETAILS: details,
    }))

    _record(mongo_dao, STATUS_FAILED, total_count=2, status_detail=details[1])

    assert mongo_dao.atomic_update_validation.call_args_list[0] == call(
        VALIDATION_ID,
        updates_to_mark_task_done(STATUS_FAILED, METADATA_PROGRESS, details[1]),
    )
    finalize = mongo_dao.atomic_update_validation.call_args_list[1]
    assert finalize[0][1][STATUS_DETAIL] == details
    mongo_dao.atomic_update_submission.assert_called_once()
    assert mongo_dao.atomic_update_submission.call_args[0][1][STATUS_DETAIL] == details


def test_failed_task_sets_validating_submission_status_to_error():
    """A Failed run releases a still-Validating submission as Error.

    Return Failed as the stored worst status and a currently Validating
    submission, then verify Failed stays on validation while Error is submitted.
    """
    mongo_dao = _dao(_metadata_validation(**{
        COMPLETED_BATCHES: 1,
        WORST_BATCH_STATUS: 3,
    }))
    mongo_dao.get_submission.return_value = {METADATA_VALIDATION_STATUS: STATUS_VALIDATING}

    _record(mongo_dao, STATUS_FAILED, total_count=1)

    assert mongo_dao.atomic_update_validation.call_args_list[0] == call(
        VALIDATION_ID, FAILED_INCREMENT,
    )
    assert mongo_dao.atomic_update_validation.call_args_list[1] == call(VALIDATION_ID, {
        METADATA_ENDED: ENDED_AT,
        METADATA_STATUS: STATUS_FAILED,
        ENDED: ENDED_AT,
        VALIDATION_STATUS: STATUS_FAILED,
    }, expected_status=STATUS_VALIDATING)
    mongo_dao.atomic_update_submission.assert_called_once_with(SUBMISSION, {
        VALIDATION_ENDED: ENDED_AT,
        METADATA_VALIDATION_STATUS: STATUS_ERROR,
    })


def test_failed_task_does_not_replace_passed_submission_status():
    """A Failed run does not copy Failed over an existing Passed submission status.

    Supply a Passed submission and verify close-out writes only its end time,
    omitting metadataValidationStatus from the submission update.
    """
    mongo_dao = _dao(_metadata_validation(**{
        COMPLETED_BATCHES: 1,
        WORST_BATCH_STATUS: 3,
    }))
    mongo_dao.get_submission.return_value = {METADATA_VALIDATION_STATUS: STATUS_PASSED}

    _record(mongo_dao, STATUS_FAILED, total_count=1)

    mongo_dao.atomic_update_submission.assert_called_once_with(SUBMISSION, {
        VALIDATION_ENDED: ENDED_AT,
    })


def test_new_scope_keeps_worse_submission_metadata_status():
    """Scope New cannot improve an existing worse metadata status.

    Finish the new work as Passed while the submission is Error and verify the
    submission update preserves Error.
    """
    mongo_dao = _dao(_metadata_validation(**{
        COMPLETED_BATCHES: 1,
        WORST_BATCH_STATUS: 0,
        SCOPE: 'New',
    }))
    mongo_dao.get_submission.return_value = {METADATA_VALIDATION_STATUS: STATUS_ERROR}
    mongo_dao._metadata_status_from_nodes.return_value = STATUS_PASSED

    _record(mongo_dao, STATUS_PASSED, total_count=1)

    mongo_dao.atomic_update_submission.assert_called_once_with(SUBMISSION, {
        METADATA_VALIDATION_STATUS: STATUS_ERROR,
        VALIDATION_ENDED: ENDED_AT,
    })


def test_new_scope_recounts_nodes_when_submission_is_validating():
    """A New-scope pass does not overwrite leftover Error nodes.

    Backend has already set metadataValidationStatus to Validating. Recount
    leftover data records as Error and persist that on both documents.
    """
    mongo_dao = _dao(_metadata_validation(**{
        COMPLETED_BATCHES: 1,
        WORST_BATCH_STATUS: 0,
        SCOPE: 'New',
    }))
    mongo_dao.get_submission.return_value = {METADATA_VALIDATION_STATUS: STATUS_VALIDATING}
    mongo_dao._metadata_status_from_nodes.return_value = STATUS_ERROR

    _record(mongo_dao, STATUS_PASSED, total_count=1)

    mongo_dao._metadata_status_from_nodes.assert_called_once()
    assert mongo_dao.atomic_update_validation.call_args_list[1] == call(VALIDATION_ID, {
        METADATA_ENDED: ENDED_AT,
        METADATA_STATUS: STATUS_ERROR,
        ENDED: ENDED_AT,
        VALIDATION_STATUS: STATUS_ERROR,
    }, expected_status=STATUS_VALIDATING)
    mongo_dao.atomic_update_submission.assert_called_once_with(SUBMISSION, {
        METADATA_VALIDATION_STATUS: STATUS_ERROR,
        VALIDATION_ENDED: ENDED_AT,
    })


def test_fail_fast_wins_over_late_closeout():
    """A Validating predicate miss means another worker already finalized.

    Return a completed increment, then None from the close-out write, and
    verify the submission is left alone.
    """
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.side_effect = [
        _metadata_validation(**{COMPLETED_BATCHES: 1, WORST_BATCH_STATUS: 0}),
        None,
    ]

    _record(mongo_dao, STATUS_PASSED, total_count=1)

    assert mongo_dao.atomic_update_validation.call_args_list[1] == call(
        VALIDATION_ID,
        {
            METADATA_ENDED: ENDED_AT,
            METADATA_STATUS: STATUS_PASSED,
            ENDED: ENDED_AT,
            VALIDATION_STATUS: STATUS_PASSED,
        },
        expected_status=STATUS_VALIDATING,
    )
    mongo_dao.atomic_update_submission.assert_not_called()


def test_fail_validation_fast_updates_only_the_targeted_field():
    """Fail-fast releases only the validation type that raised the content error."""
    mongo_dao = MagicMock()
    mongo_dao.atomic_update_validation.return_value = {SUBMISSION_ID: SUBMISSION}
    mongo_dao.get_submission.return_value = {
        METADATA_VALIDATION_STATUS: STATUS_VALIDATING,
        FILE_VALIDATION_STATUS: STATUS_VALIDATING,
    }
    mongo_dao.atomic_update_submission.return_value = {'_id': SUBMISSION}

    fail_validation_fast(
        mongo_dao, VALIDATION_ID, 'missing scope', SUBMISSION,
        submission_status_field=METADATA_VALIDATION_STATUS,
    )

    fail_update = mongo_dao.atomic_update_validation.call_args
    assert fail_update[0][1][VALIDATION_STATUS] == STATUS_FAILED
    assert fail_update[0][1][STATUS_DETAIL] == ['missing scope']
    assert fail_update[1]['expected_status'] == STATUS_VALIDATING
    mongo_dao.atomic_update_submission.assert_called_once_with(
        SUBMISSION,
        {METADATA_VALIDATION_STATUS: STATUS_ERROR},
    )
