#!/usr/bin/env python3
import pandas as pd
import csv
import json
import os, io, boto3
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
    DATA_SYNC_STATUS_SUCCEEDED, DATA_SYNC_TASK_ARN, DATA_SYNC_TASK_EXECUTION_ARN, \
    DATA_SYNC_SOURCE_LOCATION_ARN, DATA_SYNC_DEST_LOCATION_ARN, DATA_SYNC_LIST_PENDING, \
    DATA_SYNC_ROLLUP_PENDING, DATA_SYNC_CLEANUP_AFTER, DATA_SYNC_LAST_ERROR, DATA_SYNC_OBSERVATION_ERROR_SINCE, \
    DATA_SYNC_LAST_POLLED_AT, DATA_SYNC_START_TIME, DATA_SYNC_END_TIME, STATUS, \
    DATA_SYNC_MONITOR_ACTIVE_INTERVAL_SECONDS, DATA_SYNC_MONITOR_WAITING_INTERVAL_SECONDS, \
    DATA_SYNC_START_GRACE_SECONDS, DATA_SYNC_CLEANUP_DELAY_SECONDS, DATA_SYNC_POLL_CLAIM_SECONDS, \
    DATA_SYNC_RECOVERY_MAX_SECONDS, DATA_SYNC_OBSERVATION_ALERT_SECONDS, DATA_SYNC_MONITOR_STATE_ACTIVE, \
    DATA_SYNC_MONITOR_STATE_WAITING, DATA_SYNC_WRITE_APPLIED, DATA_SYNC_WRITE_STALE, DATA_SYNC_WRITE_ERROR, \
    DATA_SYNC_LAST_ERROR_NOT_OBSERVABLE, DATA_SYNC_LAST_ERROR_NOT_STARTED, \
    DATA_SYNC_LOG_TRANSFER_FAILED, DATA_SYNC_LOG_EXECUTION_FAILED, DATA_SYNC_LOG_TRACKING_FAILED, \
    DATA_SYNC_LOG_TRACKING_NOT_RECOVERED, DATA_SYNC_LOG_OBSERVATION_ERROR, DATA_SYNC_LOG_CLEANUP_FAILED, \
    DATA_SYNC_LOG_OUTCOME_UNKNOWN, DATA_SYNC_LOG_CLEANUP_DEFERRED
from common.utils import current_datetime, get_uuid_str, dump_dict_to_json, get_exception_msg, get_date_time, dict_exists_in_list, \
    convert_date_time, convert_file_size
from common.model_store import ModelFactory
from common.s3_utils import S3Service
from dcf_manifest_generator import GenerateDCF
from service.ecs_agent import set_scale_in_protection


VISIBILITY_TIMEOUT = 20
BATCH_SIZE = 1000

_data_sync_wake_event = threading.Event()

def _track(log, fn, *args, **kwargs):
    """Call a tracking write and keep any exception from reaching an AWS step.

    @param log logger
    @param fn callable, usually a MongoDao method
    @returns the callable's write outcome, or DATA_SYNC_WRITE_ERROR when it raises
    """
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        log.exception(e)
        try:
            name = fn.__name__
        except Exception:
            name = "tracking write"
        log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} {name} raised: {get_exception_msg()}")
        return DATA_SYNC_WRITE_ERROR

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

    Matches InvalidRequestException / ResourceNotFoundException whose message contains
    "not found" (AWS wording for describe_task_execution, delete_task, and delete_location,
    e.g. "Task execution was not found.", "Resource ... was not found").

    @param error botocore ClientError
    @returns True when the error is a not-found InvalidRequestException or ResourceNotFoundException
    """
    code = error.response.get("Error", {}).get("Code", "")
    message = error.response.get("Error", {}).get("Message", "")
    return code in ("InvalidRequestException", "ResourceNotFoundException") and "not found" in message.lower()

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

def _reopen_early_finalized_record(mongo_dao, log, state, context_fn):
    """Reopen a record finalized as not-observable or not-started once ARNs are saved.

    If the submission was already finished Failed, the list add briefly sets it back to
    In Progress until the monitor observes the real AWS result.

    @param mongo_dao MongoDao instance
    @param log logger
    @param state tracking state with known ARNs
    @param context_fn callable returning the log context string
    """
    set_fields = {
        STATUS: DATA_SYNC_STATUS_IN_PROGRESS,
        DATA_SYNC_LIST_PENDING: True,
        DATA_SYNC_ROLLUP_PENDING: False,
    }
    if state.get("task_arn"):
        set_fields[DATA_SYNC_TASK_ARN] = state["task_arn"]
    if state.get("task_execution_arn"):
        set_fields[DATA_SYNC_TASK_EXECUTION_ARN] = state["task_execution_arn"]
    if state.get("source_location_arn"):
        set_fields[DATA_SYNC_SOURCE_LOCATION_ARN] = state["source_location_arn"]
    if state.get("destination_location_arn"):
        set_fields[DATA_SYNC_DEST_LOCATION_ARN] = state["destination_location_arn"]
    outcome = _track(
        log, mongo_dao.update_data_sync, state["data_sync_id"], set_fields,
        unset_fields=[DATA_SYNC_END_TIME, DATA_SYNC_LAST_ERROR],
        match_fields={
            STATUS: DATA_SYNC_STATUS_FAILED,
            DATA_SYNC_LAST_ERROR: {
                "$in": [DATA_SYNC_LAST_ERROR_NOT_OBSERVABLE, DATA_SYNC_LAST_ERROR_NOT_STARTED],
            },
        },
    )
    if outcome == DATA_SYNC_WRITE_APPLIED:
        log.info(f"DataSync tracking reopened {context_fn()}")
        notify_data_sync_started()

def recover_data_sync_tracking(mongo_dao, log, state, sleep_fn=None, clock=None, describe_status=None, max_seconds=None):
    """Retry tracking writes for one transfer. Never deletes AWS resources.

    Hands off to the shared monitor once the record exists and every known ARN is saved.
    A list add that is still pending is left for the monitor, except STALE (submission gone),
    which clears the pending flags. When ARNs are saved onto a record already finalized as
    not-observable or not-started, reopens it so the monitor can observe the real AWS result.

    @param mongo_dao MongoDao instance
    @param log logger
    @param state mutable tracking state for this transfer
    @param sleep_fn sleep used between attempts; defaults to time.sleep
    @param clock epoch-seconds clock; defaults to time.time
    @param describe_status optional callable returning the AWS execution status, for logging only
    @param max_seconds how long to keep retrying; defaults to DATA_SYNC_RECOVERY_MAX_SECONDS
    """
    sleep_fn = sleep_fn or time.sleep
    clock = clock or time.time
    deadline = clock() + (DATA_SYNC_RECOVERY_MAX_SECONDS if max_seconds is None else max_seconds)

    def context():
        return _data_sync_context(
            state.get("submission_id"), state.get("sync_type"), state.get("data_sync_id"),
            state.get("task_arn"), state.get("task_execution_arn"),
            state.get("source_location_arn"), state.get("destination_location_arn"),
        )

    datasync = None
    try:
        while clock() < deadline:
            missing = []
            if not state.get("inserted"):
                outcome = _track(
                    log, mongo_dao.insert_data_sync,
                    state["submission_id"], state["sync_type"], state["source_folder"], state["target_folder"],
                    state["status"], state["data_sync_id"], state["start_time"],
                    task_arn=state.get("task_arn"), task_execution_arn=state.get("task_execution_arn"),
                    source_location_arn=state.get("source_location_arn"),
                    destination_location_arn=state.get("destination_location_arn"),
                    end_time=state.get("end_time"), rollup_pending=state.get("rollup_pending", False),
                    last_error=state.get("last_error"),
                )
                if outcome == DATA_SYNC_WRITE_APPLIED:
                    state["inserted"] = True
                else:
                    missing.append("insert")
            saved_arns = False
            if state.get("inserted") and state.get("pending_fields"):
                had_arn_fields = any(
                    field in state["pending_fields"]
                    for field in (DATA_SYNC_TASK_ARN, DATA_SYNC_TASK_EXECUTION_ARN)
                )
                outcome = _track(log, mongo_dao.update_data_sync, state["data_sync_id"], dict(state["pending_fields"]))
                if outcome == DATA_SYNC_WRITE_APPLIED:
                    state["pending_fields"] = {}
                    saved_arns = had_arn_fields
                else:
                    missing.append("arn save")
            if saved_arns and (state.get("task_arn") or state.get("task_execution_arn")):
                _reopen_early_finalized_record(mongo_dao, log, state, context)
            if state.get("inserted") and not state.get("list_added"):
                added = _track(
                    log, mongo_dao.add_active_submission_data_sync,
                    state["submission_id"], state["sync_type"], state["data_sync_id"],
                )
                if added == DATA_SYNC_WRITE_APPLIED:
                    cleared = _track(
                        log, mongo_dao.update_data_sync, state["data_sync_id"], {DATA_SYNC_LIST_PENDING: False},
                    )
                    if cleared == DATA_SYNC_WRITE_APPLIED:
                        state["list_added"] = True
                    else:
                        missing.append("listPending clear")
                elif added == DATA_SYNC_WRITE_STALE:
                    if _clear_submission_gone_flags(mongo_dao, log, state["data_sync_id"], context()):
                        state["list_added"] = True
                    else:
                        missing.append("submission-gone clear")
                else:
                    missing.append("add")
            if state.get("task_execution_arn"):
                try:
                    if describe_status:
                        aws_status = describe_status(state["task_execution_arn"])
                    else:
                        if datasync is None:
                            datasync = boto3.client("datasync")
                        aws_status = datasync.describe_task_execution(
                            TaskExecutionArn=state["task_execution_arn"],
                        ).get("Status")
                    log.info(f"DataSync recovery observed {aws_status} {context()}")
                except Exception as e:
                    log.exception(e)
                    log.warning(f"{DATA_SYNC_LOG_OBSERVATION_ERROR} {context()}: {get_exception_msg()}")
            if state.get("inserted") and not state.get("pending_fields"):
                notify_data_sync_started()
                log.info(f"DataSync tracking recovered {context()}")
                return
            log.error(
                f"{DATA_SYNC_LOG_TRACKING_FAILED} recovery missing {', '.join(missing) or 'fields'} {context()}"
            )
            sleep_fn(DATA_SYNC_MONITOR_ACTIVE_INTERVAL_SECONDS)
        log.error(f"{DATA_SYNC_LOG_TRACKING_NOT_RECOVERED} {context()}")
    finally:
        if datasync is not None:
            try:
                datasync.close()
            except Exception:
                pass

def _defer_cleanup(log, context):
    """Log that AWS cleanup is waiting on a tracking write.

    @param log logger
    @param context log context string
    """
    log.error(f"{DATA_SYNC_LOG_CLEANUP_DEFERRED} {context}")

def _finalize_data_sync_record(mongo_dao, log, record, status, end_time, last_error, schedule_cleanup):
    """Write a terminal dataSync status. Sets cleanupAfter for confirmed AWS terminal results
    and for confirmed not-found / not-started failures that still have ARNs to delete.

    Only matches while status is still In Progress so a stale monitor snapshot cannot overwrite
    a record another container already finalized.

    @param mongo_dao MongoDao instance
    @param log logger
    @param record dataSync document, updated in place on success
    @param status Succeeded or Failed
    @param end_time terminal time
    @param last_error diagnostic to store, or None
    @param schedule_cleanup True when AWS resources should be deleted after the delay
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
    outcome = _track(
        log, mongo_dao.update_data_sync, record.get(ID), set_fields,
        unset_fields=unset_fields,
        match_fields={STATUS: DATA_SYNC_STATUS_IN_PROGRESS},
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

    @param record dataSync document
    @param now current datetime
    @returns True when cleanupAfter is set, due, and tracking writes are done
    """
    cleanup_after = record.get(DATA_SYNC_CLEANUP_AFTER)
    if not cleanup_after or record.get(DATA_SYNC_LIST_PENDING) or record.get(DATA_SYNC_ROLLUP_PENDING):
        return False
    return cleanup_after <= now

def _delete_data_sync_resources(datasync, log, record):
    """Delete the AWS task and both locations. Not-found counts as already done.

    A failure leaves tracking fields untouched.

    @param datasync boto3 DataSync client
    @param log logger
    @param record dataSync document
    @returns True when every delete succeeded or was already gone
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
            log.exception(ce)
            log.error(
                f"{DATA_SYNC_LOG_CLEANUP_FAILED} {label} {arn} {context}. "
                f"Tracking is already recorded and is not affected. {ce.response['Error']['Message']}"
            )
            return False
        except Exception as e:
            log.exception(e)
            log.error(
                f"{DATA_SYNC_LOG_CLEANUP_FAILED} {label} {arn} {context}. "
                f"Tracking is already recorded and is not affected. {get_exception_msg()}"
            )
            return False
    return True

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

    @param datasync boto3 DataSync client
    @param mongo_dao MongoDao instance
    @param log logger
    @param record dataSync document, updated in place when an execution ARN is found
    @returns the execution ARN, or None
    """
    execution_arn = record.get(DATA_SYNC_TASK_EXECUTION_ARN)
    if execution_arn or not record.get(DATA_SYNC_TASK_ARN):
        return execution_arn
    response = datasync.list_task_executions(TaskArn=record[DATA_SYNC_TASK_ARN])
    executions = response.get("TaskExecutions") or []
    if not executions:
        return None
    execution_arn = executions[0].get("TaskExecutionArn")
    if execution_arn:
        record[DATA_SYNC_TASK_EXECUTION_ARN] = execution_arn
        _track(log, mongo_dao.update_data_sync, record.get(ID), {DATA_SYNC_TASK_EXECUTION_ARN: execution_arn})
    return execution_arn

def _past_start_grace(record, now):
    """True when startTime is at least the grace period before now.

    @param record dataSync document
    @param now current datetime
    @returns True when the grace has elapsed
    """
    start_time = record.get(DATA_SYNC_START_TIME)
    if not start_time:
        return False
    return now - start_time >= timedelta(seconds=DATA_SYNC_START_GRACE_SECONDS)

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

def _monitor_in_progress_data_sync(datasync, mongo_dao, log, record):
    """Poll one In Progress record and finalize it only on a confirmed AWS result.

    Skips the AWS calls when another container polled the record within DATA_SYNC_POLL_CLAIM_SECONDS.

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
        if _client_error_not_found(ce) and _past_start_grace(record, now):
            log.error(f"{DATA_SYNC_LOG_EXECUTION_FAILED} execution not found {context}")
            _finalize_data_sync_record(
                mongo_dao, log, record, DATA_SYNC_STATUS_FAILED, now, "execution not found", True,
            )
            return
        _record_observation_error(mongo_dao, log, record, ce.response["Error"]["Message"])
        return
    except Exception as e:
        _record_observation_error(mongo_dao, log, record, get_exception_msg())
        log.exception(e)
        return
    if not execution_arn:
        if not _past_start_grace(record, now):
            return
        if record.get(DATA_SYNC_TASK_ARN):
            log.error(f"{DATA_SYNC_LOG_TRANSFER_FAILED} {DATA_SYNC_LAST_ERROR_NOT_STARTED} {context}")
            _finalize_data_sync_record(
                mongo_dao, log, record, DATA_SYNC_STATUS_FAILED, now, DATA_SYNC_LAST_ERROR_NOT_STARTED, True,
            )
            return
        log.error(
            f"{DATA_SYNC_LOG_OUTCOME_UNKNOWN} {context}. "
            f"{DATA_SYNC_LAST_ERROR_NOT_OBSERVABLE}. The transfer may have succeeded."
        )
        _finalize_data_sync_record(
            mongo_dao, log, record, DATA_SYNC_STATUS_FAILED, now, DATA_SYNC_LAST_ERROR_NOT_OBSERVABLE, False,
        )
        return
    try:
        response = datasync.describe_task_execution(TaskExecutionArn=execution_arn)
    except ClientError as ce:
        if _client_error_not_found(ce):
            log.error(f"{DATA_SYNC_LOG_EXECUTION_FAILED} execution not found {context}")
            _finalize_data_sync_record(
                mongo_dao, log, record, DATA_SYNC_STATUS_FAILED, now, "execution not found", True,
            )
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

    Cleanup runs only after the tracking writes have been applied and cleanupAfter is due.
    A STALE list add (submission gone) clears the pending flags so cleanup can still run.

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
            if _clear_submission_gone_flags(mongo_dao, log, record.get(ID), context):
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
    if _cleanup_due(record, current_datetime()):
        if _delete_data_sync_resources(datasync, log, record):
            cleared = _track(log, mongo_dao.update_data_sync, record.get(ID), unset_fields=[DATA_SYNC_CLEANUP_AFTER])
            if cleared == DATA_SYNC_WRITE_APPLIED:
                record.pop(DATA_SYNC_CLEANUP_AFTER, None)
                log.info(f"DataSync cleanup done {context}")
            else:
                log.error(f"{DATA_SYNC_LOG_CLEANUP_FAILED} clear cleanupAfter outcome={cleared} {context}. Tracking is already recorded and is not affected.")

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
            "tracking_failed": False,
            "pending_fields": {},
            "task_arn": None,
            "task_execution_arn": None,
            "source_location_arn": None,
            "destination_location_arn": None,
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

        @param tracking tracking state dict
        """
        outcome = _track(
            self.log, self.mongo_dao.insert_data_sync,
            tracking["submission_id"], tracking["sync_type"], tracking["source_folder"], tracking["target_folder"],
            tracking["status"], tracking["data_sync_id"], tracking["start_time"],
        )
        if outcome != DATA_SYNC_WRITE_APPLIED:
            tracking["tracking_failed"] = True
            self.log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} insert outcome={outcome} {self._tracking_context(tracking)}")
            return
        tracking["inserted"] = True
        notify_data_sync_started()
        added = _track(
            self.log, self.mongo_dao.add_active_submission_data_sync,
            tracking["submission_id"], tracking["sync_type"], tracking["data_sync_id"],
        )
        if added != DATA_SYNC_WRITE_APPLIED:
            tracking["tracking_failed"] = True
            self.log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} add outcome={added} {self._tracking_context(tracking)}")
            return
        cleared = _track(
            self.log, self.mongo_dao.update_data_sync,
            tracking["data_sync_id"], {DATA_SYNC_LIST_PENDING: False},
        )
        if cleared == DATA_SYNC_WRITE_APPLIED:
            tracking["list_added"] = True
            return
        tracking["tracking_failed"] = True
        self.log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} clear listPending outcome={cleared} {self._tracking_context(tracking)}")

    def _save_data_sync_field(self, tracking, field, value, state_key):
        """Remember an ARN and write it to the dataSync record when the record exists.

        @param tracking tracking state dict
        @param field dataSync document field name
        @param value field value
        @param state_key key on the tracking state
        """
        tracking[state_key] = value
        if not tracking["inserted"]:
            tracking["pending_fields"][field] = value
            tracking["tracking_failed"] = True
            return
        outcome = _track(self.log, self.mongo_dao.update_data_sync, tracking["data_sync_id"], {field: value})
        if outcome != DATA_SYNC_WRITE_APPLIED:
            tracking["pending_fields"][field] = value
            tracking["tracking_failed"] = True
            self.log.error(
                f"{DATA_SYNC_LOG_TRACKING_FAILED} {field} outcome={outcome} {self._tracking_context(tracking)}"
            )

    def _mark_data_sync_start_failed(self, tracking, step, message):
        """Record that the AWS transfer failed before start_task_execution returned. Does not delete anything.

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
        tracking["tracking_failed"] = True
        context = self._tracking_context(tracking)
        self.log.error(f"{DATA_SYNC_LOG_TRANSFER_FAILED} {step} {message} {context}")
        fields = {
            STATUS: DATA_SYNC_STATUS_FAILED,
            DATA_SYNC_END_TIME: end_time,
            DATA_SYNC_ROLLUP_PENDING: True,
            DATA_SYNC_LAST_ERROR: last_error,
        }
        if not tracking["inserted"]:
            tracking["pending_fields"].update(fields)
            return
        outcome = _track(self.log, self.mongo_dao.update_data_sync, tracking["data_sync_id"], fields)
        if outcome != DATA_SYNC_WRITE_APPLIED:
            tracking["pending_fields"].update(fields)
            self.log.error(f"{DATA_SYNC_LOG_TRACKING_FAILED} start failure outcome={outcome} {context}")

    def _start_data_sync_recovery(self, tracking):
        """Start the thread that retries tracking writes. It never deletes AWS resources.

        @param tracking tracking state dict
        """
        if not tracking or not tracking.get("tracking_failed"):
            return
        threading.Thread(
            target=recover_data_sync_tracking,
            args=(self.mongo_dao, self.log, tracking),
            daemon=True,
        ).start()

    def transfer_s3_obj(self, bucket_name, data_file_folder, dest_bucket_name, dest_file_folder, tags, file_key_list = None, sync_type = None):
        """
        This function transfers s3 objects via AWS DataSync. 
        If file_key_list is not given (None), all files in data_file_folder will be copied to destination. 
        If file_key_list is given, only files in the list will be copied and then original files will be DELETED!

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
            # add include filter for moving files from source to destination
            if file_key_list and len(file_key_list) > 0:
                value = "|".join(["/" + key.split("/")[-1] for key in file_key_list if key])
                file_filter = [
                    {
                        'FilterType': 'SIMPLE_PATTERN',
                        'Value': value
                    }
                ]

            source_location = datasync.create_location_s3(
                S3BucketArn=f'arn:aws:s3:::{bucket_name}',
                S3Config={'BucketAccessRoleArn': datasync_role},
                Subdirectory=f'{data_file_folder}',
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
                Subdirectory=f'{dest_file_folder}'
            )
            if tracking:
                self._save_data_sync_field(
                    tracking, DATA_SYNC_DEST_LOCATION_ARN, destination_location['LocationArn'], "destination_location_arn",
                )

            # Create DataSync task
            step = "create_task"
            if file_filter and len(file_filter) > 0:
                task = datasync.create_task(
                    SourceLocationArn=source_location['LocationArn'],
                    DestinationLocationArn=destination_location['LocationArn'],
                    Name='Data_Hub_SyncTask',
                    CloudWatchLogGroupArn=log_group_arn,
                    Options={
                        'VerifyMode': 'ONLY_FILES_TRANSFERRED',
                        "LogLevel": "TRANSFER",
                    },
                    Includes=file_filter, 
                    Tags = tags, 
                )
            else: 
                task = datasync.create_task(
                    SourceLocationArn=source_location['LocationArn'],
                    DestinationLocationArn=destination_location['LocationArn'],
                    Name='Data_Hub_SyncTask',
                    CloudWatchLogGroupArn=log_group_arn,
                    Options={
                        'VerifyMode': 'ONLY_FILES_TRANSFERRED',
                        "LogLevel": "TRANSFER",
                    },
                    Tags = tags, 
                )

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
                if tracking["tracking_failed"]:
                    self._start_data_sync_recovery(tracking)
            else:
                start_monitoring_task(
                    task_execution_arn, task['TaskArn'], datasync, source_location, destination_location,
                    self.log, bucket_name, file_key_list,
                )
                handed_to_monitor = True

        except ClientError as ce:
            self.log.exception(ce)
            self.log.exception(f"Failed to transfer files from {data_file_folder} to {dest_bucket_name}:{dest_file_folder}. {ce.response['Error']['Message']}")
            if tracking:
                self._mark_data_sync_start_failed(tracking, step, ce.response['Error']['Message'])
                self._start_data_sync_recovery(tracking)
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to transfer files from {data_file_folder} to {dest_bucket_name}:{dest_file_folder}. {get_exception_msg()}")
            if tracking:
                self._mark_data_sync_start_failed(tracking, step, get_exception_msg())
                self._start_data_sync_recovery(tracking)
        finally:
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
            # get contents in the folder and loop through and put file kay in a file_key_list
            file_key_list = self.s3_service.list_objects(bucket_name, data_file_folder)
            if not file_key_list or len(file_key_list) == 0:
                self.log.error(f"Failed to restore files from {data_file_folder}. No files found!")
                return
            # remove folder and empty key from the list
            file_key_list = [item for item in file_key_list if item and not item.endswith("/")]
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

def start_monitoring_task(task_execution_arn, task_arn, dataSync, source, dest, log, source_bucket, file_key_list):
            monitor_thread = threading.Thread(target=monitor_datasync_task, args=(task_execution_arn, task_arn, dataSync, source, dest, log, source_bucket, file_key_list))
            monitor_thread.start()

def monitor_datasync_task(task_execution_arn, task_arn, datasync, source, dest, log, source_bucket, file_key_list, wait_interval=30):
        # Initialize the DataSync client
        try:
            # Poll the task status
            while True:
                response = datasync.describe_task_execution(TaskExecutionArn=task_execution_arn)
                status = response['Status']
                if status in ['SUCCESS', 'ERROR']:
                    log.info(f"Task: {task_arn} completed with status: {status}")
                    # delete files from source s3 bucket if the file_key_list length more than 0
                    if status == 'SUCCESS' and file_key_list and len(file_key_list) > 0:
                        delete_files_from_s3(source_bucket, file_key_list, log)
                    # wait 5 min or 300 sec for SNS to send notification before delete the tasks.
                    log.info(f"Wait 5min before deleting task and locations.")
                    time.sleep(300)
                    datasync.delete_task(TaskArn=task_arn)
                    log.info(f"Task: {task_arn} deleted.")
                    datasync.delete_location(LocationArn=source['LocationArn'])
                    log.info(f"Source location: {source['LocationArn']} is deleted.")
                    datasync.delete_location(LocationArn=dest['LocationArn'])
                    log.info(f"Destination location: {dest['LocationArn']} is deleted.")
                    
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
        s3_service.close(log)
    
# Private class
class ValidationDirectory:
    @staticmethod
    def get_archive(root_path):
        return f"{root_path}/{EXPORT_METADATA}/{ARCHIVE_RELEASE}"

    @staticmethod
    def get_release(root_path):
        return f"{root_path}/{EXPORT_METADATA}/{RELEASE}"
