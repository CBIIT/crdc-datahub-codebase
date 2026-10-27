#!/usr/bin/env python3
import pandas as pd
import csv
import json
import os, io, boto3
import re
import time
import threading
import io
from datetime import timedelta
from botocore.exceptions import ClientError
from bento.common.sqs import VisibilityExtender
from bento.common.utils import get_logger
from common.constants import SQS_TYPE, SUBMISSION_ID, BATCH_BUCKET, TYPE_EXPORT_METADATA, TYPE_EXPORT_DCF_MANIFEST, ID, NODE_TYPE, \
    RELEASE, ARCHIVE_RELEASE, EXPORT_METADATA, EXPORT_ROOT_PATH, SERVICE_TYPE_EXPORT, CRDC_ID, NODE_ID,\
    DATA_COMMON_NAME, CREATED_AT, MODEL_VERSION, MODEL_FILE_DIR, TIER_CONFIG, SQS_NAME, TYPE, UPDATED_AT, \
    PARENTS, PROPERTIES, SUBMISSION_REL_STATUS, SUBMISSION_REL_STATUS_RELEASED, SUBMISSION_INTENTION, \
    SUBMISSION_INTENTION_DELETE, SUBMISSION_REL_STATUS_DELETED, TYPE_COMPLETE_SUB, ORIN_FILE_NAME,\
    STUDY_ID, DM_BUCKET_CONFIG_NAME, DATASYNC_ROLE_ARN_CONFIG, ENTITY_TYPE, SUBMISSION_HISTORY, RELEASE_AT, \
    SUBMISSION_INTENTION_NEW_UPDATE, SUBMISSION_DATA_TYPE, SUBMISSION_DATA_TYPE_METADATA_ONLY, DATASYNC_LOG_ARN_CONFIG, \
    S3_FILE_INFO, FILE_NAME, RESTORE_DELETED_DATA_FILES, DATA_FILE_LOCATION, S3_PREFIX, GENERATED_PROPS, DELETE_COMMAND, \
    DATA_SYNC_TYPE_METADATA, DATA_SYNC_TYPE_FILE, DATA_SYNC_STATUS_IN_PROGRESS, DATA_SYNC_STATUS_FAILED, \
    DATA_SYNC_STATUS_SUCCEEDED, DATA_SYNC_STATUS_STALE, DATA_SYNC_TASK_ARN, DATA_SYNC_TASK_ARN_RECORDED_AT, \
    DATA_SYNC_TASK_EXECUTION_ARN, \
    DATA_SYNC_SOURCE_LOCATION_ARN, DATA_SYNC_DEST_LOCATION_ARN, DATA_SYNC_LIST_PENDING, \
    DATA_SYNC_ROLLUP_PENDING, DATA_SYNC_CLEANUP_AFTER, DATA_SYNC_CLEANUP_STARTED_AT, \
    DATA_SYNC_CLEANED_AT, DATA_SYNC_CLEANUP_ERROR, \
    DATA_SYNC_LAST_ERROR, DATA_SYNC_OBSERVATION_ERROR_SINCE, \
    DATA_SYNC_LAST_POLLED_AT, DATA_SYNC_START_TIME, DATA_SYNC_END_TIME, STATUS, \
    DATA_SYNC_MONITOR_ACTIVE_INTERVAL_SECONDS, DATA_SYNC_MONITOR_WAITING_INTERVAL_SECONDS, \
    DATA_SYNC_START_GRACE_SECONDS, DATA_SYNC_CLEANUP_DELAY_SECONDS, DATA_SYNC_POLL_CLAIM_SECONDS, \
    DATA_SYNC_WRITE_MAX_ATTEMPTS, DATA_SYNC_WRITE_RETRY_DELAY_SECONDS, \
    DATA_SYNC_OBSERVATION_ALERT_SECONDS, DATA_SYNC_MONITOR_STATE_ACTIVE, \
    DATA_SYNC_MONITOR_STATE_WAITING, DATA_SYNC_WRITE_APPLIED, DATA_SYNC_WRITE_STALE, DATA_SYNC_WRITE_ERROR, \
    DATA_SYNC_LAST_ERROR_NOT_STARTED, DATA_SYNC_LAST_ERROR_STALE_NO_TASK, DATA_SYNC_LAST_ERROR_STALE_NOT_FOUND, \
    DATA_SYNC_LOG_TRANSFER_FAILED, DATA_SYNC_LOG_EXECUTION_FAILED, DATA_SYNC_LOG_TRACKING_FAILED, \
    DATA_SYNC_LOG_OBSERVATION_ERROR, DATA_SYNC_LOG_CLEANUP_FAILED, \
    DATA_SYNC_LOG_CLEANUP_DEFERRED, DATA_SYNC_LOG_STALE, DATA_SYNC_TASK_NAME_PREFIX
from common.utils import current_datetime, get_uuid_str, dump_dict_to_json, get_exception_msg, get_date_time, dict_exists_in_list, \
    convert_date_time, convert_file_size
from common.model_store import ModelFactory
from common.s3_utils import S3Service
from dcf_manifest_generator import GenerateDCF
from service.ecs_agent import set_scale_in_protection


VISIBILITY_TIMEOUT = 20
BATCH_SIZE = 1000

_data_sync_wake_event = threading.Event()

def _track(log, fn, *args, sleep_fn=None, **kwargs):
    """Call a tracking write, retrying error outcomes up to DATA_SYNC_WRITE_MAX_ATTEMPTS times.

    Waits DATA_SYNC_WRITE_RETRY_DELAY_SECONDS between attempts. A stale outcome is returned
    immediately and is never retried. Exceptions are treated as error outcomes.

    @param log logger
    @param fn callable, usually a MongoDao method
    @param sleep_fn sleep used between attempts; defaults to time.sleep
    @returns the callable's write outcome, or DATA_SYNC_WRITE_ERROR when every attempt fails
    """
    sleep_fn = sleep_fn or time.sleep
    try:
        name = fn.__name__
    except Exception:
        name = "tracking write"
    last_outcome = DATA_SYNC_WRITE_ERROR
    for attempt in range(DATA_SYNC_WRITE_MAX_ATTEMPTS):
        try:
            outcome = fn(*args, **kwargs)
        except Exception as e:
            log.exception(e)
            log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} {name} raised: {get_exception_msg()}")
            outcome = DATA_SYNC_WRITE_ERROR
        if outcome != DATA_SYNC_WRITE_ERROR:
            return outcome
        last_outcome = outcome
        if attempt + 1 < DATA_SYNC_WRITE_MAX_ATTEMPTS:
            sleep_fn(DATA_SYNC_WRITE_RETRY_DELAY_SECONDS)
    log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} {name} failed after {DATA_SYNC_WRITE_MAX_ATTEMPTS} attempts")
    return last_outcome

def _data_sync_context(submission_id, sync_type, data_sync_id, task_arn=None, task_execution_arn=None, source_location_arn=None, destination_location_arn=None):
    """Format the ids and ARNs included on every DataSync log line.

    @param submission_id submission document id
    @param sync_type DataSync type
    @param data_sync_id dataSync document id
    @param task_arn AWS task ARN, when known
    @param task_execution_arn AWS task execution ARN, when known
    @param source_location_arn AWS source location ARN, when known
    @param destination_location_arn AWS destination location ARN, when known
    @returns a single log context string
    """
    parts = [
        f"submissionID={submission_id or 'none'}",
        f"type={sync_type or 'none'}",
        f"dataSyncID={data_sync_id or 'none'}",
    ]
    if task_arn:
        parts.append(f"taskArn={task_arn}")
    if task_execution_arn:
        parts.append(f"taskExecutionArn={task_execution_arn}")
    if source_location_arn:
        parts.append(f"sourceLocationArn={source_location_arn}")
    if destination_location_arn:
        parts.append(f"destinationLocationArn={destination_location_arn}")
    return " ".join(parts)

def _context_from_record(record):
    """Build log context from a dataSync document.

    @param record dataSync document
    @returns log context string
    """
    return _data_sync_context(
        record.get(SUBMISSION_ID), record.get(TYPE), record.get(ID),
        record.get(DATA_SYNC_TASK_ARN), record.get(DATA_SYNC_TASK_EXECUTION_ARN),
        record.get(DATA_SYNC_SOURCE_LOCATION_ARN), record.get(DATA_SYNC_DEST_LOCATION_ARN),
    )

def notify_data_sync_started():
    """Wake a waiting monitor so it polls the new dataSync record immediately."""
    _data_sync_wake_event.set()

def _data_sync_task_name(tier, data_sync_id=None):
    """Build the DataSync task Name used for discovery by the orphan sweep.

    Tracked transfers include dataSyncID; untracked transfers use tier only.
    Legacy bare Data_Hub_SyncTask names remain discoverable via the sweep's legacy rules.

    @param tier deployment tier string
    @param data_sync_id dataSync document id when tracking, or None for untracked
    @returns task Name string
    """
    if data_sync_id:
        return f"{DATA_SYNC_TASK_NAME_PREFIX}-{tier}-{data_sync_id}"
    return f"{DATA_SYNC_TASK_NAME_PREFIX}-{tier}"

def _next_data_sync_monitor_state(unfinished_count):
    """Choose the monitor state from how many unfinished records a pass found.

    @param unfinished_count number of unfinished records, or None when the query failed
    @returns active, waiting, or None to keep the current state
    """
    if unfinished_count is None:
        return None
    if unfinished_count > 0:
        return DATA_SYNC_MONITOR_STATE_ACTIVE
    return DATA_SYNC_MONITOR_STATE_WAITING

def _client_error_not_found(error):
    """True when a DataSync ClientError reports that the resource does not exist.

    ResourceNotFoundException is treated as not-found by code alone. InvalidRequestException
    is also used for validation failures, so it counts as not-found only when a structured
    DataSync error-code field indicates a missing resource, or as a last resort when the
    message matches a narrow not-found pattern (DataSync historically returns
    InvalidRequestException for describe/delete of missing tasks and locations).

    @param error botocore ClientError
    @returns True when the error indicates the resource does not exist
    """
    err = error.response.get("Error", {}) if getattr(error, "response", None) else {}
    code = err.get("Code", "")
    if code == "ResourceNotFoundException":
        return True
    if code != "InvalidRequestException":
        return False
    # Prefer structured codes when present (botocore may expose them under Error or response root).
    structured = (
        err.get("datasyncErrorCode")
        or err.get("errorCode")
        or error.response.get("datasyncErrorCode")
        or error.response.get("errorCode")
        or ""
    )
    if structured in ("ResourceNotFoundException", "NotFound", "TaskNotFound", "LocationNotFound"):
        return True
    # Last resort: DataSync reuses InvalidRequestException for both not-found and invalid
    # parameters; only treat clear absence wording as not-found.
    message = err.get("Message", "") or ""
    return bool(re.search(r"\bnot found\b|does not exist", message, re.IGNORECASE))

def _confirmed_start_rejection(error):
    """True when start_task_execution returned a ClientError that confirms AWS rejected the start.

    Timeouts and lost responses are not ClientErrors with these codes, so they stay ambiguous
    and must not mark the record Failed (which would allow cleanup while a transfer may still run).

    @param error botocore ClientError
    @returns True when the error code is a confirmed rejection
    """
    err = error.response.get("Error", {}) if getattr(error, "response", None) else {}
    return err.get("Code", "") in (
        "InvalidRequestException",
        "ResourceNotFoundException",
        "AccessDeniedException",
    )

def _execution_error_detail(response):
    """Read the AWS Result error from a describe_task_execution response.

    @param response describe_task_execution response
    @returns ErrorCode and/or ErrorDetail joined with ": ", or None when AWS reported none
    """
    result = response.get("Result") or {}
    error_code = result.get("ErrorCode")
    error_detail = result.get("ErrorDetail")
    parts = [part for part in (error_code, error_detail) if part]
    if not parts:
        return None
    return ": ".join(parts)

def _clear_submission_gone_flags(mongo_dao, log, data_sync_id, context):
    """Clear listPending and rollupPending after a STALE list add (submission missing).

    @param mongo_dao MongoDao instance
    @param log logger
    @param data_sync_id dataSync document id
    @param context log context string
    @returns True when the clear write applied
    """
    log.error(f"DataSync submission not found {context}")
    outcome = _track(
        log, mongo_dao.update_data_sync, data_sync_id,
        {DATA_SYNC_LIST_PENDING: False, DATA_SYNC_ROLLUP_PENDING: False},
    )
    return outcome == DATA_SYNC_WRITE_APPLIED

def _defer_cleanup(log, context):
    """Log that AWS cleanup is waiting on a tracking write.

    @param log logger
    @param context log context string
    """
    log.error(f"{DATA_SYNC_LOG_CLEANUP_DEFERRED} {context}")

def _absence_terminal_match_fields(record):
    """Extra match_fields so absence-based terminals do not overwrite a record whose ARNs changed.

    Confirmed SUCCESS/ERROR describes stay status-only. Absence terminals (no task, not-found,
    not-started) also require the observed ARN presence to still match.

    @param record dataSync document as observed for this decision
    @returns match_fields to merge with status In Progress
    """
    match = {}
    task_arn = record.get(DATA_SYNC_TASK_ARN)
    execution_arn = record.get(DATA_SYNC_TASK_EXECUTION_ARN)
    if task_arn:
        match[DATA_SYNC_TASK_ARN] = task_arn
    else:
        match[DATA_SYNC_TASK_ARN] = {"$exists": False}
    if execution_arn:
        match[DATA_SYNC_TASK_EXECUTION_ARN] = execution_arn
    else:
        match[DATA_SYNC_TASK_EXECUTION_ARN] = {"$exists": False}
    return match

def _observation_changed_since_snapshot(mongo_dao, record):
    """True when a fresh read shows ARN or status values that differ from the monitor snapshot.

    @param mongo_dao MongoDao instance
    @param record dataSync document used for the failed terminal write
    @returns True when taskArn, taskArnRecordedAt, taskExecutionArn, or status changed
    """
    stored = mongo_dao.find_data_sync_by_id(record.get(ID))
    if not stored:
        return True
    return (
        stored.get(STATUS) != record.get(STATUS)
        or stored.get(DATA_SYNC_TASK_ARN) != record.get(DATA_SYNC_TASK_ARN)
        or stored.get(DATA_SYNC_TASK_ARN_RECORDED_AT) != record.get(DATA_SYNC_TASK_ARN_RECORDED_AT)
        or stored.get(DATA_SYNC_TASK_EXECUTION_ARN) != record.get(DATA_SYNC_TASK_EXECUTION_ARN)
    )

def _finalize_data_sync_record(mongo_dao, log, record, status, end_time, last_error, schedule_cleanup, match_fields=None):
    """Write a terminal dataSync status. Sets cleanupAfter for Succeeded/Failed results that still
    have ARNs to delete. Stale records pass schedule_cleanup=False for manual cleanup.

    Only matches while status is still In Progress so a stale monitor snapshot cannot overwrite
    a record another container already finalized. Absence terminals pass extra match_fields so a
    snapshot missing ARNs cannot mark a live transfer Stale after the starter wrote them.

    @param mongo_dao MongoDao instance
    @param log logger
    @param record dataSync document, updated in place on success
    @param status Succeeded, Failed, or Stale
    @param end_time terminal time
    @param last_error diagnostic to store, or None
    @param schedule_cleanup True when AWS resources should be deleted after the delay
    @param match_fields extra filter fields for absence-based terminals, or None
    @returns True when the record was updated
    """
    context = _context_from_record(record)
    set_fields = {
        STATUS: status,
        DATA_SYNC_END_TIME: end_time,
        DATA_SYNC_ROLLUP_PENDING: True,
    }
    unset_fields = [DATA_SYNC_OBSERVATION_ERROR_SINCE]
    if record.get(DATA_SYNC_TASK_EXECUTION_ARN):
        set_fields[DATA_SYNC_TASK_EXECUTION_ARN] = record[DATA_SYNC_TASK_EXECUTION_ARN]
    if last_error:
        set_fields[DATA_SYNC_LAST_ERROR] = last_error
    else:
        unset_fields.append(DATA_SYNC_LAST_ERROR)
    if schedule_cleanup:
        set_fields[DATA_SYNC_CLEANUP_AFTER] = end_time + timedelta(seconds=DATA_SYNC_CLEANUP_DELAY_SECONDS)
    filters = {STATUS: DATA_SYNC_STATUS_IN_PROGRESS, **(match_fields or {})}
    outcome = _track(
        log, mongo_dao.update_data_sync, record.get(ID), set_fields,
        unset_fields=unset_fields,
        match_fields=filters,
    )
    if outcome == DATA_SYNC_WRITE_APPLIED:
        record[STATUS] = status
        record[DATA_SYNC_END_TIME] = end_time
        record[DATA_SYNC_ROLLUP_PENDING] = True
        record.pop(DATA_SYNC_OBSERVATION_ERROR_SINCE, None)
        if last_error:
            record[DATA_SYNC_LAST_ERROR] = last_error
        else:
            record.pop(DATA_SYNC_LAST_ERROR, None)
        if schedule_cleanup:
            record[DATA_SYNC_CLEANUP_AFTER] = set_fields[DATA_SYNC_CLEANUP_AFTER]
        else:
            record.pop(DATA_SYNC_CLEANUP_AFTER, None)
        return True
    if outcome == DATA_SYNC_WRITE_STALE:
        if match_fields is not None and _observation_changed_since_snapshot(mongo_dao, record):
            log.info(f"DataSync observation changed; skipping terminal write {context}")
            return False
        log.info(f"DataSync already finalized by another monitor {context}")
        return False
    log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} finalize outcome={outcome} {context}")
    if schedule_cleanup or record.get(DATA_SYNC_CLEANUP_AFTER):
        _defer_cleanup(log, context)
    return False

def _finish_record_submission(mongo_dao, log, record):
    """Apply the submission finish write when the in-flight list add has been recorded.

    @param mongo_dao MongoDao instance
    @param log logger
    @param record dataSync document
    @returns True when rollupPending was cleared
    """
    if record.get(DATA_SYNC_LIST_PENDING):
        return False
    if not record.get(DATA_SYNC_ROLLUP_PENDING):
        return True
    context = _context_from_record(record)
    outcome = _track(
        log, mongo_dao.finish_submission_data_sync,
        record.get(SUBMISSION_ID), record.get(TYPE), record.get(ID), record.get(STATUS),
    )
    if outcome == DATA_SYNC_WRITE_ERROR:
        log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} finish outcome={outcome} {context}")
        _defer_cleanup(log, context)
        return False
    if outcome == DATA_SYNC_WRITE_STALE:
        log.info(f"DataSync submission status already finished {context}")
    else:
        log.info(f"DataSync submission status set to {record.get(STATUS)} {context}")
    cleared = _track(log, mongo_dao.update_data_sync, record.get(ID), {DATA_SYNC_ROLLUP_PENDING: False})
    if cleared != DATA_SYNC_WRITE_APPLIED:
        log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} clear rollupPending outcome={cleared} {context}")
        _defer_cleanup(log, context)
        return False
    record[DATA_SYNC_ROLLUP_PENDING] = False
    return True

def _cleanup_due(record, now):
    """True when this record's AWS cleanup is allowed to run.

    Requires a terminal Succeeded or Failed status (Stale records are never auto-cleaned).

    @param record dataSync document
    @param now current datetime
    @returns True when cleanupAfter is set, due, status is Succeeded or Failed, and tracking writes are done
    """
    cleanup_after = record.get(DATA_SYNC_CLEANUP_AFTER)
    if not cleanup_after or record.get(DATA_SYNC_LIST_PENDING) or record.get(DATA_SYNC_ROLLUP_PENDING):
        return False
    if record.get(STATUS) not in (DATA_SYNC_STATUS_SUCCEEDED, DATA_SYNC_STATUS_FAILED):
        return False
    return cleanup_after <= now

def _delete_data_sync_resources(datasync, log, record):
    """Delete the AWS task and both locations. Not-found counts as already done.

    A failure leaves tracking fields untouched.

    @param datasync boto3 DataSync client
    @param log logger
    @param record dataSync document
    @returns (True, None) when every delete succeeded or was already gone;
             (False, error_message) on the first failure
    """
    context = _context_from_record(record)
    deletes = (
        ("task", record.get(DATA_SYNC_TASK_ARN), "delete_task", "TaskArn"),
        ("source location", record.get(DATA_SYNC_SOURCE_LOCATION_ARN), "delete_location", "LocationArn"),
        ("destination location", record.get(DATA_SYNC_DEST_LOCATION_ARN), "delete_location", "LocationArn"),
    )
    for label, arn, method_name, arg_name in deletes:
        if not arn:
            continue
        try:
            getattr(datasync, method_name)(**{arg_name: arn})
        except ClientError as ce:
            if _client_error_not_found(ce):
                continue
            message = ce.response['Error']['Message']
            log.exception(ce)
            log.error(
                f"{DATA_SYNC_LOG_CLEANUP_FAILED} {label} {arn} {context}. "
                f"Tracking is already recorded and is not affected. {message}"
            )
            return False, f"{label} {arn}: {message}"
        except Exception as e:
            message = get_exception_msg()
            log.exception(e)
            log.error(
                f"{DATA_SYNC_LOG_CLEANUP_FAILED} {label} {arn} {context}. "
                f"Tracking is already recorded and is not affected. {message}"
            )
            return False, f"{label} {arn}: {message}"
    return True, None

def _record_observation_error(mongo_dao, log, record, message):
    """Remember a transient AWS read failure and log it, louder after an hour.

    @param mongo_dao MongoDao instance
    @param log logger
    @param record dataSync document
    @param message error text
    """
    now = current_datetime()
    since = record.get(DATA_SYNC_OBSERVATION_ERROR_SINCE) or now
    _track(log, mongo_dao.update_data_sync, record.get(ID), {
        DATA_SYNC_LAST_ERROR: message,
        DATA_SYNC_OBSERVATION_ERROR_SINCE: since,
    })
    record[DATA_SYNC_OBSERVATION_ERROR_SINCE] = since
    context = _context_from_record(record)
    if (now - since).total_seconds() >= DATA_SYNC_OBSERVATION_ALERT_SECONDS:
        log.error(f"{DATA_SYNC_LOG_OBSERVATION_ERROR} {context}: {message}")
    else:
        log.warning(f"{DATA_SYNC_LOG_OBSERVATION_ERROR} {context}: {message}")

def _resolve_task_execution_arn(datasync, mongo_dao, log, record):
    """Return the execution ARN from the record, or from list_task_executions when only the task ARN is saved.

    When more than one execution exists, describes each and picks the latest StartTime.
    A task normally starts exactly once; multiple executions are unexpected and logged.

    @param datasync boto3 DataSync client
    @param mongo_dao MongoDao instance
    @param log logger
    @param record dataSync document, updated in place when an execution ARN is found
    @returns the execution ARN, or None
    """
    execution_arn = record.get(DATA_SYNC_TASK_EXECUTION_ARN)
    if execution_arn or not record.get(DATA_SYNC_TASK_ARN):
        return execution_arn
    task_arn = record[DATA_SYNC_TASK_ARN]
    executions = []
    paginator = datasync.get_paginator("list_task_executions")
    for page in paginator.paginate(TaskArn=task_arn):
        executions.extend(page.get("TaskExecutions") or [])
    if not executions:
        return None
    if len(executions) == 1:
        execution_arn = executions[0].get("TaskExecutionArn")
    else:
        context = _context_from_record(record)
        log.warning(
            f"DataSync task has {len(executions)} executions; selecting the latest StartTime {context}"
        )
        best_arn = None
        best_start = None
        for entry in executions:
            candidate = entry.get("TaskExecutionArn")
            if not candidate:
                continue
            described = datasync.describe_task_execution(TaskExecutionArn=candidate)
            start_time = described.get("StartTime")
            if best_arn is None or (start_time is not None and (best_start is None or start_time > best_start)):
                best_arn = candidate
                best_start = start_time
        execution_arn = best_arn
    if execution_arn:
        record[DATA_SYNC_TASK_EXECUTION_ARN] = execution_arn
        _track(log, mongo_dao.update_data_sync, record.get(ID), {DATA_SYNC_TASK_EXECUTION_ARN: execution_arn})
    return execution_arn

def _past_start_grace(record, now):
    """True when startTime is at least the grace period before now.

    Used when no task ARN exists yet (insert-only stalls / never-created task).

    @param record dataSync document
    @param now current datetime
    @returns True when the grace has elapsed
    """
    start_time = record.get(DATA_SYNC_START_TIME)
    if not start_time:
        return False
    return now - start_time >= timedelta(seconds=DATA_SYNC_START_GRACE_SECONDS)

def _past_execution_start_grace(record, now):
    """True when the grace for observing a task execution has elapsed.

    When a task ARN exists, grace is measured from taskArnRecordedAt (fallback startTime
    for legacy rows). When no task ARN exists, grace is measured from startTime.

    @param record dataSync document
    @param now current datetime
    @returns True when the applicable grace has elapsed
    """
    if record.get(DATA_SYNC_TASK_ARN):
        clock = record.get(DATA_SYNC_TASK_ARN_RECORDED_AT) or record.get(DATA_SYNC_START_TIME)
        if not clock:
            return False
        return now - clock >= timedelta(seconds=DATA_SYNC_START_GRACE_SECONDS)
    return _past_start_grace(record, now)

def _claim_data_sync_poll(mongo_dao, log, record, now):
    """Claim this record for AWS polling when no other container polled it recently.

    @param mongo_dao MongoDao instance
    @param log logger
    @param record dataSync document, updated in place when claimed
    @param now current datetime
    @returns True when this container should poll AWS for the record
    """
    claim_before = now - timedelta(seconds=DATA_SYNC_POLL_CLAIM_SECONDS)
    outcome = _track(
        log, mongo_dao.update_data_sync, record.get(ID),
        {DATA_SYNC_LAST_POLLED_AT: now},
        match_fields={
            STATUS: DATA_SYNC_STATUS_IN_PROGRESS,
            "$or": [
                {DATA_SYNC_LAST_POLLED_AT: {"$exists": False}},
                {DATA_SYNC_LAST_POLLED_AT: {"$lt": claim_before}},
            ],
        },
    )
    if outcome == DATA_SYNC_WRITE_APPLIED:
        record[DATA_SYNC_LAST_POLLED_AT] = now
        return True
    return False

def _finalize_stale_record(mongo_dao, log, record, now, last_error):
    """Mark a record Stale with no automatic cleanup and log ARNs for manual cleanup.

    Uses absence ARN match_fields so a snapshot without a task ARN cannot Stale a live transfer
    after the starter recorded one.

    @param mongo_dao MongoDao instance
    @param log logger
    @param record dataSync document
    @param now current datetime
    @param last_error diagnostic stored on the record
    @returns True when the record was finalized
    """
    context = _context_from_record(record)
    finalized = _finalize_data_sync_record(
        mongo_dao, log, record, DATA_SYNC_STATUS_STALE, now, last_error, False,
        match_fields=_absence_terminal_match_fields(record),
    )
    if finalized:
        log.error(f"{DATA_SYNC_LOG_STALE} manual cleanup needed {context}")
    return finalized

def _monitor_in_progress_data_sync(datasync, mongo_dao, log, record):
    """Poll one In Progress record and finalize it only on a confirmed AWS result.

    Skips the AWS calls when another container polled the record within DATA_SYNC_POLL_CLAIM_SECONDS.
    Records with no task ARN past insert grace, or whose task/execution AWS reports as not found
    after the applicable grace, are finalized as Stale for manual cleanup. A task ARN with no
    observed execution past taskArnRecordedAt grace is finalized Failed as not-started.
    Not-found paths use task-aware grace (taskArnRecordedAt when a task ARN exists).

    @param datasync boto3 DataSync client
    @param mongo_dao MongoDao instance
    @param log logger
    @param record dataSync document
    """
    now = current_datetime()
    context = _context_from_record(record)
    if not _claim_data_sync_poll(mongo_dao, log, record, now):
        return
    try:
        execution_arn = _resolve_task_execution_arn(datasync, mongo_dao, log, record)
    except ClientError as ce:
        if _client_error_not_found(ce):
            if not _past_execution_start_grace(record, now):
                _record_observation_error(mongo_dao, log, record, ce.response["Error"]["Message"])
                return
            _finalize_stale_record(mongo_dao, log, record, now, DATA_SYNC_LAST_ERROR_STALE_NOT_FOUND)
            return
        _record_observation_error(mongo_dao, log, record, ce.response["Error"]["Message"])
        return
    except Exception as e:
        _record_observation_error(mongo_dao, log, record, get_exception_msg())
        log.exception(e)
        return
    if not execution_arn:
        if not _past_execution_start_grace(record, now):
            return
        if record.get(DATA_SYNC_TASK_ARN):
            log.error(f"{DATA_SYNC_LOG_TRANSFER_FAILED} {DATA_SYNC_LAST_ERROR_NOT_STARTED} {context}")
            _finalize_data_sync_record(
                mongo_dao, log, record, DATA_SYNC_STATUS_FAILED, now, DATA_SYNC_LAST_ERROR_NOT_STARTED, True,
                match_fields=_absence_terminal_match_fields(record),
            )
            return
        _finalize_stale_record(mongo_dao, log, record, now, DATA_SYNC_LAST_ERROR_STALE_NO_TASK)
        return
    try:
        response = datasync.describe_task_execution(TaskExecutionArn=execution_arn)
    except ClientError as ce:
        if _client_error_not_found(ce):
            if not _past_execution_start_grace(record, now):
                _record_observation_error(mongo_dao, log, record, ce.response["Error"]["Message"])
                return
            _finalize_stale_record(mongo_dao, log, record, now, DATA_SYNC_LAST_ERROR_STALE_NOT_FOUND)
            return
        _record_observation_error(mongo_dao, log, record, ce.response["Error"]["Message"])
        return
    except Exception as e:
        log.exception(e)
        _record_observation_error(mongo_dao, log, record, get_exception_msg())
        return
    aws_status = response.get("Status")
    if aws_status == "SUCCESS":
        log.info(f"DataSync execution succeeded {context}")
        _finalize_data_sync_record(mongo_dao, log, record, DATA_SYNC_STATUS_SUCCEEDED, now, None, True)
        return
    if aws_status == "ERROR":
        detail = _execution_error_detail(response) or "ERROR"
        log.error(f"{DATA_SYNC_LOG_EXECUTION_FAILED} {detail} {context}")
        _finalize_data_sync_record(mongo_dao, log, record, DATA_SYNC_STATUS_FAILED, now, detail, True)
        return
    if record.get(DATA_SYNC_OBSERVATION_ERROR_SINCE) or record.get(DATA_SYNC_LAST_ERROR):
        _track(
            log, mongo_dao.update_data_sync, record.get(ID),
            unset_fields=[DATA_SYNC_OBSERVATION_ERROR_SINCE, DATA_SYNC_LAST_ERROR],
        )
        record.pop(DATA_SYNC_OBSERVATION_ERROR_SINCE, None)
        record.pop(DATA_SYNC_LAST_ERROR, None)
    log.info(f"DataSync execution {aws_status} {context}")

def _record_still_unfinished(record):
    """True when a record still needs monitoring after this pass processed it.

    @param record dataSync document, possibly updated in place during the pass
    @returns True when listPending, rollupPending, In Progress, or cleanupAfter remains
    """
    if record.get(DATA_SYNC_LIST_PENDING) or record.get(DATA_SYNC_ROLLUP_PENDING):
        return True
    if record.get(STATUS) == DATA_SYNC_STATUS_IN_PROGRESS:
        return True
    if record.get(DATA_SYNC_CLEANUP_AFTER) is not None:
        return True
    return False

def _monitor_data_sync(datasync, mongo_dao, log, record):
    """Advance one dataSync record: list add, then AWS result, then submission status, then cleanup.

    Cleanup runs only after the tracking writes have been applied, cleanupAfter is due,
    and a fresh read shows the stored status is Succeeded or Failed.
    A STALE list add when the dataSync row is already terminal skips recreating the list entry.
    A STALE list add when the submission is gone clears the pending flags so cleanup can still run.
    A STALE list add whose dataSync reread is missing or failed is deferred without clearing flags.

    @param datasync boto3 DataSync client
    @param mongo_dao MongoDao instance
    @param log logger
    @param record dataSync document
    """
    context = _context_from_record(record)
    if record.get(DATA_SYNC_LIST_PENDING):
        added = _track(
            log, mongo_dao.add_active_submission_data_sync,
            record.get(SUBMISSION_ID), record.get(TYPE), record.get(ID),
        )
        if added == DATA_SYNC_WRITE_STALE:
            stored = mongo_dao.find_data_sync_by_id(record.get(ID))
            if stored is None:
                log.error(
                    f"{DATA_SYNC_LOG_TRACKING_FAILED} STALE list add; dataSync reread missing "
                    f"or failed {context}"
                )
                _defer_cleanup(log, context)
                return
            if stored.get(STATUS) != DATA_SYNC_STATUS_IN_PROGRESS:
                # Late add after finalize: do not recreate the finished list entry.
                record[STATUS] = stored.get(STATUS)
                record[DATA_SYNC_LIST_PENDING] = stored.get(DATA_SYNC_LIST_PENDING, False)
                record[DATA_SYNC_ROLLUP_PENDING] = stored.get(DATA_SYNC_ROLLUP_PENDING, False)
                if DATA_SYNC_CLEANUP_AFTER in stored:
                    record[DATA_SYNC_CLEANUP_AFTER] = stored[DATA_SYNC_CLEANUP_AFTER]
                if DATA_SYNC_END_TIME in stored:
                    record[DATA_SYNC_END_TIME] = stored[DATA_SYNC_END_TIME]
                if record.get(DATA_SYNC_LIST_PENDING):
                    cleared = _track(
                        log, mongo_dao.update_data_sync, record.get(ID), {DATA_SYNC_LIST_PENDING: False},
                    )
                    if cleared == DATA_SYNC_WRITE_APPLIED:
                        record[DATA_SYNC_LIST_PENDING] = False
                    else:
                        log.error(
                            f"{DATA_SYNC_LOG_TRACKING_FAILED} clear listPending outcome={cleared} {context}"
                        )
                        _defer_cleanup(log, context)
                        return
            elif _clear_submission_gone_flags(mongo_dao, log, record.get(ID), context):
                record[DATA_SYNC_LIST_PENDING] = False
                record[DATA_SYNC_ROLLUP_PENDING] = False
            else:
                _defer_cleanup(log, context)
                return
        elif added != DATA_SYNC_WRITE_APPLIED:
            log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} add outcome={added} {context}")
            _defer_cleanup(log, context)
            return
        else:
            cleared = _track(log, mongo_dao.update_data_sync, record.get(ID), {DATA_SYNC_LIST_PENDING: False})
            if cleared != DATA_SYNC_WRITE_APPLIED:
                log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} clear listPending outcome={cleared} {context}")
                _defer_cleanup(log, context)
                return
            record[DATA_SYNC_LIST_PENDING] = False
    if record.get(STATUS) == DATA_SYNC_STATUS_IN_PROGRESS:
        _monitor_in_progress_data_sync(datasync, mongo_dao, log, record)
    _finish_record_submission(mongo_dao, log, record)
    now = current_datetime()
    if _cleanup_due(record, now):
        claim = _track(
            log, mongo_dao.update_data_sync, record.get(ID),
            {DATA_SYNC_CLEANUP_STARTED_AT: now},
            match_fields={
                STATUS: {"$in": [DATA_SYNC_STATUS_SUCCEEDED, DATA_SYNC_STATUS_FAILED]},
                DATA_SYNC_CLEANUP_AFTER: {"$lte": now},
                DATA_SYNC_LIST_PENDING: {"$ne": True},
                DATA_SYNC_ROLLUP_PENDING: {"$ne": True},
                DATA_SYNC_CLEANED_AT: {"$exists": False},
            },
        )
        if claim != DATA_SYNC_WRITE_APPLIED:
            log.info(f"DataSync cleanup claim stale {context}")
            return
        record[DATA_SYNC_CLEANUP_STARTED_AT] = now
        stored = mongo_dao.find_data_sync_by_id(record.get(ID))
        stored_status = stored.get(STATUS) if stored else None
        if stored_status not in (DATA_SYNC_STATUS_SUCCEEDED, DATA_SYNC_STATUS_FAILED):
            log.error(
                f"{DATA_SYNC_LOG_CLEANUP_FAILED} skipped delete; stored status is "
                f"{stored_status or 'missing'} {context}"
            )
            return
        deleted_ok, delete_error = _delete_data_sync_resources(datasync, log, record)
        if deleted_ok:
            cleared = _track(
                log, mongo_dao.update_data_sync, record.get(ID),
                {DATA_SYNC_CLEANED_AT: now},
                unset_fields=[DATA_SYNC_CLEANUP_AFTER],
            )
            if cleared == DATA_SYNC_WRITE_APPLIED:
                record.pop(DATA_SYNC_CLEANUP_AFTER, None)
                record[DATA_SYNC_CLEANED_AT] = now
                log.info(f"DataSync cleanup done {context}")
            else:
                log.error(f"{DATA_SYNC_LOG_CLEANUP_FAILED} clear cleanupAfter outcome={cleared} {context}. Tracking is already recorded and is not affected.")
        else:
            _track(
                log, mongo_dao.update_data_sync, record.get(ID),
                {DATA_SYNC_CLEANUP_ERROR: delete_error or "delete failed"},
            )
            log.error(
                f"{DATA_SYNC_LOG_CLEANUP_FAILED} manual cleanup needed {context} "
                f"taskArn={record.get(DATA_SYNC_TASK_ARN)} "
                f"sourceLocationArn={record.get(DATA_SYNC_SOURCE_LOCATION_ARN)} "
                f"destinationLocationArn={record.get(DATA_SYNC_DEST_LOCATION_ARN)} "
                f"error={delete_error}"
            )

def _run_data_sync_monitor_pass(mongo_dao, log, datasync=None):
    """Process every unfinished dataSync record once.

    @param mongo_dao MongoDao instance
    @param log logger
    @param datasync boto3 DataSync client, or None to open one for this pass
    @returns the number of unfinished records after the pass, or None when the query fails
    """
    records = mongo_dao.find_unfinished_data_syncs()
    if records is None:
        log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} find unfinished")
        return None
    owns_client = datasync is None and len(records) > 0
    if owns_client:
        datasync = boto3.client("datasync")
    try:
        for record in records:
            try:
                _monitor_data_sync(datasync, mongo_dao, log, record)
            except Exception as e:
                log.exception(e)
                log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} monitor record {_context_from_record(record)}: {get_exception_msg()}")
    finally:
        if owns_client and datasync:
            datasync.close()
    return sum(1 for record in records if _record_still_unfinished(record))

def data_sync_monitor_loop(mongo_dao, log):
    """Poll unfinished dataSync records until the process exits.

    Starts active. Sleeps 30 seconds while unfinished work remains and 10 minutes otherwise.
    A query failure or unexpected pass exception keeps the current interval.

    @param mongo_dao MongoDao instance
    @param log logger
    """
    state = DATA_SYNC_MONITOR_STATE_ACTIVE
    while True:
        _data_sync_wake_event.clear()
        try:
            count = _run_data_sync_monitor_pass(mongo_dao, log)
        except Exception as e:
            log.exception(e)
            log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} monitor pass: {get_exception_msg()}")
            count = None
        new_state = state if count is None else _next_data_sync_monitor_state(count)
        if new_state != state:
            log.info(f"DataSync monitor: {state} -> {new_state} ({count} unfinished)")
            state = new_state
        interval = DATA_SYNC_MONITOR_ACTIVE_INTERVAL_SECONDS if state == DATA_SYNC_MONITOR_STATE_ACTIVE else DATA_SYNC_MONITOR_WAITING_INTERVAL_SECONDS
        _data_sync_wake_event.wait(interval)

def start_data_sync_monitor(mongo_dao, log):
    """Start the shared DataSync monitor thread.

    @param mongo_dao MongoDao instance
    @param log logger
    @returns the daemon thread
    """
    monitor_thread = threading.Thread(target=data_sync_monitor_loop, args=(mongo_dao, log), daemon=True)
    monitor_thread.start()
    return monitor_thread

"""
Interface for validate files via SQS
"""
def metadata_export(configs, job_queue, mongo_dao):
    export_processed = 0
    export_validator = None
    log = get_logger(TYPE_EXPORT_METADATA)
    try:
        model_store = ModelFactory(configs[MODEL_FILE_DIR], configs[TIER_CONFIG]) 
        # dump models to json files
        # dump_dict_to_json(model_store.models, f"models/data_model.json")
    except Exception as e:
        log.exception(e)
        log.exception(f'Error occurred when initialize metadata validation service: {get_exception_msg()}')
        return 1
    start_data_sync_monitor(mongo_dao, log)
    scale_in_protection_flag = False
    log.info(f'{SERVICE_TYPE_EXPORT} service started')
    while True:
        try:
            msgs = job_queue.receiveMsgs(VISIBILITY_TIMEOUT)
            if len(msgs) > 0:
                log.info(f'New message is coming: {configs[SQS_NAME]}, '
                         f'{export_processed} {SERVICE_TYPE_EXPORT} validation(s) have been processed so far')
                scale_in_protection_flag = True
                set_scale_in_protection(True)
            else:
                if scale_in_protection_flag is True:
                    scale_in_protection_flag = False
                    set_scale_in_protection(False)

            for msg in msgs:
                log.info(f'Received a job!')
                extender = None
                try:
                    data = json.loads(msg.body)
                    log.debug(data)
                    if not data.get(SQS_TYPE) in [TYPE_EXPORT_METADATA, TYPE_COMPLETE_SUB] or not data.get(SUBMISSION_ID):
                        pass
                    
                    extender = VisibilityExtender(msg, VISIBILITY_TIMEOUT)
                    submission_id = data[SUBMISSION_ID]
                    submission = mongo_dao.get_submission(submission_id)
                    if not submission:
                        log.error(f'Submission {submission_id} does not exist!')
                        continue
                    if data.get(SQS_TYPE) == TYPE_EXPORT_METADATA: 
                        export_validator = ExportMetadata(mongo_dao, submission, model_store, configs)
                        export_validator.export_data_to_file()
                        # transfer metadata to destination s3 bucket if error occurred.
                        export_validator.transfer_release_metadata()
                    elif data.get(SQS_TYPE) == TYPE_EXPORT_DCF_MANIFEST:
                        export_validator = ExportMetadata(mongo_dao, submission, model_store, configs)
                        export_validator.export_dcf_manifest_preview()
                    elif data.get(SQS_TYPE) == RESTORE_DELETED_DATA_FILES:
                        export_validator = ExportMetadata(mongo_dao, submission, model_store, configs)
                        export_validator.restore_deleted_file()
                    elif data.get(SQS_TYPE) == TYPE_COMPLETE_SUB:
                        export_validator = ExportMetadata(mongo_dao, submission, model_store, configs)
                        if export_validator.release_data():
                            if submission.get(SUBMISSION_INTENTION) != SUBMISSION_INTENTION_DELETE and (not submission.get(SUBMISSION_DATA_TYPE) 
                                or (submission[SUBMISSION_DATA_TYPE] != SUBMISSION_DATA_TYPE_METADATA_ONLY)): 
                                export_validator.transfer_released_files()
                    else:
                        pass
                    export_processed += 1
                    msg.delete()
                except Exception as e:
                    log.critical(e)
                    log.critical(
                        f'Something wrong happened while exporting data! Check debug log for details.')
                finally:
                    # De-allocation memory
                    if export_validator:
                        export_validator.close()
                        export_validator = None

                    if extender:
                        extender.stop()
        except KeyboardInterrupt:
            log.info('Good bye!')
            return

# Private class
class ExportMetadata:
    def __init__(self, mongo_dao, submission,  model_store, configs):
        self.log = get_logger(TYPE_EXPORT_METADATA)
        self.configs = configs
        self.model_store = model_store
        self.model = None
        self.mongo_dao = mongo_dao
        self.submission = submission
        self.s3_service = S3Service()
        self.intention = submission.get(SUBMISSION_INTENTION)
        self.release_manifest_data = None
        self.submission_type =  self.submission.get(SUBMISSION_DATA_TYPE)  

    def close(self):
        if self.s3_service:
            self.s3_service.close(self.log)

    def export_data_to_file(self):
        submission_id, root_path, bucket_name, datacommon, study_id = self.get_submission_info()
        if not root_path or not submission_id or not bucket_name:
            self.log(f"{submission_id}: The process of exporting metadata stopped due to incomplete data in the submission.")

        model_version = self.submission.get(MODEL_VERSION)
        #1 get data model based on datacommon and version
        self.model = self.model_store.get_model_by_data_common_version(datacommon, model_version)
        if not self.model.model or not self.model.get_nodes():
            msg = f'{submission_id}: {self.datacommon} model version "{model_version}" is not available.'
            self.log.error(msg)
            return 
        #2 archive existing release if exists
        try:
            self.s3_service.archive_s3_if_exists(bucket_name, ValidationDirectory.get_release(root_path), ValidationDirectory.get_archive(root_path))
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f'{submission_id}: Failed to archive existed release: {get_exception_msg()}.')
            return

        node_types = self.model.get_node_keys()
        study = self.mongo_dao.find_study_by_id(study_id)
        if study:
            study = {"name": study.get("studyName"), "abbreviation": study.get("studyAbbreviation"), "dbGaPID": study.get("dbGaPID")}
        submitter = self.mongo_dao.find_user_by_id(self.submission.get("submitterID"))
        if submitter:
            submitter = {"name": submitter.get("firstName") + " " + submitter.get("lastName"), "email": submitter.get("email"), "institution": submitter.get("institution", {}).get("name")}                                      
        self.release_manifest_data = {"submission ID": submission_id, "submission creation date": convert_date_time(self.submission.get(CREATED_AT), "%Y-%m-%d %H:%M:%S"), 
                                      "submission release date": get_date_time("%Y-%m-%d %H:%M:%S"), "study": study, "submitter": submitter,
                                      "data concierge": self._resolve_concierge(),
                                      "data model version": self.submission.get("modelVersion"), "intention": self.submission.get(SUBMISSION_INTENTION),
                                      "submission type": self.submission_type,
                                      "metadata files": {"number of metadata files": 0, "metadata files": []},
                                      "metadata record counts": {}
                                      }
        if self.submission_type != SUBMISSION_DATA_TYPE_METADATA_ONLY:
            self.release_manifest_data["data files"] = {"count": 0, "total size": 0}
            self.release_manifest_data["metadata files"]["dcf manifest file path"] = ""


        threads = []
        #3 retrieve data for nodeType and export to s3 bucket
        for node_type in node_types:
            thread = threading.Thread(target=self.export, args=(submission_id, node_type))
            threads.append(thread)
            thread.start()
            if self.submission[SUBMISSION_INTENTION] == SUBMISSION_INTENTION_DELETE and node_type in self.model.get_file_nodes():
                thread = threading.Thread(target=self.delete_data_file, args=(submission_id, node_type))
                threads.append(thread)
                thread.start()

        for thread in threads:
            thread.join()
        
        #4 export DCF-manifest
        if self.submission_type != SUBMISSION_DATA_TYPE_METADATA_ONLY:
            DCF_manifest_exporter = GenerateDCF(self.configs, self.mongo_dao, self.submission, self.s3_service, self.release_manifest_data)
            DCF_manifest_exporter.generate_dcf()
        #5 export release manifest file as release-info.json
        self.upload_release_manifest()

    def _resolve_concierge(self):
        """Resolves the concierge information block based on available information"""
        concierge_id = self.submission.get("conciergeID")
        if not concierge_id:
            return {"name": None, "email": None}
        
        concierge = self.mongo_dao.find_user_by_id(concierge_id)
        if not concierge:
            return {"name": None, "email": None}
        
        name = " ".join(part for part in (concierge.get("firstName"), concierge.get("lastName")) if part) or None
        return {"name": name, "email": concierge.get("email")}

    def export(self, submission_id, node_type):
        start_index = 0
        rows = []
        columns = set()
        file_name = ""
        main_nodes = self.model.get_main_nodes()
        while True:
            # get nodes by submissionID and nodeType
            data_records = self.mongo_dao.get_dataRecords_chunk_by_nodeType(submission_id, node_type, start_index, BATCH_SIZE)
            if start_index == 0 and (not data_records or len(data_records) == 0):
                return
            
            if not self.release_manifest_data["metadata record counts"].get(node_type):
                self.release_manifest_data["metadata record counts"][node_type] = {"total": 0, "new": 0, "update": 0, "delete": 0}

            for r in data_records:
                # node_id = r.get(NODE_ID)
                crdc_id = r.get(CRDC_ID) if node_type in main_nodes.keys() else None
                row_list = self.convert_2_row(r, node_type, crdc_id)
                rows.extend(row_list)
                for row_dict in row_list:
                    if row_dict:
                        new_keys = set(row_dict.keys()) - columns
                        if new_keys:
                            columns.update(new_keys)
                if r.get(ORIN_FILE_NAME) != file_name:
                    #columns.update(row_list[0].keys())
                    file_name = r.get(ORIN_FILE_NAME) 
                
                # populate release manifest data    
                self.release_manifest_data["metadata record counts"][node_type]["total"] += 1
                if self.submission.get(SUBMISSION_INTENTION) == SUBMISSION_INTENTION_NEW_UPDATE:
                    # search release to check if existing, if existing, add to update, else to new
                    existed_crdc_record = self.mongo_dao.search_release(self.submission.get(DATA_COMMON_NAME), node_type, r.get(NODE_ID))
                    if existed_crdc_record:
                        self.release_manifest_data["metadata record counts"][node_type]["update"] += 1
                    else:
                        self.release_manifest_data["metadata record counts"][node_type]["new"] += 1
                else:
                    self.release_manifest_data["metadata record counts"][node_type]["delete"] += 1
                if self.submission_type != SUBMISSION_DATA_TYPE_METADATA_ONLY and node_type in self.model.get_file_nodes() and r.get(S3_FILE_INFO):
                    self.release_manifest_data["data files"]["count"] += 1
                    self.release_manifest_data["data files"]["total size"] += int(r.get(S3_FILE_INFO).get("size"))

            count = len(data_records) 
            if count < BATCH_SIZE: 
                df = None
                buf = None
                try:
                    df = pd.DataFrame(rows, columns = self.sort_columns(columns, node_type))
                    # convert python boolean to "true"/"false" in tsv
                    df = df.apply(lambda col: col.map(lambda x: "true" if (x is True or x == "True") else "false" if x is False or x == "False" else x))
                    buf = io.BytesIO()
                    df.to_csv(buf, sep ='\t', index=False)
                    buf.seek(0)
                    self.upload_file(buf, node_type)
                    # populate release manifest data
                    self.release_manifest_data["metadata files"]["metadata files"].append(f"{submission_id}-{node_type}.tsv")
                    self.release_manifest_data["metadata files"]["number of metadata files"] += 1
                    self.log.info(f"{submission_id}: {count + start_index} {node_type} nodes are exported.")
                    return
                except Exception as e:
                    self.log.exception(e)
                    self.log.exception(f'{submission_id}: Failed to export {node_type} data: {get_exception_msg()}.')
                finally:
                    if buf:
                        del buf
                        del df
                        del rows
                        del columns

            start_index += count 

    def convert_2_row(self, data_record, node_type, crdc_id):
        rows = []
        row = data_record.get(PROPERTIES)
        row[TYPE] = node_type
        if crdc_id is not None:
            row[CRDC_ID.lower()] = crdc_id
        else:
            if CRDC_ID.lower() in row.keys():
                del row[CRDC_ID.lower()]
        if data_record.get(GENERATED_PROPS):
            generatedProps = data_record[GENERATED_PROPS]
            for k, v in generatedProps.items():
                row[k] = v
        parents = data_record.get("parents", None)
        if parents: 
            parent_types = list(set([item["parentType"] for item in parents]))
            for type in parent_types:
                same_type_parents = [item for item in parents if item["parentType"] == type]
                rel_name = f'{same_type_parents[0].get("parentType")}.{same_type_parents[0].get("parentIDPropName")}'
                if len(same_type_parents) == 1:
                    row[rel_name] = same_type_parents[0].get("parentIDValue")
                else:
                    row[rel_name] = " | ".join([parent.get("parentIDValue") for parent in same_type_parents])
        rows.append(row)
        return rows
    
    def upload_file(self, buf, node_type):
        id, root_path, bucket_name,_,_ = self.get_submission_info()      
        full_name = f"{ValidationDirectory.get_release(root_path)}/{id}-{node_type}.tsv"
        self.s3_service.upload_file_to_s3(buf, bucket_name, full_name)

    def upload_release_manifest(self):
        _, root_path, bucket_name,_,_ = self.get_submission_info()
        full_name = f"{ValidationDirectory.get_release(root_path)}/release-info.json"
        if self.submission_type != SUBMISSION_DATA_TYPE_METADATA_ONLY:
            self.release_manifest_data["data files"]["total size"] = convert_file_size(self.release_manifest_data["data files"]["total size"])
        buf = io.BytesIO(json.dumps(self.release_manifest_data, indent=4).encode('utf-8'))
        self.s3_service.upload_file_to_s3(buf, bucket_name, full_name)
        buf.close()


    def delete_data_file(self, submission_id, node_type):
        start_index = 0
        file_list = []
        while True:
            # get nodes by submissionID and nodeType
            data_records = self.mongo_dao.get_dataRecords_chunk_by_nodeType(submission_id, node_type, start_index, BATCH_SIZE)
            if start_index == 0 and (not data_records or len(data_records) == 0):
                return
            
            for r in data_records:
                s3FileInfo = r.get(S3_FILE_INFO)
                if s3FileInfo:
                    s3_file_name = s3FileInfo.get(FILE_NAME)
                    if s3_file_name:
                        file_list.append(s3_file_name)

            count = len(data_records) 
            if count < BATCH_SIZE: 
                try:
                    self.move_s3_objects(file_list)
                except Exception as e:
                    self.log.exception(e)
                    self.log.exception(f'{submission_id}: Failed to delete {node_type} file: {get_exception_msg()}.')
                return

            start_index += count 

    def release_data(self):
        submission_id = self.submission[ID]
        datacommon = self.submission.get(DATA_COMMON_NAME)
        model_version = self.submission.get(MODEL_VERSION)
        #1 get data model based on datacommon and version
        self.model = self.model_store.get_model_by_data_common_version(datacommon, model_version)
        if not self.model.model or not self.model.get_nodes():
            msg = f'{submission_id}: {self.datacommon} model version "{model_version}" is not available.'
            self.log.error(msg)
            return False
        
        node_types = self.model.get_node_keys()
        try:
            #2 retrieve data for nodeType and save data to release collection
            for node_type in list(node_types)[::-1]:
                self.save_releases(submission_id, node_type)
            return True
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f'{submission_id}: Failed to release data: {get_exception_msg()}.')
            return False

    def save_releases(self, submission_id, node_type):
        start_index = 0
        while True:
            # get nodes by submissionID and nodeType
            data_records = self.mongo_dao.get_dataRecords_chunk_by_nodeType(submission_id, node_type, start_index, BATCH_SIZE)
            if start_index == 0 and (not data_records or len(data_records) == 0):
                return
            for r in data_records:
                node_id = r.get(NODE_ID)
                crdc_id = r.get(CRDC_ID)
                self.save_release(r, node_type, node_id, crdc_id)
                if self.submission[SUBMISSION_INTENTION] == SUBMISSION_INTENTION_DELETE and node_type in self.model.get_file_nodes():
                    self.add_tag_on_deleted_file(r.get(S3_FILE_INFO))
            count = len(data_records) 
            if count < BATCH_SIZE: 
                self.log.info(f"{submission_id}: {count + start_index} {node_type} nodes are {'released' if self.intention != SUBMISSION_INTENTION_DELETE else 'deleted'}.")
                return

            start_index += count 

    def get_properties(self, data_record, existed_crdc_record = None):
        update_props = {}
        data_record_props = data_record.get(PROPERTIES)
        if existed_crdc_record:
            existed_crdc_record_props = existed_crdc_record.get(PROPERTIES)
            if data_record_props is not None and existed_crdc_record_props is not None:
                for prop, value in data_record_props.items():
                    str_value = str(value).lower().strip()
                    if not value or str_value == "":
                        if prop in existed_crdc_record_props.keys():
                            #if the existed record has the property, otherwise skip the property
                            update_props[prop] = existed_crdc_record_props[prop]
                    elif str_value == DELETE_COMMAND:
                        update_props[prop] = None
                    else:
                        update_props[prop] = value
                return update_props
            else:
                update_props = data_record_props
                return update_props
        else:
            for prop, value in data_record_props.items():
                str_value = str(value).lower().strip()
                if str_value == DELETE_COMMAND:
                    update_props[prop] = None
                else:
                    update_props[prop] = value
            return update_props

    def save_release(self, data_record, node_type, node_id, crdc_id):
        if not node_type or not node_id: 
             self.log.error(f"{self.submission[ID]}: Invalid data to export: {node_type}/{node_id}/{crdc_id}!")
             return
        existed_crdc_record = self.mongo_dao.search_release(self.submission.get(DATA_COMMON_NAME), node_type, node_id)
        current_date = current_datetime()
        if not existed_crdc_record:
            if self.submission.get(SUBMISSION_INTENTION) == SUBMISSION_INTENTION_DELETE:
                self.log.error(f"{self.submission[ID]}: No data found for delete: {self.submission.get(DATA_COMMON_NAME)}/{node_type}/{node_id}/{crdc_id}!")
                return
            # create new crdc_record
            crdc_record = {
                ID: get_uuid_str(),
                CRDC_ID: crdc_id,
                SUBMISSION_ID: self.submission[ID],
                SUBMISSION_REL_STATUS: SUBMISSION_REL_STATUS_RELEASED, 
                DATA_COMMON_NAME: self.submission.get(DATA_COMMON_NAME),
                NODE_TYPE: node_type,
                NODE_ID: node_id,
                PROPERTIES: self.get_properties(data_record, None),
                PARENTS: data_record.get(PARENTS, None),
                CREATED_AT: current_date,
                ENTITY_TYPE: data_record.get(ENTITY_TYPE),
                SUBMISSION_HISTORY: [{SUBMISSION_ID: self.submission[ID],
                             SUBMISSION_INTENTION: self.submission.get(SUBMISSION_INTENTION),
                             RELEASE_AT: current_date,
                             PROPERTIES: data_record.get(PROPERTIES),
                             PARENTS: data_record.get(PARENTS, None)
                             }], 
                STUDY_ID: data_record.get(STUDY_ID) or self.submission.get(STUDY_ID),
                GENERATED_PROPS: data_record.get(GENERATED_PROPS, None)
            }
            if self.submission_type != SUBMISSION_DATA_TYPE_METADATA_ONLY and data_record.get(S3_FILE_INFO) and data_record.get(S3_FILE_INFO).get(FILE_NAME):
                crdc_record[DATA_FILE_LOCATION] = self.get_file_url(data_record.get(S3_FILE_INFO))

            result = self.mongo_dao.insert_release(crdc_record)
            if not result:
                self.log.error(f"{self.submission[ID]}: Failed to insert release for {node_type}/{node_id}/{crdc_id}!")
        else: 
            existed_crdc_record[UPDATED_AT] = current_date
            if self.intention == SUBMISSION_INTENTION_DELETE:
                existed_crdc_record[SUBMISSION_REL_STATUS] = SUBMISSION_REL_STATUS_DELETED
            else: 
                history = existed_crdc_record.get(SUBMISSION_HISTORY)
                # if the existing release has no history, need add current one to the history list before updating
                if not history or len(history) == 0:
                    # make a copy before updating
                    copy = existed_crdc_record.copy()
                    history = [{
                        SUBMISSION_ID: copy[SUBMISSION_ID],
                        SUBMISSION_INTENTION: copy.get(SUBMISSION_INTENTION, SUBMISSION_INTENTION_NEW_UPDATE),
                        RELEASE_AT: copy.get(UPDATED_AT),
                        PROPERTIES: copy.get(PROPERTIES),
                        PARENTS: copy.get(PARENTS)
                    }]
                # updating existing release with new values
                existed_crdc_record[SUBMISSION_ID] = self.submission[ID]
                existed_crdc_record[PROPERTIES] = self.get_properties(data_record, existed_crdc_record)
                existed_crdc_record[PARENTS] = self.combine_parents(node_type, existed_crdc_record[PARENTS], data_record.get(PARENTS))
                existed_crdc_record[SUBMISSION_REL_STATUS] = SUBMISSION_REL_STATUS_RELEASED
                history.append({
                    SUBMISSION_ID: self.submission[ID],
                    SUBMISSION_INTENTION: self.submission.get(SUBMISSION_INTENTION),
                    RELEASE_AT: current_date,
                    PROPERTIES: data_record.get(PROPERTIES),
                    PARENTS: existed_crdc_record[PARENTS]
                })
                existed_crdc_record[SUBMISSION_HISTORY] = history
                existed_crdc_record[ENTITY_TYPE] = data_record.get(ENTITY_TYPE)
                existed_crdc_record[STUDY_ID] = data_record.get(STUDY_ID) or self.submission.get(STUDY_ID)
                existed_crdc_record[GENERATED_PROPS] = data_record.get(GENERATED_PROPS, None)
                if self.submission_type != SUBMISSION_DATA_TYPE_METADATA_ONLY and data_record.get(S3_FILE_INFO) and data_record.get(S3_FILE_INFO).get(FILE_NAME):
                    existed_crdc_record[DATA_FILE_LOCATION] = self.get_file_url(data_record.get(S3_FILE_INFO))

            result = self.mongo_dao.update_release(existed_crdc_record)
            if not result:
                self.log.error(f"{self.submission[ID]}: Failed to update release for {node_type}/{node_id}/{crdc_id}!")
                return
            # process released children and set release status to "Deleted"
            if self.intention == SUBMISSION_INTENTION_DELETE:
                result, children = self.mongo_dao.get_released_nodes_by_parent_with_status(self.submission[DATA_COMMON_NAME], existed_crdc_record, [SUBMISSION_REL_STATUS_RELEASED, None], self.submission[ID])
                if result and children and len(children) > 0: 
                    self.delete_release_children(children)

    def get_file_url(self, s3_file_info):
        if not s3_file_info or not s3_file_info.get(FILE_NAME):
            return None
        _, _, _, _, study_id = self.get_submission_info()
        dest_bucket_name = self.configs.get(DM_BUCKET_CONFIG_NAME)
        dest_file_folder =  study_id
        file_name = s3_file_info.get(FILE_NAME)
        url = os.path.join(dest_bucket_name, dest_file_folder, file_name)
        url = "s3://" + url
        return url
    
    def combine_parents(self, node_type, release_parents, node_parents):
        if not release_parents or len(release_parents) == 0:
            return node_parents
        if not node_parents or len(node_parents) == 0:
            return release_parents
        relationships = self.model.get_node_relationships(node_type)
        if node_parents and len(node_parents):
            for parent in node_parents:
                relationship = relationships[parent["parentType"]]
                if not dict_exists_in_list(release_parents, parent, keys=["parentType", "parentIDPropName", "parentIDValue"]):
                    if relationship["type"] == "many_to_many":
                        release_parents.append(parent)
                    else:
                        rel_parent_list = [p for p in release_parents if p["parentType"] == relationship["dest_node"]]
                        if not rel_parent_list or len(rel_parent_list) == 0:
                            release_parents.append(parent)
                        else:
                            rel_parent_list[0]["parentIDValue"] = parent["parentIDValue"]
        return release_parents
    
    def delete_release_children(self, released_children):
        if released_children and len(released_children) > 0:
            for child in released_children:
                child[UPDATED_AT] = current_datetime()
                child[SUBMISSION_REL_STATUS] = SUBMISSION_REL_STATUS_DELETED
                result = self.mongo_dao.update_release(child)
                if not result:
                    self.log.error(f"{self.submission[ID]}: Failed to update release for {child.get(NODE_TYPE)}/{child.get(NODE_ID)}/{child.get(CRDC_ID)}!")
                    return
                # process released children and set release status to "Deleted"
                result, descendent = self.mongo_dao.get_released_nodes_by_parent_with_status(self.submission[DATA_COMMON_NAME], child, [SUBMISSION_REL_STATUS_RELEASED, None], self.submission[ID])
                if result and descendent and len(descendent) > 0: 
                    self.delete_release_children(descendent)
        return
        
    def get_submission_info(self):
        return [self.submission.get(ID), self.submission.get(EXPORT_ROOT_PATH), self.submission.get(BATCH_BUCKET), 
                self.submission.get(DATA_COMMON_NAME), self.submission.get(STUDY_ID)]
    
    def sort_columns(self, cols, node_type):
        columns = sorted(cols)
        old_index = columns.index(TYPE)
        columns.insert(0, columns.pop(old_index))
        old_index = columns.index(self.model.get_node_id(node_type))
        columns.insert(1, columns.pop(old_index))
        return columns
    
    def export_dcf_manifest_preview(self):
        submission_id = self.submission.get(ID)
        submission_type = self.submission.get(SUBMISSION_DATA_TYPE)
        if submission_type == SUBMISSION_DATA_TYPE_METADATA_ONLY:
            self.log.info(f'{submission_id}: Skipping DCF manifest preview for metadata-only submission.')
            return
        dcf_exporter = GenerateDCF(self.configs, self.mongo_dao, self.submission, self.s3_service, None)
        dcf_exporter.generate_dcf_preview()

    def transfer_release_metadata(self):
        """
        transfer released data to cds cbiit metadata bucket by aws datasync
        """
        id, root_path, bucket_name, dataCommon, _ = self.get_submission_info()
        dest_bucket_name = self.mongo_dao.get_bucket_name("Metadata Bucket", dataCommon)
        dest_file_folder =  f'{get_date_time("%Y-%m-%dT%H:%M:%S")}-{id}'
        data_file_folder = os.path.join(root_path, "metadata/release")
        tags = [
            {"Key": "Tier", "Value": self.configs[TIER_CONFIG]},
            {"Key": "Type", "Value" : "Metadata"}
            ]
        self.transfer_s3_obj(bucket_name, data_file_folder, dest_bucket_name, dest_file_folder, tags, sync_type=DATA_SYNC_TYPE_METADATA)
    
    def transfer_released_files(self):
        """
        transfer released files includes data files and metadata files to data manage bucket by aws datasync
        """
        _, root_path, bucket_name, _, study_id = self.get_submission_info()
        dest_bucket_name = self.configs.get(DM_BUCKET_CONFIG_NAME)
        dest_file_folder =  study_id
        data_file_folder = os.path.join(root_path, "file")
        tags = [
            {"Key": "Tier", "Value": self.configs[TIER_CONFIG]}, 
            {"Key": "Type", "Value" : "Data File"}
            ]
        self.transfer_s3_obj(bucket_name, data_file_folder, dest_bucket_name, dest_file_folder, tags, sync_type=DATA_SYNC_TYPE_FILE)

    def _new_data_sync_tracking(self, sync_type, source_folder, target_folder):
        """Build the in-memory tracking state for one transfer. The record is not inserted yet.

        @param sync_type DataSync type, "metadata" or "file"
        @param source_folder source S3 prefix
        @param target_folder destination S3 prefix
        @returns tracking state dict
        """
        return {
            "submission_id": self.submission[ID],
            "sync_type": sync_type,
            "data_sync_id": get_uuid_str(),
            "source_folder": source_folder,
            "target_folder": target_folder,
            "start_time": current_datetime(),
            "status": DATA_SYNC_STATUS_IN_PROGRESS,
            "inserted": False,
            "list_added": False,
            "persist_stopped": False,
            "task_arn": None,
            "task_execution_arn": None,
            "source_location_arn": None,
            "destination_location_arn": None,
            "task_arn_recorded_at": None,
            "end_time": None,
            "last_error": None,
            "rollup_pending": False,
        }

    def _tracking_context(self, tracking):
        """Log context for a transfer's tracking state.

        @param tracking tracking state dict
        @returns log context string
        """
        return _data_sync_context(
            tracking.get("submission_id"), tracking.get("sync_type"), tracking.get("data_sync_id"),
            tracking.get("task_arn"), tracking.get("task_execution_arn"),
            tracking.get("source_location_arn"), tracking.get("destination_location_arn"),
        )

    def _record_data_sync_start(self, tracking):
        """Insert the dataSync record and add it to the submission's in-flight list.

        A failure is remembered on the tracking state and never raised. The AWS transfer still runs.
        Tracking writes are retried by _track before returning.

        @param tracking tracking state dict
        """
        outcome = _track(
            self.log, self.mongo_dao.insert_data_sync,
            tracking["submission_id"], tracking["sync_type"], tracking["source_folder"], tracking["target_folder"],
            tracking["status"], tracking["data_sync_id"], tracking["start_time"],
        )
        if outcome != DATA_SYNC_WRITE_APPLIED:
            self.log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} insert outcome={outcome} {self._tracking_context(tracking)}")
            return
        tracking["inserted"] = True
        notify_data_sync_started()
        added = _track(
            self.log, self.mongo_dao.add_active_submission_data_sync,
            tracking["submission_id"], tracking["sync_type"], tracking["data_sync_id"],
        )
        if added != DATA_SYNC_WRITE_APPLIED:
            self.log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} add outcome={added} {self._tracking_context(tracking)}")
            return
        cleared = _track(
            self.log, self.mongo_dao.update_data_sync,
            tracking["data_sync_id"], {DATA_SYNC_LIST_PENDING: False},
        )
        if cleared == DATA_SYNC_WRITE_APPLIED:
            tracking["list_added"] = True
            return
        self.log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} clear listPending outcome={cleared} {self._tracking_context(tracking)}")

    def _tracking_arn_fields(self, tracking):
        """Build $set fields for every non-null ARN accumulated on the tracking state.

        Later writes re-persist earlier ARNs so a failed source-location write can be repaired
        by a subsequent successful field save or the start-failure update.

        @param tracking tracking state dict
        @returns dict of dataSync field names to values
        """
        fields = {}
        if tracking.get("source_location_arn"):
            fields[DATA_SYNC_SOURCE_LOCATION_ARN] = tracking["source_location_arn"]
        if tracking.get("destination_location_arn"):
            fields[DATA_SYNC_DEST_LOCATION_ARN] = tracking["destination_location_arn"]
        if tracking.get("task_arn"):
            fields[DATA_SYNC_TASK_ARN] = tracking["task_arn"]
        if tracking.get("task_execution_arn"):
            fields[DATA_SYNC_TASK_EXECUTION_ARN] = tracking["task_execution_arn"]
        if tracking.get("task_arn_recorded_at"):
            fields[DATA_SYNC_TASK_ARN_RECORDED_AT] = tracking["task_arn_recorded_at"]
        return fields

    def _save_data_sync_field(self, tracking, field, value, state_key):
        """Remember an ARN and write all known ARNs to the dataSync record when the record exists.

        Updates match status In Progress so a monitor-finalized record is not overwritten.
        The first taskArn write also sets taskArnRecordedAt once for execution-start grace.
        Each save persists every accumulated ARN so earlier write failures can be repaired.

        @param tracking tracking state dict
        @param field dataSync document field name
        @param value field value
        @param state_key key on the tracking state
        """
        tracking[state_key] = value
        if field == DATA_SYNC_TASK_ARN and not tracking.get("task_arn_recorded_at"):
            tracking["task_arn_recorded_at"] = current_datetime()
        if not tracking["inserted"] or tracking.get("persist_stopped"):
            return
        set_fields = self._tracking_arn_fields(tracking)
        outcome = _track(
            self.log, self.mongo_dao.update_data_sync, tracking["data_sync_id"], set_fields,
            match_fields={STATUS: DATA_SYNC_STATUS_IN_PROGRESS},
        )
        if outcome == DATA_SYNC_WRITE_APPLIED:
            return
        if outcome == DATA_SYNC_WRITE_STALE:
            tracking["persist_stopped"] = True
            self.log.info(
                f"DataSync already finalized; skipping further starter writes "
                f"{self._tracking_context(tracking)}"
            )
            return
        self.log.error(
            f"{DATA_SYNC_LOG_TRACKING_FAILED} {field} outcome={outcome} {self._tracking_context(tracking)}"
        )

    def _mark_data_sync_start_failed(self, tracking, step, message):
        """Record that the AWS transfer failed before a confirmed start. Does not delete anything.

        When the record was inserted and any AWS ARNs exist, schedules deferred cleanup and
        persists all accumulated ARNs. Matches status In Progress so a concurrent monitor
        finalization is not overwritten. Logs known ARNs for manual cleanup when the record
        was never inserted or the Failed write fails.

        @param tracking tracking state dict
        @param step AWS call that failed
        @param message AWS or exception message
        """
        end_time = current_datetime()
        last_error = f"{step}: {message}"
        tracking["status"] = DATA_SYNC_STATUS_FAILED
        tracking["end_time"] = end_time
        tracking["last_error"] = last_error
        tracking["rollup_pending"] = True
        context = self._tracking_context(tracking)
        self.log.error(f"{DATA_SYNC_LOG_TRANSFER_FAILED} {step} {message} {context}")
        if not tracking["inserted"] or tracking.get("persist_stopped"):
            if not tracking["inserted"] and (
                tracking.get("task_arn")
                or tracking.get("source_location_arn")
                or tracking.get("destination_location_arn")
            ):
                self.log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} untracked transfer {context}")
            return
        fields = {
            STATUS: DATA_SYNC_STATUS_FAILED,
            DATA_SYNC_END_TIME: end_time,
            DATA_SYNC_ROLLUP_PENDING: True,
            DATA_SYNC_LAST_ERROR: last_error,
            **self._tracking_arn_fields(tracking),
        }
        if tracking.get("task_arn") or tracking.get("source_location_arn") or tracking.get("destination_location_arn"):
            fields[DATA_SYNC_CLEANUP_AFTER] = end_time + timedelta(seconds=DATA_SYNC_CLEANUP_DELAY_SECONDS)
        outcome = _track(
            self.log, self.mongo_dao.update_data_sync, tracking["data_sync_id"], fields,
            match_fields={STATUS: DATA_SYNC_STATUS_IN_PROGRESS},
        )
        if outcome == DATA_SYNC_WRITE_APPLIED:
            return
        if outcome == DATA_SYNC_WRITE_STALE:
            tracking["persist_stopped"] = True
            self.log.info(f"DataSync already finalized by another monitor {context}")
            return
        self.log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} start failure outcome={outcome} {context}")

    def _handle_unconfirmed_start(self, tracking, step, message):
        """Handle an ambiguous start_task_execution outcome without marking Failed.

        Logs the ambiguity, recovers or re-persists ARNs so the monitor can resolve the
        execution, and marks Stale only when the transfer cannot be made observable.

        @param tracking tracking state dict
        @param step AWS call that failed ambiguously
        @param message AWS or exception message
        """
        context = self._tracking_context(tracking)
        self.log.error(
            f"{DATA_SYNC_LOG_TRANSFER_FAILED} {step} unconfirmed start; leaving In Progress "
            f"for monitor resolution: {message} {context}"
        )
        if tracking.get("persist_stopped"):
            return
        if not tracking.get("inserted"):
            self._recover_data_sync_tracking(tracking)
            if not tracking.get("inserted"):
                return
        set_fields = self._tracking_arn_fields(tracking)
        if not set_fields:
            self._mark_unconfirmed_start_stale(tracking, "unconfirmed start: no ARNs to persist")
            return
        outcome = _track(
            self.log, self.mongo_dao.update_data_sync, tracking["data_sync_id"], set_fields,
            match_fields={STATUS: DATA_SYNC_STATUS_IN_PROGRESS},
        )
        if outcome == DATA_SYNC_WRITE_APPLIED:
            return
        if outcome == DATA_SYNC_WRITE_STALE:
            tracking["persist_stopped"] = True
            self.log.info(f"DataSync already finalized; skipping further starter writes {context}")
            return
        self.log.error(
            f"{DATA_SYNC_LOG_TRACKING_FAILED} unconfirmed start ARN persist outcome={outcome} {context}"
        )
        self._mark_unconfirmed_start_stale(tracking, f"unconfirmed start: ARN persist failed ({outcome})")

    def _mark_unconfirmed_start_stale(self, tracking, last_error):
        """Mark an inserted record Stale when an unconfirmed start cannot stay observable.

        Uses a status-only In Progress match (no absence ARN guard) because the starter may
        be marking Stale precisely because those ARNs never landed on the document.

        @param tracking tracking state dict
        @param last_error diagnostic stored on the record
        """
        if not tracking.get("inserted") or tracking.get("persist_stopped"):
            return
        record = {
            ID: tracking["data_sync_id"],
            SUBMISSION_ID: tracking.get("submission_id"),
            TYPE: tracking.get("sync_type"),
            STATUS: DATA_SYNC_STATUS_IN_PROGRESS,
            DATA_SYNC_TASK_ARN: tracking.get("task_arn"),
            DATA_SYNC_TASK_EXECUTION_ARN: tracking.get("task_execution_arn"),
            DATA_SYNC_SOURCE_LOCATION_ARN: tracking.get("source_location_arn"),
            DATA_SYNC_DEST_LOCATION_ARN: tracking.get("destination_location_arn"),
        }
        context = self._tracking_context(tracking)
        if _finalize_data_sync_record(
            self.mongo_dao, self.log, record, DATA_SYNC_STATUS_STALE, current_datetime(), last_error, False,
        ):
            tracking["persist_stopped"] = True
            tracking["status"] = DATA_SYNC_STATUS_STALE
            self.log.error(f"{DATA_SYNC_LOG_STALE} manual cleanup needed {context}")

    def _recover_data_sync_tracking(self, tracking):
        """Insert a monitor-visible dataSync record after AWS start when the initial insert failed.

        Writes the same dataSync id with ARNs already collected in memory, then adds the id to
        the submission in-flight list and clears listPending. Duplicate-key insert counts as applied.

        @param tracking tracking state dict
        """
        if tracking.get("inserted"):
            return
        outcome = _track(
            self.log, self.mongo_dao.insert_data_sync,
            tracking["submission_id"], tracking["sync_type"], tracking["source_folder"], tracking["target_folder"],
            DATA_SYNC_STATUS_IN_PROGRESS, tracking["data_sync_id"], tracking["start_time"],
            task_arn=tracking.get("task_arn"),
            task_execution_arn=tracking.get("task_execution_arn"),
            source_location_arn=tracking.get("source_location_arn"),
            destination_location_arn=tracking.get("destination_location_arn"),
            task_arn_recorded_at=tracking.get("task_arn_recorded_at"),
        )
        if outcome != DATA_SYNC_WRITE_APPLIED:
            self.log.error(
                f"{DATA_SYNC_LOG_TRACKING_FAILED} recovery insert outcome={outcome} "
                f"{self._tracking_context(tracking)}"
            )
            return
        tracking["inserted"] = True
        notify_data_sync_started()
        added = _track(
            self.log, self.mongo_dao.add_active_submission_data_sync,
            tracking["submission_id"], tracking["sync_type"], tracking["data_sync_id"],
        )
        if added != DATA_SYNC_WRITE_APPLIED:
            self.log.error(
                f"{DATA_SYNC_LOG_TRACKING_FAILED} recovery add outcome={added} "
                f"{self._tracking_context(tracking)}"
            )
            return
        cleared = _track(
            self.log, self.mongo_dao.update_data_sync,
            tracking["data_sync_id"], {DATA_SYNC_LIST_PENDING: False},
        )
        if cleared == DATA_SYNC_WRITE_APPLIED:
            tracking["list_added"] = True
            return
        self.log.error(
            f"{DATA_SYNC_LOG_TRACKING_FAILED} recovery clear listPending outcome={cleared} "
            f"{self._tracking_context(tracking)}"
        )

    def _log_untracked_transfer(self, tracking):
        """Log ARNs for manual cleanup when the insert never landed.

        @param tracking tracking state dict
        """
        if not tracking or tracking.get("inserted"):
            return
        self.log.error(
            f"{DATA_SYNC_LOG_TRACKING_FAILED} untracked transfer {self._tracking_context(tracking)}"
        )

    def transfer_s3_obj(self, bucket_name, data_file_folder, dest_bucket_name, dest_file_folder, tags, file_key_list = None, sync_type = None):
        """Transfer s3 objects via AWS DataSync.

        If file_key_list is not given (None), all files in data_file_folder are copied.
        If file_key_list is given, only those files are copied; after SUCCESS the untracked
        monitor deletes source keys that verify at the destination (size, and ETag when
        neither is multipart).

        Call-path source-deletion guarantee:
        - move_s3_objects: deletes source keys after a verified move into to_be_deleted.
        - restore_deleted_file: deletes the to_be_deleted copies after a verified copy back.
        - Tracked transfers (transfer_release_metadata, transfer_released_files) pass
          sync_type and never delete source keys.

        When sync_type is "metadata" or "file", tracking is written around the same AWS calls.
        A tracking failure never skips or changes those calls. move_s3_objects and
        restore_deleted_file pass no sync_type, so they keep the per-transfer monitor.
        """
        datasync_role = self.configs.get(DATASYNC_ROLE_ARN_CONFIG)
        log_group_arn = self.configs.get(DATASYNC_LOG_ARN_CONFIG)
        datasync = boto3.client('datasync')
        file_filter = []
        handed_to_monitor = False
        step = "create_location_s3"
        tracking = None
        if sync_type:
            tracking = self._new_data_sync_tracking(sync_type, data_file_folder, dest_file_folder)
            self._record_data_sync_start(tracking)
        try:
            # Create source S3 location
            source_location = None
            # Include filter uses paths relative to the source subdirectory so nested keys match.
            if file_key_list and len(file_key_list) > 0:
                folder_prefix = data_file_folder.rstrip("/") + "/"
                relative_paths = []
                for key in file_key_list:
                    if not key:
                        continue
                    if key.startswith(folder_prefix):
                        relative_paths.append("/" + key[len(folder_prefix):])
                    else:
                        relative_paths.append("/" + key.split("/")[-1])
                if relative_paths:
                    file_filter = [
                        {
                            'FilterType': 'SIMPLE_PATTERN',
                            'Value': "|".join(relative_paths),
                        }
                    ]

            location_tags = tags or []
            source_location = datasync.create_location_s3(
                S3BucketArn=f'arn:aws:s3:::{bucket_name}',
                S3Config={'BucketAccessRoleArn': datasync_role},
                Subdirectory=f'{data_file_folder}',
                Tags=location_tags,
            )
            if tracking:
                self._save_data_sync_field(
                    tracking, DATA_SYNC_SOURCE_LOCATION_ARN, source_location['LocationArn'], "source_location_arn",
                )

            # Create destination S3 location
            step = "create_location_s3"
            destination_location = datasync.create_location_s3(
                S3BucketArn=f'arn:aws:s3:::{dest_bucket_name}',
                S3Config={'BucketAccessRoleArn': datasync_role},
                Subdirectory=f'{dest_file_folder}',
                Tags=location_tags,
            )
            if tracking:
                self._save_data_sync_field(
                    tracking, DATA_SYNC_DEST_LOCATION_ARN, destination_location['LocationArn'], "destination_location_arn",
                )

            # Create DataSync task
            step = "create_task"
            task_name = _data_sync_task_name(
                self.configs.get(TIER_CONFIG),
                tracking["data_sync_id"] if tracking else None,
            )
            create_task_kwargs = {
                "SourceLocationArn": source_location["LocationArn"],
                "DestinationLocationArn": destination_location["LocationArn"],
                "Name": task_name,
                "CloudWatchLogGroupArn": log_group_arn,
                "Options": {
                    "VerifyMode": "ONLY_FILES_TRANSFERRED",
                    "LogLevel": "TRANSFER",
                },
                "Tags": tags,
            }
            if file_filter:
                create_task_kwargs["Includes"] = file_filter
            task = datasync.create_task(**create_task_kwargs)

            self.log.info(f"DataSync task {task['TaskArn']} created to transfer files from {data_file_folder} to {dest_bucket_name}:{dest_file_folder}.")
            if tracking:
                self._save_data_sync_field(tracking, DATA_SYNC_TASK_ARN, task['TaskArn'], "task_arn")

            # Start DataSync task
            step = "start_task_execution"
            task_execution = datasync.start_task_execution(
                TaskArn=task['TaskArn']
            )
            task_execution_arn = task_execution['TaskExecutionArn']
            self.log.info(f"Started DataSync task execution: {task_execution_arn}")
            if tracking:
                self._save_data_sync_field(
                    tracking, DATA_SYNC_TASK_EXECUTION_ARN, task_execution_arn, "task_execution_arn",
                )
                if not tracking["inserted"]:
                    self._recover_data_sync_tracking(tracking)
            else:
                start_monitoring_task(
                    task_execution_arn, task['TaskArn'], datasync, source_location, destination_location,
                    self.log, bucket_name, file_key_list, dest_bucket_name, dest_file_folder, data_file_folder,
                )
                handed_to_monitor = True

        except ClientError as ce:
            self.log.exception(ce)
            self.log.exception(f"Failed to transfer files from {data_file_folder} to {dest_bucket_name}:{dest_file_folder}. {ce.response['Error']['Message']}")
            if tracking:
                if step == "start_task_execution" and not _confirmed_start_rejection(ce):
                    self._handle_unconfirmed_start(tracking, step, ce.response['Error']['Message'])
                else:
                    self._mark_data_sync_start_failed(tracking, step, ce.response['Error']['Message'])
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to transfer files from {data_file_folder} to {dest_bucket_name}:{dest_file_folder}. {get_exception_msg()}")
            if tracking:
                if step == "start_task_execution":
                    self._handle_unconfirmed_start(tracking, step, get_exception_msg())
                else:
                    self._mark_data_sync_start_failed(tracking, step, get_exception_msg())
        finally:
            if tracking:
                self._log_untracked_transfer(tracking)
            if not handed_to_monitor:
                try:
                    datasync.close()
                except Exception:
                    pass


    def move_s3_objects(self, file_list):
        """
        move s3 object from one bucket to another
        """
        id, _, _, _, study_id = self.get_submission_info()
        bucket_name = self.configs.get(DM_BUCKET_CONFIG_NAME) #nci data management account s3 bucket
        data_file_folder =  study_id
        dest_bucket_name = bucket_name
        dest_file_folder = f'to_be_deleted/{id}/{study_id}'
        file_key_list = []
        try:
            for file in file_list:
                # 1) check if the file exists in source s3 bucket
                key = os.path.join(data_file_folder, file)
                file_info = self.s3_service.get_file_info(bucket_name, key)
                if not file_info:
                    self.log.warning(f"File {key} does not exist in {bucket_name}!")
                    continue
                file_key_list.append(key)   

            tags = [
                {"Key": "Tier", "Value": self.configs[TIER_CONFIG]}, 
                {"Key": "Type", "Value" : "Data File"}
                ]
            self.transfer_s3_obj(bucket_name, data_file_folder, bucket_name, dest_file_folder, tags, file_key_list)
        except ClientError as ce:
            self.log.exception(ce)
            self.log.exception(f"Failed to move files from {data_file_folder} to {dest_bucket_name}:{dest_file_folder}. {ce.response['Error']['Message']}")
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to move files from {data_file_folder} to {dest_bucket_name}:{dest_file_folder}. {get_exception_msg()}")
    
    def add_tag_on_deleted_file(self, s3FileInfo):
        if not s3FileInfo:
            return
        id, _, _, _, study_id = self.get_submission_info()
        bucket_name = self.configs.get(DM_BUCKET_CONFIG_NAME) #nci data management account s3 bucket
        data_file_folder = f'to_be_deleted/{id}/{study_id}'
        file_name = s3FileInfo.get(FILE_NAME)
        key = os.path.join(data_file_folder, file_name)
        tags = [
            {"Key": "Completed", "Value": "true"},
            ]
        try:
            self.s3_service.add_tags(bucket_name, key, tags)
        except ClientError as ce:
            self.log.exception(ce)
            self.log.exception(f"Failed to add tags to {key}. {ce.response['Error']['Message']}")
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to add tags to {key}. {get_exception_msg()}")

    def restore_deleted_file(self):
        id, _, _, _, study_id = self.get_submission_info()
        # check if deleted files are exist in s3 data folder
        bucket_name = self.configs.get(DM_BUCKET_CONFIG_NAME) #nci data management account s3 bucket
        data_file_folder = f'to_be_deleted/{id}/{study_id}'
        try:
            # Trailing slash keeps sibling prefixes (e.g. study-1-extra) out of the list.
            folder_prefix = data_file_folder.rstrip("/") + "/"
            file_key_list = self.s3_service.list_objects(bucket_name, folder_prefix)
            if not file_key_list or len(file_key_list) == 0:
                self.log.error(f"Failed to restore files from {data_file_folder}. No files found!")
                return
            # Keep only keys under the folder; drop folder markers and empty keys.
            file_key_list = [
                item for item in file_key_list
                if item and not item.endswith("/") and item.startswith(folder_prefix)
            ]
            if not file_key_list:
                self.log.error(f"Failed to restore files from {data_file_folder}. No files found!")
                return
            # Move files back to the original location with dataSync
            dest_file_folder = study_id
            tags = [
                {"Key": "Tier", "Value": self.configs[TIER_CONFIG]}, 
                {"Key": "Type", "Value" : "Data File"}
                ]
            self.transfer_s3_obj(bucket_name, data_file_folder, bucket_name, dest_file_folder, tags, file_key_list)
        except ClientError as ce:
            self.log.exception(ce)
            self.log.exception(f"Failed to restore files from {data_file_folder}. {ce.response['Error']['Message']}")
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to restore files from {data_file_folder}. {get_exception_msg()}")

def start_monitoring_task(task_execution_arn, task_arn, dataSync, source, dest, log, source_bucket, file_key_list, dest_bucket=None, dest_file_folder=None, source_file_folder=None):
    """Start the untracked per-transfer monitor thread.

    @param task_execution_arn AWS task execution ARN
    @param task_arn AWS task ARN
    @param dataSync boto3 DataSync client
    @param source create_location_s3 response for the source
    @param dest create_location_s3 response for the destination
    @param log logger
    @param source_bucket source S3 bucket name
    @param file_key_list source keys to delete after a verified copy, or None/empty for copy-only
    @param dest_bucket destination S3 bucket name used for copy verification
    @param dest_file_folder destination subdirectory used for copy verification
    @param source_file_folder source subdirectory used to map source keys to dest keys
    """
    monitor_thread = threading.Thread(
        target=monitor_datasync_task,
        args=(
            task_execution_arn, task_arn, dataSync, source, dest, log, source_bucket, file_key_list,
            30, dest_bucket, dest_file_folder, source_file_folder,
        ),
    )
    monitor_thread.start()

def _destination_key_for_source(source_key, source_file_folder, dest_file_folder):
    """Map a source object key to its destination key under dest_file_folder.

    @param source_key full source object key
    @param source_file_folder source subdirectory
    @param dest_file_folder destination subdirectory
    @returns destination object key
    """
    folder_prefix = (source_file_folder or "").rstrip("/")
    if folder_prefix and source_key.startswith(folder_prefix + "/"):
        relative = source_key[len(folder_prefix) + 1:]
    else:
        relative = source_key.split("/")[-1]
    dest_prefix = (dest_file_folder or "").rstrip("/")
    if dest_prefix:
        return f"{dest_prefix}/{relative}"
    return relative

def _is_multipart_etag(etag):
    """True when an S3 ETag looks like a multipart upload ETag (contains '-').

    @param etag ETag string, possibly quoted
    @returns True when the ETag should not be compared
    """
    if not etag:
        return True
    return "-" in etag.strip('"')

def _verified_source_keys_to_delete(s3_service, log, source_bucket, file_key_list, dest_bucket, dest_file_folder, source_file_folder):
    """Return source keys whose destination copy matches size (and ETag when comparable).

    On any verification error or mismatch the source key is retained (duplicates preferred
    over data loss) and logged for manual cleanup.

    @param s3_service S3Service instance
    @param log logger
    @param source_bucket source S3 bucket
    @param file_key_list source keys considered for deletion
    @param dest_bucket destination S3 bucket
    @param dest_file_folder destination subdirectory
    @param source_file_folder source subdirectory
    @returns list of source keys safe to delete
    """
    verified = []
    for source_key in file_key_list or []:
        if not source_key:
            continue
        dest_key = _destination_key_for_source(source_key, source_file_folder, dest_file_folder)
        try:
            source_head = s3_service.head_object(source_bucket, source_key)
            dest_head = s3_service.head_object(dest_bucket, dest_key) if dest_bucket else None
        except Exception as e:
            log.exception(e)
            log.error(
                f"Skipping source delete for {source_bucket}/{source_key}: "
                f"verification error for dest {dest_bucket}/{dest_key}; "
                f"source retained; manual cleanup needed. {get_exception_msg()}"
            )
            continue
        if not source_head:
            log.error(
                f"Skipping source delete for {source_bucket}/{source_key}: "
                f"source object not found; source retained; manual cleanup needed."
            )
            continue
        if not dest_head:
            log.error(
                f"Skipping source delete for {source_bucket}/{source_key}: "
                f"destination {dest_bucket}/{dest_key} not found; "
                f"source retained; manual cleanup needed."
            )
            continue
        if source_head.get("ContentLength") != dest_head.get("ContentLength"):
            log.error(
                f"Skipping source delete for {source_bucket}/{source_key}: size mismatch "
                f"source={source_head.get('ContentLength')} dest={dest_head.get('ContentLength')} "
                f"dest={dest_bucket}/{dest_key}; source retained; manual cleanup needed."
            )
            continue
        source_etag = source_head.get("ETag")
        dest_etag = dest_head.get("ETag")
        if not _is_multipart_etag(source_etag) and not _is_multipart_etag(dest_etag):
            if source_etag != dest_etag:
                log.error(
                    f"Skipping source delete for {source_bucket}/{source_key}: ETag mismatch "
                    f"source={source_etag} dest={dest_etag} dest={dest_bucket}/{dest_key}; "
                    f"source retained; manual cleanup needed."
                )
                continue
        verified.append(source_key)
    return verified

def monitor_datasync_task(task_execution_arn, task_arn, datasync, source, dest, log, source_bucket, file_key_list, wait_interval=30, dest_bucket=None, dest_file_folder=None, source_file_folder=None):
    """Poll one untracked DataSync execution; after SUCCESS delete only verified source keys.

    Source deletion is reserved for move/restore workflows that pass file_key_list.
    Tracked transfers never call this path. Task/location deletes each run independently
    so one failure does not block the others.

    @param task_execution_arn AWS task execution ARN
    @param task_arn AWS task ARN
    @param datasync boto3 DataSync client
    @param source create_location_s3 response for the source
    @param dest create_location_s3 response for the destination
    @param log logger
    @param source_bucket source S3 bucket name
    @param file_key_list source keys to consider for deletion after SUCCESS
    @param wait_interval seconds between status polls
    @param dest_bucket destination S3 bucket for copy verification
    @param dest_file_folder destination subdirectory for copy verification
    @param source_file_folder source subdirectory for mapping keys
    """
    try:
        while True:
            response = datasync.describe_task_execution(TaskExecutionArn=task_execution_arn)
            status = response['Status']
            if status in ['SUCCESS', 'ERROR']:
                log.info(f"Task: {task_arn} completed with status: {status}")
                if status == 'SUCCESS' and file_key_list and len(file_key_list) > 0:
                    try:
                        s3_service = S3Service()
                        try:
                            verified = _verified_source_keys_to_delete(
                                s3_service, log, source_bucket, file_key_list,
                                dest_bucket, dest_file_folder, source_file_folder,
                            )
                            if verified:
                                delete_files_from_s3(source_bucket, verified, log)
                            skipped = len(file_key_list) - len(verified)
                            if skipped > 0:
                                log.error(
                                    f"Skipped deleting {skipped} of {len(file_key_list)} source keys "
                                    f"because destination verification failed; "
                                    f"source retained; manual cleanup needed."
                                )
                        finally:
                            s3_service.close(log)
                    except Exception as e:
                        log.exception(e)
                        log.error(
                            f"Source verification/delete failed for task {task_arn}; "
                            f"source retained; manual cleanup needed. {get_exception_msg()}"
                        )
                # wait 5 min or 300 sec for SNS to send notification before delete the tasks.
                log.info(f"Wait 5min before deleting task and locations.")
                time.sleep(300)
                try:
                    datasync.delete_task(TaskArn=task_arn)
                    log.info(f"Task: {task_arn} deleted.")
                except Exception as e:
                    log.exception(e)
                    log.error(
                        f"Failed to delete task {task_arn}; manual cleanup needed. "
                        f"{get_exception_msg()}"
                    )
                source_arn = source.get("LocationArn") if source else None
                try:
                    if source_arn:
                        datasync.delete_location(LocationArn=source_arn)
                        log.info(f"Source location: {source_arn} is deleted.")
                except Exception as e:
                    log.exception(e)
                    log.error(
                        f"Failed to delete source location {source_arn}; "
                        f"manual cleanup needed. {get_exception_msg()}"
                    )
                dest_arn = dest.get("LocationArn") if dest else None
                try:
                    if dest_arn:
                        datasync.delete_location(LocationArn=dest_arn)
                        log.info(f"Destination location: {dest_arn} is deleted.")
                except Exception as e:
                    log.exception(e)
                    log.error(
                        f"Failed to delete destination location {dest_arn}; "
                        f"manual cleanup needed. {get_exception_msg()}"
                    )

                break
            else:
                log.debug(f"Current status for task {task_arn}: {status}. Waiting for {wait_interval} seconds before next check...")
                time.sleep(wait_interval)
    except ClientError as ce:
        log.exception(ce)
        log.exception(f"Failed to monitor DataSync task {task_arn}: {ce.response['Error']['Message']}")
    except Exception as e:
        log.exception(e)
        log.exception(f"Failed to monitor DataSync task {task_arn}: {get_exception_msg()}")
    finally:
        source = None
        dest = None
        datasync.close()
        datasync = None

def delete_files_from_s3(bucket_name, file_key_list, log):
    """Delete the given keys from an S3 bucket.

    @param bucket_name S3 bucket name
    @param file_key_list object keys to delete
    @param log logger
    """
    s3_service = None
    try:
        s3_service = S3Service()
        s3_service.delete_files(bucket_name, file_key_list)
        log.info(f"Files : {file_key_list} are deleted.")
    except ClientError as ce:
        log.exception(ce)
        log.exception(f"Failed to delete files {file_key_list} from {bucket_name}. {ce.response['Error']['Message']}")
    except Exception as e:
        log.exception(e)
        log.exception(f"Failed to delete files {file_key_list} from {bucket_name}. {get_exception_msg()}")
    finally:
        if s3_service:
            s3_service.close(log)
    
# Private class
class ValidationDirectory:
    @staticmethod
    def get_archive(root_path):
        return f"{root_path}/{EXPORT_METADATA}/{ARCHIVE_RELEASE}"

    @staticmethod
    def get_release(root_path):
        return f"{root_path}/{EXPORT_METADATA}/{RELEASE}"
