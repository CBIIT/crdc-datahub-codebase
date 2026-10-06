"""Shared file and metadata validation close-out.

Overall status is the worse of file and metadata only. Cross-submission status
is not read or written here. Failed is stored on the validation record and is
not copied onto submission file or metadata status.
"""
import json
import time
from datetime import datetime

from bento.common.sqs import VisibilityExtender

from common.constants import (
    BATCH_STATUS_DETAILS,
    COMPLETED_BATCHES,
    ENDED,
    FAILED_BATCHES,
    FILE_ENDED,
    FILE_STATUS,
    FILE_VALIDATION_STATUS,
    ID,
    METADATA_ENDED,
    METADATA_STATUS,
    METADATA_VALIDATION_STATUS,
    SCOPE,
    STATUS_DETAIL,
    STATUS_ERROR,
    STATUS_FAILED,
    STATUS_NEW,
    STATUS_PRECEDENCE,
    SUBMISSION_ID,
    TOTAL_BATCHES,
    TYPE,
    VALIDATION_ENDED,
    VALIDATION_STATUS,
    VALIDATION_TYPE_FILE,
    VALIDATION_TYPE_METADATA,
    WORST_BATCH_STATUS,
)
from common.utils import current_datetime

TOTAL_FILE_MESSAGES = 'totalFileMessages'
COMPLETED_FILE_MESSAGES = 'completedFileMessages'
WORST_FILE_STATUS = 'worstFileStatus'
STATUS_VALIDATING = 'Validating'
NON_TERMINAL_SUBMISSION_STATUSES = {STATUS_VALIDATING, STATUS_NEW, None}
SUBMISSION_WRITE_ATTEMPTS = 3
SUBMISSION_WRITE_RETRY_DELAY_SECONDS = 1


class InvalidValidationMessage(Exception):
    """Message body cannot succeed on redelivery. A new validation run is required."""

    def __init__(self, message, validation_id=None, submission_id=None, submission_status_field=None):
        super().__init__(message)
        self.validation_id = validation_id
        self.submission_id = submission_id
        self.submission_status_field = submission_status_field


class TypeProgress:
    """Counter and status fields for one validation type."""

    def __init__(self, completed_field, total_field, worst_field, ended_field, status_field, submission_status_field, type_name):
        self.completed_field = completed_field
        self.total_field = total_field
        self.worst_field = worst_field
        self.ended_field = ended_field
        self.status_field = status_field
        self.submission_status_field = submission_status_field
        self.type_name = type_name


FILE_PROGRESS = TypeProgress(
    COMPLETED_FILE_MESSAGES,
    TOTAL_FILE_MESSAGES,
    WORST_FILE_STATUS,
    FILE_ENDED,
    FILE_STATUS,
    FILE_VALIDATION_STATUS,
    VALIDATION_TYPE_FILE,
)
METADATA_PROGRESS = TypeProgress(
    COMPLETED_BATCHES,
    TOTAL_BATCHES,
    WORST_BATCH_STATUS,
    METADATA_ENDED,
    METADATA_STATUS,
    METADATA_VALIDATION_STATUS,
    VALIDATION_TYPE_METADATA,
)


def validation_status_from_value(numeric_status):
    """Map a precedence number back to a status string.

    @param numeric_status precedence from STATUS_PRECEDENCE
    @returns status string, or None when the value is not a known precedence
    """
    for status, value in STATUS_PRECEDENCE.items():
        if value == numeric_status:
            return status
    return None


def _is_new_scope(scope):
    """True when scope is New, ignoring case."""
    return bool(scope and str(scope).lower() == STATUS_NEW.lower())


def _status_detail_list(detail):
    """Normalize a status detail value to a list of strings.

    @param detail string, list, or None
    @returns list of detail strings
    """
    if detail is None:
        return []
    if isinstance(detail, list):
        return detail
    return [detail]


def _requested_type_names(type_name):
    """Lowercase names that count as this progress type on validation.type.

    The backend stores file validation as "file". File progress uses "data file".
    Either name means the file type was requested. Matching ignores case.

    @param type_name progress type name
    @returns aliases for that type
    """
    file_type_names = frozenset({VALIDATION_TYPE_FILE.lower(), "file"})
    metadata_type_names = frozenset({VALIDATION_TYPE_METADATA.lower()})
    normalized = str(type_name or "").strip().lower()
    if normalized in file_type_names:
        return file_type_names
    if normalized in metadata_type_names:
        return metadata_type_names
    return frozenset({normalized}) if normalized else frozenset()


def _type_was_requested(type_name, validation_types):
    """True when the validation type list includes this progress type.

    @param type_name progress type name
    @param validation_types type list stored on the validation document
    @returns True when any stored type matches, including the file alias
    """
    if not validation_types:
        return False
    requested = {str(item).strip().lower() for item in validation_types if item}
    return bool(requested & _requested_type_names(type_name))


def updates_to_mark_task_done(status, progress, status_detail=None):
    """Increment the completed counter and raise the worst status for this type.

    Failed metadata tasks also increment failedBatches. A supplied detail is
    appended to batchStatusDetails.

    @param status Passed, Warning, Error, or Failed
    @param progress TypeProgress for the type that finished a task
    @param status_detail optional failure explanation stored on the validation
    @returns Mongo update document with $inc, $max, and optional $push
    @raises ValueError when status is not a known precedence
    """
    new_status_value = STATUS_PRECEDENCE.get(status)
    if new_status_value is None:
        raise ValueError(f'Invalid status: {status}')
    inc_fields = {progress.completed_field: 1}
    if status == STATUS_FAILED and progress.type_name == VALIDATION_TYPE_METADATA:
        inc_fields[FAILED_BATCHES] = 1
    result = {
        '$inc': inc_fields,
        '$max': {progress.worst_field: new_status_value},
    }
    if status_detail is not None:
        result['$push'] = {BATCH_STATUS_DETAILS: status_detail}
    return result


def updates_to_mark_type_done(validation, ended_at, progress, other_progress):
    """Compose updates when every message for this type has finished.

    Overall status and ended time are included only when the validation did not
    also request the other type. "file" and "data file" both count as file.
    A record that is already Failed is not given a new overall status. Failed
    is not written to the submission type status.

    @param validation validation document after the task increment
    @param ended_at datetime when this type finished
    @param progress TypeProgress for the type that just finished
    @param other_progress TypeProgress for the other file/metadata type
    @returns (validation_updates, submission_updates)
    @raises ValueError when validation, ended_at, or type list is unusable
    """
    if not validation:
        raise ValueError(f'Invalid validation object: {validation}')
    if not ended_at or not isinstance(ended_at, datetime):
        raise ValueError(f'Invalid ended at: {ended_at}')

    validation_types = validation.get(TYPE)
    if not validation_types or not isinstance(validation_types, list):
        raise ValueError(f'Invalid validation types: {validation_types}')

    type_status = validation_status_from_value(validation.get(progress.worst_field))
    updated_validation = {
        progress.ended_field: ended_at,
        progress.status_field: type_status,
    }
    if validation.get(VALIDATION_STATUS) == STATUS_FAILED:
        return updated_validation, {}

    updated_submission = {}
    if type_status and type_status != STATUS_FAILED:
        updated_submission[progress.submission_status_field] = type_status

    if not _type_was_requested(other_progress.type_name, validation_types):
        updated_validation[ENDED] = ended_at
        updated_validation[VALIDATION_STATUS] = type_status
        updated_submission[VALIDATION_ENDED] = ended_at

    return updated_validation, updated_submission


def _type_precedence(validation, progress):
    """Precedence for one type, preferring the persisted status string.

    New-scope leftover recounts write fileStatus or metadataStatus without
    changing the numeric worst-task counter. Fall back to that counter when
    the status string is absent.

    @param validation validation document
    @param progress TypeProgress for the type
    @returns precedence number, or None when neither field is usable
    """
    status = validation.get(progress.status_field)
    if status in STATUS_PRECEDENCE:
        return STATUS_PRECEDENCE[status]
    return validation.get(progress.worst_field)


def updates_to_consolidate(validation, progress, other_progress):
    """Compose overall status once both requested types have an ended time.

    Status is the worse of the two type precedence values. Persisted type
    status strings win over numeric worst-task fields. "file" and "data file"
    both count as a requested file type. Cross-submission status is not an
    input. Returns (None, None) when the other type has not finished or the
    validation record is already Failed.

    @param validation validation document including both type ended times
    @param progress TypeProgress for the type that just finished
    @param other_progress TypeProgress for the other type
    @returns (validation_updates, submission_updates) or (None, None)
    @raises ValueError when validation is missing
    """
    if not validation:
        raise ValueError(f'Invalid validation object: {validation}')
    if validation.get(VALIDATION_STATUS) == STATUS_FAILED:
        return None, None

    validation_types = validation.get(TYPE) or []
    if not _type_was_requested(other_progress.type_name, validation_types):
        return None, None

    this_ended = validation.get(progress.ended_field)
    other_ended = validation.get(other_progress.ended_field)
    if this_ended is None or other_ended is None:
        return None, None

    this_value = _type_precedence(validation, progress)
    other_value = _type_precedence(validation, other_progress)
    if this_value is None or other_value is None:
        return None, None

    overall_status = validation_status_from_value(max(this_value, other_value))
    overall_ended = max(this_ended, other_ended)
    return {
        ENDED: overall_ended,
        VALIDATION_STATUS: overall_status,
    }, {VALIDATION_ENDED: overall_ended}


def _persisted(result):
    """True when a Mongo write returned a document.

    None and an empty dict mean the update did not match.
    """
    if result is None:
        return False
    if type(result) is dict and not result:
        return False
    return True


def _keep_worse_submission_status(submission_updates, submission, scope, status_field):
    """For scope New, do not replace a worse existing submission status.

    Validating and New are transient and are not treated as a prior result.
    Missing current status is treated as Passed.
    """
    if not _is_new_scope(scope):
        return submission_updates
    if status_field not in submission_updates:
        return submission_updates
    current_status = (submission or {}).get(status_field)
    if current_status in NON_TERMINAL_SUBMISSION_STATUSES:
        return submission_updates
    new_status = submission_updates[status_field]
    new_prec = STATUS_PRECEDENCE.get(new_status, 0)
    current_prec = STATUS_PRECEDENCE.get(current_status, 0)
    if new_prec < current_prec:
        submission_updates = dict(submission_updates)
        submission_updates[status_field] = current_status
    return submission_updates


def _resolve_new_scope_type_status(mongo_dao, submission_id, progress, type_status):
    """Combine this run's type status with leftover submission records.

    @param mongo_dao MongoDao
    @param submission_id submission id
    @param progress TypeProgress for the type that just finished
    @param type_status worst status from this run
    @returns resolved status string
    """
    if progress.type_name == VALIDATION_TYPE_METADATA:
        return mongo_dao._metadata_status_from_nodes({ID: submission_id}, type_status)
    return mongo_dao.submission_file_status_from_records(submission_id, type_status)


def _required_task_total(mongo_dao, validation_id, progress, total_count):
    """Resolve how many tasks this type must finish before close-out.

    Callers that already know the total (metadata batch messages) skip the
    stored field. File close-out reads totalFileMessages and raises when it
    is missing so a fast worker cannot finalize after one message.

    @param mongo_dao MongoDao
    @param validation_id validation document id
    @param progress TypeProgress for this task's type
    @param total_count expected task count from the caller, when known
    @returns positive task total
    @raises Exception when the validation cannot be loaded or has no total
    """
    if total_count is not None:
        return total_count
    current = mongo_dao.get_validation(validation_id)
    if not current:
        raise Exception(f'Failed to load validation record for {validation_id}')
    stored_total = current.get(progress.total_field)
    if not stored_total:
        raise Exception(
            f'Missing {progress.total_field} on validation {validation_id}'
        )
    return stored_total


def _persist_submission_with_retry(mongo_dao, log, submission_id, validation_id, submission_updates):
    """Write submission close-out fields, retrying twice after a 1s delay.

    Logs a stall when every attempt fails. Does not raise. Callers raise when
    this returns False so a redelivered message can release a submission that
    is still Validating.

    @param mongo_dao MongoDao
    @param log logger
    @param submission_id submission document id
    @param validation_id validation document id
    @param submission_updates fields to persist on the submission
    @returns True when a write matched
    """
    last_error = None
    for attempt in range(SUBMISSION_WRITE_ATTEMPTS):
        try:
            result = mongo_dao.atomic_update_submission(submission_id, submission_updates)
            if _persisted(result):
                return True
            last_error = f'no matching submission {submission_id}'
        except Exception as exc:
            last_error = exc
            log.exception(exc)
        if attempt < SUBMISSION_WRITE_ATTEMPTS - 1:
            time.sleep(SUBMISSION_WRITE_RETRY_DELAY_SECONDS)
    log.error(
        f'Validation has stalled; failed to update submission {submission_id} '
        f'for validation {validation_id}: {last_error}'
    )
    return False


def _stuck_submission_updates(submission, submission_updates, status_field):
    """Keep close-out fields that are still unset on the submission.

    The type status is included only while that field is Validating, so a
    fail-fast Error is left in place. validationEnded is included only when
    it is absent. Other fields are included when at least one of those is written.

    @param submission current submission document
    @param submission_updates close-out fields computed for this attempt
    @param status_field submission type-status field for this task
    @returns fields still worth writing, or an empty dict
    """
    if not submission or not submission_updates:
        return {}
    needed = {}
    if (
        status_field in submission_updates
        and submission.get(status_field) == STATUS_VALIDATING
    ):
        needed[status_field] = submission_updates[status_field]
    if VALIDATION_ENDED in submission_updates and not submission.get(VALIDATION_ENDED):
        needed[VALIDATION_ENDED] = submission_updates[VALIDATION_ENDED]
    if not needed:
        return {}
    for key, value in submission_updates.items():
        if key not in (status_field, VALIDATION_ENDED):
            needed[key] = value
    return needed


def _release_stuck_submission(mongo_dao, log, submission_id, validation_id, submission_updates, status_field):
    """Write close-out fields that are still stuck on the submission.

    Re-reads the submission so a field already moved off Validating is not
    overwritten. Raises when a needed write does not persist, leaving the
    message for a later attempt.

    @param mongo_dao MongoDao
    @param log logger
    @param submission_id submission document id
    @param validation_id validation document id
    @param submission_updates close-out fields computed for this attempt
    @param status_field submission type-status field for this task
    @raises Exception when a still-stuck submission write does not persist
    """
    if not submission_updates or not submission_id:
        return
    submission = mongo_dao.get_submission(submission_id)
    needed = _stuck_submission_updates(submission, submission_updates, status_field)
    if not needed:
        return
    if not _persist_submission_with_retry(
        mongo_dao, log, submission_id, validation_id, needed,
    ):
        raise Exception(f'Failed to update submission record for {submission_id}')


def record_type_progress(status, validation_id, mongo_dao, log, progress, other_progress, total_count=None, status_detail=None, ended_at=None):
    """Record one finished task and close out the type when it is the last task.

    Reloads the validation document after the increment before composing
    type-ended fields. Combined file/metadata runs write those type fields
    first, then consolidate overall status from the document returned by
    that write. A Validating compare-and-swap miss still releases a submission
    field that is stuck on Validating.

    @param status task result (Passed, Warning, Error, or Failed)
    @param validation_id validation document id
    @param mongo_dao MongoDao
    @param log logger
    @param progress TypeProgress for this task's type
    @param other_progress TypeProgress for the other file/metadata type
    @param total_count expected task count; defaults to the total stored on the validation
    @param status_detail optional detail stored when this type is finalized
    @param ended_at datetime for type completion; defaults to now
    @returns latest validation document written during this call
    @raises Exception when the validation document cannot be loaded or updated,
            when the stored task total is missing, or when a still-Validating
            submission close-out does not persist
    """
    log.info(f'record_validation_progress: status={status}, validation_id={validation_id}, type={progress.type_name}')
    if not status:
        return None

    task_updates = updates_to_mark_task_done(status, progress, status_detail)
    total = _required_task_total(mongo_dao, validation_id, progress, total_count)

    updated_validation = mongo_dao.atomic_update_validation(
        validation_id,
        task_updates,
    )
    if not _persisted(updated_validation):
        raise Exception(f'Failed to update validation record for {validation_id}')

    if updated_validation.get(VALIDATION_STATUS) == STATUS_FAILED:
        log.info(f'Validation {validation_id} is already Failed; skipping close-out')
        return updated_validation

    completed = updated_validation.get(progress.completed_field) or 0
    if completed < total:
        return updated_validation

    log.info(f'{progress.type_name} validation is completed, updating validation and submission records')
    fresh_validation = mongo_dao.get_validation(validation_id)
    if not fresh_validation:
        raise Exception(f'Failed to load validation record for {validation_id}')
    if fresh_validation.get(VALIDATION_STATUS) == STATUS_FAILED:
        log.info(f'Validation {validation_id} is already Failed; skipping close-out')
        return fresh_validation

    finished_at = ended_at or current_datetime()
    validation_updates, submission_updates = updates_to_mark_type_done(
        fresh_validation, finished_at, progress, other_progress,
    )
    details = _status_detail_list(fresh_validation.get(BATCH_STATUS_DETAILS))
    if details:
        validation_updates[STATUS_DETAIL] = details
        submission_updates[STATUS_DETAIL] = details

    submission_id = fresh_validation.get(SUBMISSION_ID)
    scope = fresh_validation.get(SCOPE)
    type_status = validation_updates.get(progress.status_field)
    if (
        _is_new_scope(scope)
        and submission_id
        and type_status
        and type_status != STATUS_FAILED
    ):
        resolved_status = _resolve_new_scope_type_status(
            mongo_dao, submission_id, progress, type_status,
        )
        if resolved_status:
            type_status = resolved_status
            validation_updates[progress.status_field] = resolved_status
            if resolved_status != STATUS_FAILED:
                submission_updates[progress.submission_status_field] = resolved_status
            if validation_updates.get(VALIDATION_STATUS) not in (None, STATUS_FAILED):
                validation_updates[VALIDATION_STATUS] = resolved_status

    needs_submission = submission_id and (
        (_is_new_scope(scope) and progress.submission_status_field in submission_updates)
        or type_status == STATUS_FAILED
    )
    current_submission = mongo_dao.get_submission(submission_id) if needs_submission else None
    if type_status == STATUS_FAILED and current_submission and current_submission.get(progress.submission_status_field) == STATUS_VALIDATING:
        submission_updates[progress.submission_status_field] = STATUS_ERROR
    submission_updates = _keep_worse_submission_status(
        submission_updates,
        current_submission,
        scope,
        progress.submission_status_field,
    )

    written_validation = mongo_dao.atomic_update_validation(
        validation_id, validation_updates, expected_status=STATUS_VALIDATING,
    )
    if not _persisted(written_validation):
        log.info(
            f'Validation {validation_id} already finalized; '
            f'releasing submission if it is still Validating'
        )
        _release_stuck_submission(
            mongo_dao, log, submission_id, validation_id, submission_updates,
            progress.submission_status_field,
        )
        return fresh_validation

    overall_validation, overall_submission = updates_to_consolidate(
        written_validation, progress, other_progress,
    )
    if overall_validation:
        overall_written = mongo_dao.atomic_update_validation(
            validation_id, overall_validation, expected_status=STATUS_VALIDATING,
        )
        if _persisted(overall_written):
            written_validation = overall_written
            if overall_submission:
                submission_updates.update(overall_submission)

    _release_stuck_submission(
        mongo_dao, log, submission_id, validation_id, submission_updates,
        progress.submission_status_field,
    )

    return written_validation


def fail_validation_fast(mongo_dao, validation_id, detail, submission_id=None, submission_status_field=None):
    """Mark a validation Failed immediately. Do not wait for remaining messages.

    Submission file or metadata status is set to Error only when the targeted
    field is still Validating. Failed is not written onto those submission
    fields. Cross-submission status is unchanged.

    A Validating CAS miss continues the submission release only when the
    validation is already Failed, so a retried content error can finish the
    submission write. Read and write failures raise so the message is retried.

    @param mongo_dao MongoDao
    @param validation_id validation document id
    @param detail explanation stored on statusDetail
    @param submission_id submission to release from Validating, when known
    @param submission_status_field submission field to release, when this error owns one
    @returns updated validation document, or None when the write does not match
            and the record is not already Failed
    @raises Exception when a submission read fails or the Validating-to-Error
            submission write does not persist
    """
    ended_at = current_datetime()
    updated = mongo_dao.atomic_update_validation(
        validation_id,
        {
            VALIDATION_STATUS: STATUS_FAILED,
            ENDED: ended_at,
            STATUS_DETAIL: _status_detail_list(detail),
        },
        expected_status=STATUS_VALIDATING,
    )
    if not _persisted(updated):
        updated = mongo_dao.get_validation(validation_id)
        if not updated or updated.get(VALIDATION_STATUS) != STATUS_FAILED:
            return updated

    resolved_submission_id = submission_id or updated.get(SUBMISSION_ID)
    if not resolved_submission_id or not submission_status_field:
        return updated

    submission = mongo_dao.get_submission(resolved_submission_id)
    if not submission:
        return updated

    if submission.get(submission_status_field) == STATUS_VALIDATING:
        written = mongo_dao.atomic_update_submission(
            resolved_submission_id, {submission_status_field: STATUS_ERROR},
        )
        if not _persisted(written):
            raise Exception(
                f'Failed to update submission record for {resolved_submission_id}'
            )
    return updated


def process_validation_message(msg, log, mongo_dao, handler, visibility_timeout):
    """Apply the shared message error policy to one SQS message.

    InvalidValidationMessage fails the validation run when a validation ID is
    present and deletes the message. Any other exception leaves the message
    in place so the visibility timeout can expire and SQS can requeue it.

    @param msg SQS message
    @param log logger
    @param mongo_dao MongoDao
    @param handler callable that receives the parsed body and may raise InvalidValidationMessage
    @param visibility_timeout seconds passed to VisibilityExtender
    @returns True when the message was deleted
    """
    extender = None
    try:
        try:
            data = json.loads(msg.body)
        except (json.JSONDecodeError, TypeError) as exc:
            raise InvalidValidationMessage(f'Invalid JSON: {exc}')
        if not isinstance(data, dict):
            raise InvalidValidationMessage(
                f'Invalid JSON: expected an object, got {type(data).__name__}'
            )
        log.debug(data)
        extender = VisibilityExtender(msg, visibility_timeout)
        handler(data)
        msg.delete()
        return True
    except InvalidValidationMessage as exc:
        log.error(str(exc))
        try:
            if exc.validation_id:
                fail_validation_fast(
                    mongo_dao, exc.validation_id, str(exc), exc.submission_id,
                    submission_status_field=exc.submission_status_field,
                )
            msg.delete()
            return True
        except Exception as write_error:
            log.exception(write_error)
            log.critical('Failed to record a content error; message will be retried after the visibility timeout.')
            return False
    except Exception as exc:
        log.exception(exc)
        log.critical('Validation message hit a retryable error. It will be requeued after the visibility timeout.')
        return False
    finally:
        if extender:
            extender.stop()
            extender = None
