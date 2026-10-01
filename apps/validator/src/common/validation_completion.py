"""Shared finalization for metadata and file validation.

Progress writes maintain each task's worst numeric value. Reconciliation records
the task status and ended time from fresh state, then closes the validation only
when every metadata and file task listed in its type has ended.
"""
from datetime import datetime

from common.constants import (
    ENDED,
    EXPECTED_BATCH_INDEXES,
    EXPECTED_FILE_TASK_KEYS,
    FILE_ENDED,
    FILE_STATUS,
    FILE_VALIDATION_STATUS,
    ID,
    METADATA_ENDED,
    METADATA_STATUS,
    PROCESSED_BATCH_INDEXES,
    PROCESSED_FILE_TASK_KEYS,
    STATUS_DETAIL,
    STATUS_PRECEDENCE,
    SUBMISSION_ID,
    TYPE,
    VALIDATION_ENDED,
    VALIDATION_ABORTED,
    VALIDATION_STATUS,
    VALIDATION_TYPE_FILE,
    VALIDATION_TYPE_METADATA,
    WORST_BATCH_STATUS,
    WORST_FILE_STATUS,
)

# The validate-submission API stores the file current task as "file". Older records use "data file".
FILE_TYPE_NAMES = {VALIDATION_TYPE_FILE, "file"}

_CURRENT_TASK_FIELDS = {
    VALIDATION_TYPE_FILE: {
        "ended": FILE_ENDED,
        "status": FILE_STATUS,
        "worst": WORST_FILE_STATUS,
        "submission_status": FILE_VALIDATION_STATUS,
        "expected": EXPECTED_FILE_TASK_KEYS,
        "processed": PROCESSED_FILE_TASK_KEYS,
    },
    VALIDATION_TYPE_METADATA: {
        "ended": METADATA_ENDED,
        "status": METADATA_STATUS,
        "worst": WORST_BATCH_STATUS,
        "submission_status": None,
        "expected": EXPECTED_BATCH_INDEXES,
        "processed": PROCESSED_BATCH_INDEXES,
    },
}


def validation_status_from_value(worse_value: int) -> str:
    """Map a numeric precedence back to a status string.

    @param worse_value Precedence from STATUS_PRECEDENCE
    @returns Status string, or None when the value is not a known precedence
    """
    for status, value in STATUS_PRECEDENCE.items():
        if value == worse_value:
            return status
    return None


def _normalized_types(validation_types):
    if not validation_types or not isinstance(validation_types, list):
        raise ValueError(f"Invalid validation types: {validation_types}")
    return [validation_type.lower() for validation_type in validation_types if isinstance(validation_type, str)]


def _includes_metadata(validation_types):
    return VALIDATION_TYPE_METADATA in _normalized_types(validation_types)


def _includes_file(validation_types):
    normalized = _normalized_types(validation_types)
    return any(file_type in normalized for file_type in FILE_TYPE_NAMES)


def validation_is_aborted(validation: dict) -> bool:
    """Return whether the backend explicitly aborted this validation run.

    @param validation Persisted validation document
    @returns True when the backend stored the aborted marker
    """
    return isinstance(validation, dict) and validation.get(VALIDATION_ABORTED) is True


def updates_to_close_out(validation: dict):
    """Compose overall status and ended time when every metadata and file task has ended.

    Cross-submission is not a close-out task. A stored overall status is included so
    a completed Error is not replaced by a later Passed or Warning during retry.

    @param validation Validation document after this current task's update
    @returns Tuple of validation fields and submission fields, or (None, None) when a required task is still open
    @raises ValueError When a finished task is missing its numeric worst status
    """
    validation_types = validation.get(TYPE)
    ended_values = []
    worst_values = []

    if _includes_metadata(validation_types):
        metadata_ended = validation.get(METADATA_ENDED)
        if metadata_ended is None:
            return None, None
        metadata_worst = validation.get(WORST_BATCH_STATUS)
        if metadata_worst is None:
            raise ValueError("Metadata current task ended without worstBatchStatus")
        ended_values.append(metadata_ended)
        worst_values.append(metadata_worst)

    if _includes_file(validation_types):
        file_ended = validation.get(FILE_ENDED)
        if file_ended is None:
            return None, None
        file_worst = validation.get(WORST_FILE_STATUS)
        if file_worst is None:
            raise ValueError("File current task ended without worstFileStatus")
        ended_values.append(file_ended)
        worst_values.append(file_worst)

    if not ended_values:
        return None, None

    stored_status = STATUS_PRECEDENCE.get(validation.get(VALIDATION_STATUS))
    if stored_status is not None:
        worst_values.append(stored_status)

    overall_ended = max(ended_values)
    overall_status = validation_status_from_value(max(worst_values))
    return (
        {
            ENDED: overall_ended,
            VALIDATION_STATUS: overall_status,
        },
        {
            VALIDATION_ENDED: overall_ended,
        },
    )


def close_out_query(validation_id: str, validation: dict) -> dict:
    """Query that matches the ended timestamps and worst values used for close-out.

    @param validation_id Validation document id
    @param validation Validation document whose type lists the required tasks
    @returns MongoDB query
    """
    validation_types = validation.get(TYPE)
    query = {
        ID: validation_id,
        VALIDATION_ABORTED: {"$ne": True},
        VALIDATION_STATUS: validation.get(VALIDATION_STATUS),
    }
    if _includes_metadata(validation_types):
        query[METADATA_ENDED] = {"$exists": True, "$ne": None}
        query[WORST_BATCH_STATUS] = validation.get(WORST_BATCH_STATUS)
    if _includes_file(validation_types):
        query[FILE_ENDED] = {"$exists": True, "$ne": None}
        query[WORST_FILE_STATUS] = validation.get(WORST_FILE_STATUS)
    return query


def _progress_is_complete(validation: dict, current_task: str) -> bool:
    """Return whether every expected key for the current task has been recorded.

    A task that already has an ended time can still be reconciled. A missing expected
    set keeps the run open. Message totals are not used.

    @param validation Persisted validation document
    @param current_task Current validation task
    @returns True when this current task can be finalized
    """
    if not isinstance(validation, dict):
        return False
    fields = _CURRENT_TASK_FIELDS[current_task]
    if validation.get(fields["ended"]) is not None:
        return True
    expected = validation.get(fields["expected"])
    if not isinstance(expected, list):
        return False
    processed = validation.get(fields["processed"]) or []
    return all(key in processed for key in expected)


def apply_current_task_completion(mongo_dao, validation_id: str, ended_at: datetime,
                                  current_task: str, log, status_detail=None):
    """Reconcile current-task and overall completion from fresh persisted state.

    The call does nothing until that task's expected keys are recorded. An existing
    task end time is preserved. Conditional writes are tied to the persisted worst
    values so a stale snapshot cannot lower a status.

    @param mongo_dao DAO with validation and submission update methods
    @param validation_id Validation document id
    @param ended_at End time to use only when this task has not already ended
    @param current_task "metadata" or "data file"
    @param log Logger
    @param status_detail Failure messages stored when provided
    @returns Latest validation document
    @raises RuntimeError When required persistence fails or concurrent updates are not resolved
    @raises ValueError When persisted task state is invalid
    """
    if current_task not in _CURRENT_TASK_FIELDS:
        raise ValueError(f"Invalid current task: {current_task}")
    if not ended_at or not isinstance(ended_at, datetime):
        raise ValueError(f"Invalid ended at: {ended_at}")

    fields = _CURRENT_TASK_FIELDS[current_task]
    close_validation = None
    close_submission = None
    validation = None
    for _ in range(5):
        validation = mongo_dao.get_validation(validation_id)
        if not validation:
            raise RuntimeError(f"Failed to load validation record for {validation_id}")
        if validation_is_aborted(validation):
            log.info(f"Validation {validation_id} was aborted; completion reconciliation is skipped")
            return validation
        if not _progress_is_complete(validation, current_task):
            log.info(f"Validation {validation_id} stays open; {current_task} progress is incomplete")
            return validation

        stored_worst = validation.get(fields["worst"])
        stored_status = validation_status_from_value(stored_worst)
        if stored_status is None:
            raise ValueError(f"Invalid worst status {stored_worst} for {current_task}")

        if validation.get(fields["ended"]) is None:
            updates = {
                fields["ended"]: ended_at,
                fields["status"]: stored_status,
            }
            if status_detail is not None:
                updates[STATUS_DETAIL] = status_detail
            updated = mongo_dao.conditional_update_validation(
                {
                    ID: validation_id,
                    VALIDATION_ABORTED: {"$ne": True},
                    fields["ended"]: None,
                    fields["worst"]: stored_worst,
                },
                updates,
            )
            if not updated:
                continue
            validation = updated

        status_updates = {}
        if validation.get(fields["status"]) != stored_status:
            status_updates[fields["status"]] = stored_status
        if status_detail is not None and validation.get(STATUS_DETAIL) != status_detail:
            status_updates[STATUS_DETAIL] = status_detail
        if status_updates:
            updated = mongo_dao.conditional_update_validation(
                {
                    ID: validation_id,
                    VALIDATION_ABORTED: {"$ne": True},
                    fields["worst"]: stored_worst,
                },
                status_updates,
            )
            if not updated:
                continue
            validation = updated

        submission_id = validation.get(SUBMISSION_ID)
        if fields["submission_status"] and submission_id:
            latest_validation = mongo_dao.get_validation(validation_id)
            if not latest_validation:
                raise RuntimeError(f"Failed to reload validation record for {validation_id}")
            if validation_is_aborted(latest_validation):
                log.info(
                    f"Validation {validation_id} was aborted; submission status update is skipped"
                )
                return latest_validation
            updated_submission = mongo_dao.atomic_update_submission(
                submission_id, {fields["submission_status"]: stored_status}
            )
            if not updated_submission:
                raise RuntimeError(f"Failed to update submission record for {submission_id}")

        close_validation, close_submission = updates_to_close_out(validation)
        if not close_validation:
            log.info(f"Validation {validation_id} stays open; another current task has not ended")
            return validation
        if (validation.get(ENDED) == close_validation[ENDED]
                and validation.get(VALIDATION_STATUS) == close_validation[VALIDATION_STATUS]):
            break
        closed = mongo_dao.conditional_update_validation(
            close_out_query(validation_id, validation),
            close_validation,
        )
        if not closed:
            continue
        validation = closed
        break
    else:
        raise RuntimeError(
            f"Validation {validation_id} could not be reconciled after concurrent updates"
        )

    submission_id = validation.get(SUBMISSION_ID)
    if close_submission and submission_id:
        updated_submission = mongo_dao.atomic_update_submission(submission_id, close_submission)
        if not updated_submission:
            raise RuntimeError(f"Failed to close submission record for {submission_id}")
    log.info(f"Validation {validation_id} closed out with status {close_validation.get(VALIDATION_STATUS)}")
    return validation
