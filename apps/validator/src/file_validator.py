#!/usr/bin/env python3

import os
from bento.common.utils import get_logger
from bento.common.s3 import S3Bucket
from pymongo import errors
from common.constants import ERRORS, WARNINGS, STATUS, S3_FILE_INFO, ID, SIZE, MD5, UPDATED_AT, \
    FILE_NAME, SQS_TYPE, SQS_NAME, FILE_ID, STATUS_ERROR, STATUS_WARNING, STATUS_PASSED, STATUS_FAILED, SUBMISSION_ID, \
    BATCH_BUCKET, SERVICE_TYPE_FILE, LAST_MODIFIED, CREATED_AT, TYPE, SUBMISSION_INTENTION, SUBMISSION_INTENTION_DELETE,\
    VALIDATION_ID, QC_RESULT_ID, VALIDATION_TYPE_FILE, QC_SEVERITY, QC_VALIDATE_DATE, \
    DATA_FILE_TYPE, QC_VALIDATION_TYPE, SUBMITTED_ID, BATCH_ID, DISPLAY_ID, UPLOADED_DATE, \
    FILE_VALIDATION_STATUS

from common.utils import get_exception_msg, current_datetime, get_s3_file_info, get_s3_file_md5, create_error, get_uuid_str
from common.validation_closeout import (
    FILE_PROGRESS, METADATA_PROGRESS, InvalidValidationMessage,
    process_validation_message, record_type_progress,
)
from service.ecs_agent import set_scale_in_protection
from metadata_validator import get_qc_result

VISIBILITY_TIMEOUT = 20


class _RetryableFileRead(Exception):
    """A file-list read failed. The orphan-scan message should be retried."""


"""
Interface for validate files via SQS
"""
def fileValidate(configs, job_queue, mongo_dao):
    file_processed = 0
    log = get_logger('Data file Validation Service')
    #run file validator as a service
    scale_in_protection_flag = False
    log.info(f'{SERVICE_TYPE_FILE} service started')
    while True:
        try:
            msgs = job_queue.receiveMsgs(VISIBILITY_TIMEOUT)
            if len(msgs) > 0:
                log.info(f'New message is coming: {configs[SQS_NAME]}, '
                         f'{file_processed} data file(s) have been processed so far')
                scale_in_protection_flag = True
                set_scale_in_protection(True)
            else:
                if scale_in_protection_flag is True:
                    scale_in_protection_flag = False
                    set_scale_in_protection(False)

            for msg in msgs:
                log.info(f'Received a job!')
                deleted = process_validation_message(
                    msg, log, mongo_dao,
                    lambda data: _handle_file_message(mongo_dao, log, data),
                    VISIBILITY_TIMEOUT,
                )
                if deleted:
                    file_processed += 1
        except KeyboardInterrupt:
            log.info('Good bye!')
            return

def _handle_file_message(mongo_dao, log, data):
    """Validate one file queue message and record its result.

    Missing ids and unknown types raise InvalidValidationMessage. A missing
    file record is recorded as an Error task. Transient file-record reads,
    a failed file-list read, and a failed F008 qcResults write (on a completed
    orphan scan) raise so the message can be requeued. A Failed orphan scan is
    recorded so the run can finish but does not replace F008 qcResults.

    @param mongo_dao MongoDao
    @param log logger
    @param data parsed message body
    """
    validation_id = data.get(VALIDATION_ID)
    submission_id = data.get(SUBMISSION_ID)
    if not validation_id:
        raise InvalidValidationMessage(
            f'Invalid message: {data}',
            submission_id=submission_id,
            submission_status_field=FILE_VALIDATION_STATUS,
        )

    validator = None
    try:
        msg_type = data.get(SQS_TYPE)
        file_id = data.get(FILE_ID)
        if msg_type == "Validate File":
            if not file_id:
                raise InvalidValidationMessage(
                    f'Invalid message: {data}',
                    validation_id=validation_id,
                    submission_id=submission_id,
                    submission_status_field=FILE_VALIDATION_STATUS,
                )
            file_record = mongo_dao.get_file(file_id)
            if file_record is None:
                log.error(f'The data file record is not found, {file_id}!')
                record_task_result(STATUS_ERROR, validation_id, mongo_dao, log)
                return
            validator = FileValidator(mongo_dao)
            status = validator.validate(file_record)
            if status == STATUS_ERROR:
                log.error(f'The data file record is invalid, {file_id}!')
            elif status == STATUS_WARNING:
                log.error(f'The data file record is valid but with warning, {file_id}!')
            else:
                log.info(f'The data file record passed validation, {file_id}.')
            if not mongo_dao.update_file_info(file_record):
                log.error(f'Failed to update data file record, {file_id}!')
                raise Exception(f'Failed to update data file record, {file_id}!')
            log.info(f'The data file record is updated,{file_id}.')
            log.info(f'Processed validation for "data file: " {file_id}')
            record_task_result(status, validation_id, mongo_dao, log)
        elif msg_type == "Validate Submission Files":
            if not submission_id:
                raise InvalidValidationMessage(
                    f'Invalid message: {data}',
                    validation_id=validation_id,
                    submission_status_field=FILE_VALIDATION_STATUS,
                )
            submission = mongo_dao.get_submission(submission_id)
            if not submission:
                raise InvalidValidationMessage(
                    f'Invalid submission, {submission_id}!',
                    validation_id=validation_id,
                    submission_id=submission_id,
                    submission_status_field=FILE_VALIDATION_STATUS,
                )
            validator = FileValidator(mongo_dao)
            if not validator.get_root_path(submission_id):
                log.error(f'Invalid submission, {submission_id}!')
                status = STATUS_ERROR
                orphan_errors = []
            else:
                status, orphan_errors = validator.validate_all_files(submission_id)
            if status != STATUS_FAILED:
                if mongo_dao.replace_f008_qc_results(submission_id, orphan_errors) is False:
                    raise Exception(f'Failed to update F008 qcResults for {submission_id}')
            log.info(f'Processed orphaned file validation for submission: {submission_id}')
            record_task_result(status, validation_id, mongo_dao, log)
        else:
            raise InvalidValidationMessage(
                f'Invalid message: {data}',
                validation_id=validation_id,
                submission_id=submission_id,
                submission_status_field=FILE_VALIDATION_STATUS,
            )
    finally:
        if validator:
            del validator


def record_task_result(status: str, validation_id: str, mongo_dao: object, log: object):
    """Record one file-validation task using the shared close-out.

    @param status file result status
    @param validation_id validation document id
    @param mongo_dao MongoDao
    @param log logger
    """
    record_type_progress(
        status, validation_id, mongo_dao, log, FILE_PROGRESS, METADATA_PROGRESS,
        ended_at=current_datetime(),
    )


"""
 Requirement for the ticket crdcdh-539
1. Missing File, validate if a file specified in a manifest exist in files folder of the submission (error)
2. File integrity check, file size and md5 will be validated based on the information in the manifest(s) (error)
3. Extra files, validate if there are files in files folder of the submission that are not specified in any manifests 
    of the submission. This may happen if submitter uploaded files (via CLI) but forgot to upload the manifest. (error) included in total count.
    * this requirement needs to validate all files in a submission, it is implemented in check_duplicates_in_submission(self, submissionId)
4. Duplication (Warning): 
    4-1. Same MD5 checksum and same filename 
    4-2. Same MD5 checksum but different filenames
    4-3. Same filename  but different MD5 checksum
    4-4. If the old file was in an earlier batch or submission, and If the submitter indicates this file is NEW, this should trigger an Error.  If the submitter has indicated this is a replacement, there's no error or warning. If this is part of the same batch, then the new file just overwrites the old file and is flagged as NEW.
"""
class FileValidator:
    
    def __init__(self, mongo_dao):
        self.log = get_logger('Data file Validator')
        self.mongo_dao = mongo_dao
        self.bucket_name = None
        self.bucket = None
        self.rootPath = None
        self.update_file_list = None
        self.submission = None

    def validate(self, fileRecord):
        """Validate one file record.

        A database error while loading the submission is raised so the message
        can be retried. A missing submission, root path, or bucket is an Error
        result. Other unexpected failures are stored as Error.

        @param fileRecord data file document
        @returns Passed, Warning, or Error
        @raises errors.PyMongoError when a database read or write fails
        """
        if not self.validate_fileRecord(fileRecord):
            return STATUS_ERROR
        if not self.get_root_path(fileRecord[SUBMISSION_ID]):
            return STATUS_ERROR
        try:
            #escape file validation if submission intention is Delete
            if self.submission.get(SUBMISSION_INTENTION) == SUBMISSION_INTENTION_DELETE:
                return STATUS_PASSED
            # validate individual file
            status, error = self.validate_file(fileRecord)
            self.save_qc_result(fileRecord, status, error)
            return status
        except errors.PyMongoError:
            raise
        except Exception as e: #catch all unhandled exception
            self.log.exception(e)
            msg = f"{fileRecord.get(SUBMISSION_ID)}: Failed to validate data file, {fileRecord.get(ID)}! {get_exception_msg()}!"
            self.log.exception(msg)
            error = create_error("F011", [], "", "")
            self.save_qc_result(fileRecord, STATUS_ERROR, error)
            return STATUS_ERROR
        finally:
            if self.bucket:
                del self.bucket

    
    def validate_fileRecord(self, fileRecord):
        #This service only processes metadata batches, if a file batch is passed, it should be ignored (output an error message in the log).
        if not fileRecord.get(S3_FILE_INFO):
            msg = f'Invalid file object, no s3 file info, {fileRecord[ID]}!'
            self.log.error(msg)
            error = create_error("F009", [fileRecord[ID]], S3_FILE_INFO, "")
            self.save_qc_result(fileRecord, STATUS_ERROR, error)
            return False
        else:
            if not fileRecord[S3_FILE_INFO].get(FILE_NAME) or not fileRecord[S3_FILE_INFO].get(SIZE) \
                    or not fileRecord[S3_FILE_INFO].get(MD5):
                msg = f'Invalid data file object: invalid s3 data file info, {fileRecord[ID]}!'
                self.log.error(msg)
                error = create_error("F010", [fileRecord[ID]],  FILE_NAME, "")
                self.save_qc_result(fileRecord, STATUS_ERROR, error)
                return False
        return True
    
    def get_root_path(self, submissionID):
        submission = self.mongo_dao.get_submission(submissionID)
        if not submission:
            msg = f'Invalid submission object, no related submission object found, {submissionID}!'
            self.log.error(msg)
            return False
        self.submission = submission
        if not submission.get("rootPath"):
            msg = f'Invalid submission object, no rootPath found, {submissionID}!'
            self.log.error(msg)
            return False
        
        if not submission.get(BATCH_BUCKET):
            msg = f'Invalid submission object, no bucket found, {submissionID}!'
            self.log.error(msg)
            return False
        
        self.rootPath= submission["rootPath"]
        self.bucket_name = submission[BATCH_BUCKET]
        self.bucket = S3Bucket(self.bucket_name)
        return True
    
    """
    This function is designed for validate individual file in s3 bucket that is mounted to /s3_bucket dir
    """
    def validate_file(self, fileRecord):

        file_info = fileRecord[S3_FILE_INFO]
        key = os.path.join(os.path.join(self.rootPath, f"file/{file_info[FILE_NAME]}"))
        org_size = file_info[SIZE]
        org_md5 = file_info[MD5]
        file_name = file_info[FILE_NAME]

        # 1. check if exists
        if not self.bucket.file_exists_on_s3(key):
            msg = f'Data file “{file_name}” not found.'
            self.log.error(msg)
            error = create_error("F001", [file_name], "file", key)
            return STATUS_ERROR, error
        
        # 2. check file integrity
        size, last_updated = get_s3_file_info(self.bucket_name, key)
        #check cached md5
        cached_md5 = self.mongo_dao.get_file_md5(self.submission[ID], file_name)
        md5 = None
        if cached_md5 and last_updated.replace(tzinfo=None) <= cached_md5.get(LAST_MODIFIED).replace(tzinfo=None):
            md5 = cached_md5.get(MD5)
        else:
            md5 = get_s3_file_md5(self.bucket_name, key)
            current_date_time = current_datetime()
            md5_info = {
                ID: get_uuid_str() if not cached_md5 else cached_md5[ID],
                SUBMISSION_ID : self.submission[ID],
                FILE_NAME: file_name,
                MD5: md5,
                LAST_MODIFIED: last_updated,
                CREATED_AT: current_date_time if not cached_md5 else cached_md5[CREATED_AT],
                UPDATED_AT: current_date_time
            }
            self.mongo_dao.save_file_md5(md5_info)

        if int(org_size) != int(size):
            msg = f'Data file “{file_name}”: expected size: {org_size}, actual size: {size}.'
            self.log.error(msg)
            error = create_error("F003", [file_name, org_size, size], "file size", org_size)
            return STATUS_ERROR, error
        
        if org_md5 != md5:
            msg = f'Data file “{file_name}”: expected MD5: {org_md5}, actual MD5: {md5}.'
            self.log.error(msg)
            error = create_error("F004", [file_name, org_md5, md5],  "md5", org_md5)
            return STATUS_ERROR, error
        
        # check duplicates in manifest
        manifest_info_list = self.mongo_dao.get_files_by_submission(fileRecord[SUBMISSION_ID])
        if not manifest_info_list or  len(manifest_info_list) == 0:
            msg = f"No data file records found for the submission."
            self.log.error(msg)
            error = create_error("F002", [], "files", None)
            return STATUS_ERROR, error
        
        # 3. check if Same MD5 checksum and same filename 
        temp_list = [file for file in manifest_info_list if file[S3_FILE_INFO][FILE_NAME] == file_name and file[S3_FILE_INFO][MD5] == org_md5]
        if len(temp_list) > 1:
            msg = f'Data file “{file_name}”: already exists with the same name and md5 value.'
            self.log.warning(msg)
            error = create_error("F005", [file_name], "file name", file_name)
            return STATUS_WARNING, error 
        
        # 4. check if Same filename but different MD5 checksum 
        temp_list = [file for file in manifest_info_list if file[S3_FILE_INFO][FILE_NAME] == file_name and file[S3_FILE_INFO][MD5] != org_md5]
        if len(temp_list) > 0:
            msg = f'Data file “{file_name}”: A data file with the same name but different md5 value was found.'
            self.log.warning(msg)
            error = create_error("F006", [file_name], "file name", file_name)
            return STATUS_WARNING, error
        
        # 5. check if Same MD5 checksum but different filename
        temp_list = [file for file in manifest_info_list if file[S3_FILE_INFO][FILE_NAME] != file_name and file[S3_FILE_INFO][MD5] == org_md5]
        if len(temp_list) > 0:
            msg = f'Data file “{file_name}”: another data file with the same MD5 found.'
            error = create_error("F007", [file_name], "file name", file_name)
            self.log.warning(msg)
            return STATUS_WARNING, error 
            
        return STATUS_PASSED, None
    
    def _collect_extra_s3_file_errors(self, submission_id, manifest_file_names):
        """
        Build F008 submission-level errors for objects under file/ that are not listed in manifest_file_names.
        Skips log paths and empty key suffixes (prefix placeholders).
        """
        if not self.bucket:
            return []
        manifest_names = set(manifest_file_names or [])
        errors = []
        prefix = os.path.join(os.path.join(self.rootPath, "file/"))
        for file in self.bucket.bucket.objects.filter(Prefix=prefix):
            if file.key.startswith(f"{prefix}log/"):
                continue
            file_name = file.key.split("/")[-1]
            if not file_name or file_name in manifest_names:
                continue
            file_batch = self.mongo_dao.find_batch_by_file_name(submission_id, DATA_FILE_TYPE, file_name)
            batchID = file_batch[ID] if file_batch else "-"
            displayID = file_batch[DISPLAY_ID] if file_batch else None
            msg = (
                f'Data file “{file_name}”: associated metadata not found. '
                f"Please upload associated metadata (aka. manifest) file"
            )
            self.log.error(msg)
            errors.append({
                TYPE: DATA_FILE_TYPE,
                QC_VALIDATION_TYPE: DATA_FILE_TYPE,
                SUBMITTED_ID: file_name,
                BATCH_ID: batchID,
                DISPLAY_ID: displayID,
                QC_SEVERITY: STATUS_ERROR,
                UPLOADED_DATE: file.last_modified,
                QC_VALIDATE_DATE: current_datetime(),
                ERRORS: [create_error("F008", [file_name], "file name", file_name)],
            })
        return errors

    def validate_all_files(self, submission_id):
        """Find files in the submission folder that no manifest lists.

        A failed file-list read raises so the message can be retried. Any other
        unexpected exception returns Failed with an empty error list; the caller
        records the task as finished but must not replace F008 qcResults.

        @param submission_id submission document id
        @returns (status, orphan errors) F008 rows when status is not Failed
        @raises _RetryableFileRead when the file list cannot be loaded
        @raises errors.PyMongoError when a database read fails
        """
        self.get_root_path(submission_id)

        try:
            if not self.submission:
                 self.submission = self.mongo_dao.get_submission(submission_id)
            if not self.submission:
                msg = f'Invalid submission object, no related submission object found, {submission_id}!'
                self.log.error(msg)
                return STATUS_FAILED, []
            
            submission_intention = self.submission.get(SUBMISSION_INTENTION)
            # get manifest info for the submission
            manifest_info_list = self.mongo_dao.get_files_by_submission(submission_id) if submission_intention != SUBMISSION_INTENTION_DELETE else []
            if manifest_info_list is None:
                raise _RetryableFileRead(
                    f'Failed to load file records for submission {submission_id}'
                )
            manifest_file_names = [manifest_info[S3_FILE_INFO][FILE_NAME] for manifest_info in manifest_info_list]
            extra_errors = self._collect_extra_s3_file_errors(submission_id, manifest_file_names)
            if extra_errors:
                # Found orphaned files
                return STATUS_ERROR, extra_errors
            elif not manifest_info_list:
                # No file reocrds, no orphaned files
                return STATUS_ERROR, []
            else:
                # All files are validated
                return STATUS_PASSED, []

        except (errors.PyMongoError, _RetryableFileRead):
            raise
        except Exception as e:
            self.log.exception(e)
            msg = f"{submission_id}: Failed to validate data files! {get_exception_msg()}!"
            self.log.exception(msg)
            return STATUS_FAILED, []
    
    def set_status(self, record, qc_result, status, error):
        record[S3_FILE_INFO][UPDATED_AT] = current_datetime()
        if status == STATUS_ERROR:
            record[S3_FILE_INFO][STATUS] = STATUS_ERROR
            qc_result[ERRORS] = [error]
            qc_result[WARNINGS] = []
            qc_result[QC_SEVERITY] = STATUS_ERROR
            
        elif status == STATUS_WARNING: 
            record[S3_FILE_INFO][STATUS] = STATUS_WARNING
            qc_result[WARNINGS] = [error]
            qc_result[ERRORS] = []
            qc_result[QC_SEVERITY] = STATUS_WARNING
            
        else:
            record[S3_FILE_INFO][STATUS] = STATUS_PASSED
            record[S3_FILE_INFO][WARNINGS] = []
            record[S3_FILE_INFO][ERRORS] = []
            qc_result = None

    def save_qc_result(self, fileRecord, status, error):
        qc_result = None
        if not fileRecord.get(S3_FILE_INFO):
            fileRecord[S3_FILE_INFO] = {}
        if fileRecord[S3_FILE_INFO].get(QC_RESULT_ID):
            qc_result = self.mongo_dao.get_qcRecord(fileRecord[S3_FILE_INFO][QC_RESULT_ID])
        if status == STATUS_ERROR or status == STATUS_WARNING:
            if not qc_result:
                qc_result = get_qc_result(fileRecord, VALIDATION_TYPE_FILE, self.mongo_dao)
        self.set_status(fileRecord, qc_result, status, error)
        if status == STATUS_PASSED and qc_result:
            self.mongo_dao.delete_qcRecord(qc_result[ID])
            qc_result = None
            fileRecord[S3_FILE_INFO][QC_RESULT_ID] = None
        if qc_result: # save QC result
            fileRecord[S3_FILE_INFO][QC_RESULT_ID] = qc_result[ID]
            qc_result[QC_VALIDATE_DATE] = current_datetime()
            self.mongo_dao.save_qc_results([qc_result])