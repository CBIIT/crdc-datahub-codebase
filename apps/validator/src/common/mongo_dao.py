from pymongo import MongoClient, errors, ReplaceOne, UpdateOne, DeleteOne, DESCENDING, InsertOne, ReturnDocument
from bento.common.utils import get_logger
from common.constants import BATCH_COLLECTION, SUBMISSION_COLLECTION, DATA_COLLECTION, ID, UPDATED_AT, \
    SUBMISSION_ID, NODE_ID, NODE_TYPE, S3_FILE_INFO, STATUS, FILE_ERRORS, STATUS_NEW, \
    PARENT_TYPE, PARENT_ID_VAL, PARENTS, FILE_VALIDATION_STATUS, METADATA_VALIDATION_STATUS, TYPE, \
    FILE_MD5_COLLECTION, FILE_NAME, CRDC_ID, RELEASE_COLLECTION, DATA_COMMON_NAME, KEY, \
    VALUE_PROP, VALIDATED_AT, STATUS_ERROR, STATUS_WARNING, STATUS_PASSED, FAILED, PARENT_ID_NAME, \
    SUBMISSION_REL_STATUS, SUBMISSION_REL_STATUS_DELETED, STUDY_ABBREVIATION, SUBMISSION_STATUS, STUDY_ID, \
    CROSS_SUBMISSION_VALIDATION_STATUS, ADDITION_ERRORS, VALIDATION_COLLECTION, VALIDATION_ENDED, CONFIG_COLLECTION, \
    BATCH_BUCKET, CDE_COLLECTION, CDE_CODE, CDE_VERSION, ENTITY_TYPE, QC_COLLECTION, QC_RESULT_ID, CONFIG_TYPE, \
    SYNONYM_COLLECTION, PV_TERM, SYNONYM_TERM, CDE_FULL_NAME, CDE_PERMISSIVE_VALUES, PROPERTY_PERMISSIBLE_VALUES, CREATED_AT, PROPERTIES, \
    STUDY_COLLECTION, ORGANIZATION_COLLECTION, USER_COLLECTION, PV_CONCEPT_CODE_COLLECTION, CONCEPT_CODE, PERMISSIBLE_VALUE, \
    GENERATED_PROPS, \
    CONSENT_CODE, RELEASE, VERSION, PROPERTY, MODEL, \
    COMPLETED_BATCHES, FAILED_BATCHES, BATCH_STATUS_DETAILS, WORST_BATCH_STATUS, STATUS_DETAIL, \
    STATUS_PRECEDENCE, PRECEDENCE_TO_STATUS, SRF_COLLECTION, VALIDATION_STATUS
from common.utils import get_exception_msg, current_datetime, get_uuid_str
from common.s3_utils import S3Service

MAX_SIZE = 10000

class MongoDao:
    def __init__(self, connectionStr, db_name):
      """
      Opens a pymongo client. retryWrites=false is required for DocumentDB
      (also set on the URI from config.py).
      @param {str} connectionStr MongoDB-compatible URI
      @param {str} db_name Database name
      """
      self.log = get_logger("Mongo DAO")
      self.client = MongoClient(connectionStr, retryWrites=False)
      self.db_name = db_name
      self.s3_service = S3Service()
      self.props = {}
      self.concept_codes = {}
      self._pvs_by_synonym_cache = {}

    """
    get batch by id
    """
    def get_batch(self, batchId):
        db = self.client[self.db_name]
        batch_collection = db[BATCH_COLLECTION]
        try:
            return batch_collection.find_one({ID: batchId})
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find batch, {batchId}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find batch, {batchId}: {get_exception_msg()}")
            return None

    """
    find batch for uploaded data file
    """
    def find_batch_by_file_name(self, submissionID, batch_type, file_name):
        db = self.client[self.db_name]
        batch_collection = db[BATCH_COLLECTION]
        query = {
            SUBMISSION_ID: submissionID, 
            TYPE: batch_type, 
            "files.fileName": file_name,
            STATUS: "Uploaded"
        }
        try:
            results = list(batch_collection.find(query).sort("displayID", DESCENDING).limit(1))
            return results[0] if results and len(results) > 0 else None
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find batch by data file name, {submissionID}/{batch_type}/{file_name}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find batch by data file name, {submissionID}/{batch_type}/{file_name}: {get_exception_msg()}")
            return None

    """
    get submission by id

    @param submissionId submission document id
    @returns submission document, or None when it does not exist
    @raises Exception when the database read fails
    """   
    def get_submission(self, submissionId):
        db = self.client[self.db_name]
        submission_collection = db[SUBMISSION_COLLECTION]
        try:
            return submission_collection.find_one({ID: submissionId})
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find submission, {submissionId}: {get_exception_msg()}")
            raise
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find submission, {submissionId}: {get_exception_msg()}")
            raise

    """
    get validation by id

    @param validation_id validation document id
    @returns validation document, or None when it does not exist
    @raises Exception when the database read fails
    """
    def get_validation(self, validation_id):
        db = self.client[self.db_name]
        validation_collection = db[VALIDATION_COLLECTION]
        try:
            return validation_collection.find_one({ID: validation_id})
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find validation, {validation_id}: {get_exception_msg()}")
            raise
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find validation, {validation_id}: {get_exception_msg()}")
            raise


    """
    get SRF by id
    """
    def get_srf(self, srf_id):
        db = self.client[self.db_name]
        srf_collection = db[SRF_COLLECTION]
        try:
            return srf_collection.find_one({ID: srf_id})
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find SRF, {srf_id}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find SRF, {srf_id}: {get_exception_msg()}")
            return None
    """
    check node exists by node name and its value
    """
    def search_nodes_by_type_and_value(self, nodes):
        db = self.client[self.db_name]
        data_collection = db[DATA_COLLECTION]
        node_set, query = set(), []
        for node in nodes:
            node_type, node_key, node_value = node.get(TYPE), node.get(KEY), node.get(VALUE_PROP)
            if node_type and node_key and node_value is not None \
                    and (node_type, node_key, node_value) not in node_set:
                node_set.add(tuple([node_type, node_key, node_value]))
                query.append({"nodeType": node_type, "props." + node_key: node_value})
        try:
            return list(data_collection.find({"$or": query})) if len(query) > 0 else []
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to search nodes: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to search nodes: {get_exception_msg()}")
            return None

    '''
    search nodes by node type and submission id
    '''
    def search_nodes_by_type_and_submission(self, node_type, submission_id, exclusive_ids = []):
        db = self.client[self.db_name]
        data_collection = db[DATA_COLLECTION]
        try:
            node_ids = data_collection.find({NODE_TYPE: node_type, SUBMISSION_ID: submission_id, NODE_ID: {"$nin": exclusive_ids}}).distinct(NODE_ID)
            return node_ids

        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{submission_id}: Failed to search nodes: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to search nodes: {get_exception_msg()}")
            return None

    """
    check node exists by node name and its value
    """
    def search_nodes_by_index(self, nodes, submission_id):
        db = self.client[self.db_name]
        data_collection = db[DATA_COLLECTION]
        query = []
        for node in nodes:
            node_type, node_key, node_value = node.get(TYPE), node.get(KEY), node.get(VALUE_PROP)
            if node_type and node_key and node_value is not None: 
                query.append({SUBMISSION_ID: submission_id, NODE_TYPE: node_type, NODE_ID: node_value})
        try:
            return list(data_collection.find({"$or": query})) if len(query) > 0 else []
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{submission_id}: Failed to search nodes: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to search nodes: {get_exception_msg()}")
            return None

    """
    check node exists by dataCommons, nodeType and nodeID
    """
    def search_node_by_index_crdc(self, data_commons, node_type, node_id, excluded_submission_ids):
        db = self.client[self.db_name]
        data_collection = db[DATA_COLLECTION]
        try:
            
            result = data_collection.find_one({DATA_COMMON_NAME: data_commons, NODE_TYPE: node_type, NODE_ID: node_id, SUBMISSION_ID: {"$nin": excluded_submission_ids}}) 
            return result
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to search node for crdc_id: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to search node for crdc_id {get_exception_msg()}")
            return None

    """
    get file in dataRecord collection by fileId

    @param fileId dataRecord document id
    @returns file document, or None when it does not exist
    @raises Exception when the database read fails
    """ 
    def get_file(self, fileId):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            return file_collection.find_one({ID: fileId})
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find data file, {fileId}: {get_exception_msg()}")
            raise
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find data file, {fileId}: {get_exception_msg()}")
            raise

    """
    get file in dataRecord collection by fileName
    """   
    def get_file_by_name(self, fileName):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            return file_collection.find_one({"S3FileInfo.fileName": fileName})
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find data file, {fileName}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find data file, {fileName}: {get_exception_msg()}")
            return None

    """
    get file records in dataRecords collection by submissionID
    """
    def get_files_by_submission(self, submission_id):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            return list(file_collection.find({SUBMISSION_ID: submission_id, S3_FILE_INFO: {"$nin": [None, ""]}}))
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find data file for the submission, {submission_id}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find data file for the submission, {submission_id}: {get_exception_msg()}")
            return None
    
    def update_batch(self, batch):
        db = self.client[self.db_name]
        batch_collection = db[BATCH_COLLECTION]
        #update the batch 
        batch[UPDATED_AT] = current_datetime()
        # Using update_one() method for single updating.
        try:
            result = batch_collection.replace_one({ID : batch[ID]}, batch, False) 
            return result.matched_count > 0 
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to update batch, {batch[ID]}: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to update batch, {batch[ID]}: {get_exception_msg()}")
            return False

    """
    check if not duplications exist in dataRecords collection
    """    
    def check_metadata_ids(self, nodeType, ids, submission_id):
        #1. check if collection exist
        db = self.client[self.db_name]
        collection = db[DATA_COLLECTION]
        try:
            #2 check if keys existing in the collection
            result = list(collection.find({NODE_ID: {'$in': ids}, SUBMISSION_ID: submission_id, NODE_TYPE: nodeType}))
            return result 
        except errors.OperationFailure as oe: 
            self.log.exception(oe)
            self.log.exception(f"{submission_id}: Failed to query DB, {nodeType}: {get_exception_msg()}!")
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to query DB, {nodeType}: {get_exception_msg()}!")
        return True

    """
    update a file record in dataRecords collection
    """
    def update_file (self, file_record):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            result = file_collection.replace_one({ID : file_record[ID]}, file_record, False)
            return result.matched_count > 0 
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to update data file, {file_record[ID]}: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to update data file, {file_record[ID]}: {get_exception_msg()}")
            return False

    """
    update a s3 file info in dataRecords collection
    """
    def update_file_info(self, file_record):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            result = file_collection.update_one({ID : file_record[ID]}, {"$set": {S3_FILE_INFO: file_record[S3_FILE_INFO]}})
            return result.modified_count > 0 
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to update data file, {file_record[ID]}: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to update data file, {file_record[ID]}: {get_exception_msg()}")
            return False

    def _metadata_status_from_nodes(self, submission, metadata_status):
        """Resolve submission metadata status, recounting nodes unless the status is Error or New.

        @param submission submission document
        @param metadata_status status proposed by the caller
        @returns status to store on the submission
        """
        if metadata_status in (STATUS_ERROR, STATUS_NEW):
            return metadata_status
        submission_id = submission[ID]
        if self.count_docs(DATA_COLLECTION, {SUBMISSION_ID: submission_id, STATUS: STATUS_ERROR}) > 0:
            return STATUS_ERROR
        if self.count_docs(DATA_COLLECTION, {SUBMISSION_ID: submission_id, STATUS: STATUS_WARNING}) > 0:
            return STATUS_WARNING
        return metadata_status

    def _delete_cleanup_updates(self, submission, file_errors):
        """Build delete-metadata fields: clearing deletingData and file status when no file nodes remain.

        @param submission submission document
        @param file_errors file errors recorded by the delete, when any
        @returns dict of submission fields to set
        """
        updates = {"deletingData": False}
        file_nodes_remain = self.count_docs(
            DATA_COLLECTION, {SUBMISSION_ID: submission[ID], S3_FILE_INFO: {"$exists": True}},
        )
        if file_nodes_remain == 0 and not (file_errors and len(file_errors) > 0):
            updates[FILE_VALIDATION_STATUS] = STATUS_NEW if self.s3_service.submissionHasDataFile(submission) else None
        return updates

    def submission_file_status_from_records(self, submission_id, run_status):
        """Resolve file status from leftover file records and this run's worst status.

        @param submission_id submission id
        @param run_status worst file status from the current validation run
        @returns worse of the run status and stored file-node statuses
        @raises Exception when file records cannot be loaded
        """
        file_records = self.get_files_by_submission(submission_id)
        if file_records is None:
            raise Exception(f'Failed to load file records for submission {submission_id}')
        worst_status = run_status
        worst_prec = STATUS_PRECEDENCE.get(run_status, 0)
        for file_record in file_records:
            file_status = (file_record.get(S3_FILE_INFO) or {}).get(STATUS)
            file_prec = STATUS_PRECEDENCE.get(file_status)
            if file_prec is not None and file_prec > worst_prec:
                worst_status = file_status
                worst_prec = file_prec
                if worst_status == STATUS_ERROR:
                    break
        return worst_status

    def set_cross_submission_status(self, submission, status):
        """Write crossSubmissionStatus only.

        File and metadata close-out does not call this.

        @param submission submission document
        @param status cross-submission result
        @returns True when a submission document matched
        @raises Exception when the database write fails
        """
        if not submission or not submission.get(ID) or not status:
            return False
        updated_submission = {
            UPDATED_AT: current_datetime(),
            CROSS_SUBMISSION_VALIDATION_STATUS: status,
        }
        db = self.client[self.db_name]
        submission_collection = db[SUBMISSION_COLLECTION]
        try:
            result = submission_collection.update_one({ID: submission[ID]}, {"$set": updated_submission}, False)
            return result.matched_count > 0
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to update cross-submission status, {submission[ID]}: {get_exception_msg()}")
            raise
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to update cross-submission status, {submission[ID]}: {get_exception_msg()}")
            raise

    def set_submission_validation_status(self, submission, file_status, metadata_status, file_errors=None, is_delete=False, status_detail=None, scope=None):
        """Update submission fields for metadata upload and delete.

        File and metadata validation close-out does not use this method.
        Failed is not a submission metadata status and is not written.
        When scope is New, metadata status is kept when the current status is worse.

        @param submission submission document
        @param file_status file validation status to store, or None to leave it unchanged
        @param metadata_status metadata validation status to store, or None to leave it unchanged
        @param file_errors submission file errors; None leaves existing errors unchanged unless file_status is set
        @param is_delete True when this update follows a metadata delete
        @param status_detail optional status detail stored on the submission
        @param scope validation scope; New does not replace a worse metadata status
        @returns True when a submission document matched
        """
        if metadata_status == FAILED:
            metadata_status = None
        updated_submission = {UPDATED_AT: current_datetime()}
        if status_detail is not None:
            updated_submission[STATUS_DETAIL] = status_detail
        updated_submission.update(_file_validation_updates(file_status, file_errors, submission.get(VALIDATION_ENDED)))
        db = self.client[self.db_name]
        submission_collection = db[SUBMISSION_COLLECTION]
        try:
            if metadata_status:
                overall_metadata_status = None
                if not (is_delete and self.count_docs(DATA_COLLECTION, {SUBMISSION_ID: submission[ID]}) == 0):
                    overall_metadata_status = self._metadata_status_from_nodes(submission, metadata_status)
                    overall_metadata_status = _apply_new_scope_metadata_status(
                        overall_metadata_status, submission, scope,
                    )
                if is_delete:
                    updated_submission.update(self._delete_cleanup_updates(submission, file_errors))
                updated_submission[METADATA_VALIDATION_STATUS] = overall_metadata_status
                updated_submission[VALIDATION_ENDED] = submission.get(VALIDATION_ENDED)
            result = submission_collection.update_one({ID: submission[ID]}, {"$set": updated_submission}, False)
            return result.matched_count > 0
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to update submission, {submission[ID]}: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to update submission, {submission[ID]}: {get_exception_msg()}")
            return False

    """
    update data records based on node ID in dataRecords
    """
    def update_data_records(self, data_records):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            result = file_collection.bulk_write([
                ReplaceOne( {ID: m[ID]}, remove_id(m),  upsert=True)
                    for m in list(data_records)
                ])
            self.log.info(f'Total {result.upserted_count} dataRecords are upserted!')
            return True, None
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            msg = f"Failed to update metadata."
            self.log.exception(msg)
            return False, msg
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to update metadata, {get_exception_msg()}"
            self.log.exception(msg)
            return False, msg

    """
    update record's status, errors and warnings based on node ID in dataRecords
    """
    def update_data_records_status(self, data_records):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            result = file_collection.bulk_write([
                UpdateOne( {ID: m[ID]}, 
                    {"$set": {STATUS: m[STATUS], UPDATED_AT: m[UPDATED_AT], VALIDATED_AT: m[UPDATED_AT], QC_RESULT_ID: m.get(QC_RESULT_ID), PROPERTIES: m.get(PROPERTIES), GENERATED_PROPS: m.get(GENERATED_PROPS), CONSENT_CODE: m.get(CONSENT_CODE)}})
                    for m in list(data_records)
                ])
            self.log.info(f'Total {result.modified_count} dataRecords are updated!')
            return True, None
        except errors.PyMongoError as pe:
            self.log.debug(pe)
            msg = f"Failed to update metadata."
            self.log.exception(msg)
            return False, msg
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to update metadata, {get_exception_msg()}"
            self.log.exception(msg)
            return False, msg

    """
    update record's status, errors by additional error
    """
    def update_data_records_addition_error(self, data_records):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            result = file_collection.bulk_write([
                UpdateOne( {ID: m[ID]}, 
                    {"$set": {UPDATED_AT: m[UPDATED_AT], VALIDATED_AT: m[UPDATED_AT], ADDITION_ERRORS: m.get(ADDITION_ERRORS, [])}})
                    for m in list(data_records)
                ])
            self.log.info(f'Total {result.modified_count} dataRecords are updated!')
            return True, None
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            msg = f"Failed to update metadata."
            self.log.exception(msg)
            return False, msg
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to update metadata, {get_exception_msg()}"
            self.log.exception(msg)
            return False, msg

    """
    delete dataRecords by nodeIDs
    """  
    def delete_data_records(self, nodes):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            result = file_collection.bulk_write([
                DeleteOne( { SUBMISSION_ID: m[SUBMISSION_ID], NODE_ID: m[NODE_ID], NODE_TYPE: m[NODE_TYPE] })
                    for m in list(nodes)
                ])
            self.log.info(f'Total {result.deleted_count} dataRecords are deleted!')
            # delete related qcResults
            qc_ids = [node[QC_RESULT_ID] for node in nodes if node.get(QC_RESULT_ID)]
            qc_ids.extend([node[S3_FILE_INFO][QC_RESULT_ID]for node in nodes if node.get(S3_FILE_INFO) and node[S3_FILE_INFO].get(QC_RESULT_ID)])
            if qc_ids and len(qc_ids) > 0:
                self.delete_qcRecords(qc_ids)
            return True, None
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            msg = f"Failed to delete metadata, {get_exception_msg()}"
            self.log.exception(msg)
            return False, msg
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to delete metadata, {get_exception_msg()}"
            self.log.exception(msg)
            return False, msg

    """
    insert batch dataRecords
    """ 
    def insert_data_records (self, file_records):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            result = file_collection.insert_many(file_records)
            count = len(result.inserted_ids)
            self.log.info(f'Total {count} dataRecords are inserted!')
            return count > 0, None
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            msg = f"Failed to insert data records, {get_exception_msg()}"
            self.log.exception(msg)
            return False, msg
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to insert data records, {get_exception_msg()}"
            self.log.exception(msg)
            return False, msg

    """
    retrieve dataRecords by submissionID and scope either New dataRecords or All
    """
    def get_dataRecords(self, submission_id, scope):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            query = {'submissionID': {'$eq': submission_id}} 
            if scope and scope.lower() == STATUS_NEW.lower():
                query[STATUS] = STATUS_NEW
            result = list(file_collection.find(query))
            count = len(result)
            self.log.info(f'Total {count} dataRecords are found for the submission, {submission_id} and scope of {scope}!')
            return result
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{submission_id}: Failed to retrieve data records, {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to retrieve data records, {get_exception_msg()}")
            return None

    """
    retrieve dataRecord by submissionID and scope either New dataRecords or All in batch
    """
    def get_dataRecords_chunk(self, submission_id, scope, start, size):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            query = {SUBMISSION_ID: {'$eq': submission_id}} 
            if scope and scope.lower() == STATUS_NEW.lower():
                query[STATUS] = STATUS_NEW
                result = list(file_collection.find(query).sort({SUBMISSION_ID: 1, "nodeType": 1, "nodeID": 1}).limit(size))
            else:
                result = list(file_collection.find(query).sort({SUBMISSION_ID: 1, "nodeType": 1, "nodeID": 1}).skip(start).limit(size))
            return result
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{submission_id}: Failed to retrieve data records, {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to retrieve data records, {get_exception_msg()}")
            return None 

    def get_dataRecords_by_ids(self, data_record_ids):
        """Fetch data records by their _id values.

        Used for batched validation where backend specifies exact record IDs.

        An empty data_record_ids list is allowed; the query returns [].
        """
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            query = {ID: {'$in': data_record_ids}}
            result = list(file_collection.find(query))
            self.log.info(f'Found {len(result)} data records for {len(data_record_ids)} requested IDs')
            if len(result) < len(data_record_ids):
                self.log.warning(f'Partial match: found {len(result)} of {len(data_record_ids)} requested data records')
            return result
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to fetch data records by IDs: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to fetch data records by IDs: {get_exception_msg()}")
            return None

    """
    retrieve dataRecord by submissionID and nodeType
    """
    def get_dataRecords_chunk_by_nodeType(self, submission_id, node_type, start, size):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            query = {SUBMISSION_ID: {'$eq': submission_id}, NODE_TYPE: {'$eq': node_type}} 
            result = list(file_collection.find(query).sort({SUBMISSION_ID: 1, "nodeType": 1, "nodeID": 1}).skip(start).limit(size))
            return result
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{submission_id}: Failed to retrieve data records, {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to retrieve data records, {get_exception_msg()}")
            return None

    """
    retrieve dataRecord by nodeID
    """
    def get_dataRecord_by_node(self, nodeID, nodeType, submission_id):
        db = self.client[self.db_name]
        file_collection = db[DATA_COLLECTION]
        try:
            result = file_collection.find_one({SUBMISSION_ID: submission_id, NODE_ID: nodeID, NODE_TYPE: nodeType})
            return result
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{submission_id}: Failed to retrieve data record, {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to retrieve data record, {get_exception_msg()}")
            return None

    """
    find child node by type and id
    """
    def get_nodes_by_parents(self, parent_ids, submission_id):
        db = self.client[self.db_name]
        data_collection = db[DATA_COLLECTION]
        query = []
        for id in parent_ids:
            node_type, node_id = id.get(NODE_TYPE), id.get(NODE_ID)
            query.append({SUBMISSION_ID: submission_id, PARENTS: {"$elemMatch": {PARENT_TYPE: node_type, PARENT_ID_VAL: node_id}}})
        try:
            results = list(data_collection.find({"$or": query})) if len(query) > 0 else []
            return True, results
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{submission_id}: Failed to retrieve child nodes: {get_exception_msg()}")
            return False, None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to retrieve child nodes: {get_exception_msg()}")
            return False, None

    """
    find child nodes by nodeType, parentType and parentIDProperty and parentID
    """
    def get_nodes_by_parent_prop(self, node_type, parent_prop, submission_id):
        db = self.client[self.db_name]
        data_collection = db[DATA_COLLECTION]
        query = {SUBMISSION_ID: submission_id, NODE_TYPE: node_type, PARENTS: {"$elemMatch": {PARENT_TYPE: parent_prop[PARENT_TYPE], 
                        PARENT_ID_NAME: parent_prop[PARENT_ID_NAME], PARENT_ID_VAL: parent_prop[PARENT_ID_VAL]}}}
        try:
            return list(data_collection.find(query))
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{submission_id}: Failed to retrieve child nodes: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to retrieve child nodes: {get_exception_msg()}")
            return None

    """
    find node in other submission with the same study
    """   
    def find_node_in_other_submissions_in_status(self, submission_id, studyID, data_common, node_type, nodeId, status_list):
        db = self.client[self.db_name]
        data_collection = db[DATA_COLLECTION]
        try:
            submissions = None
            # Query submissions by both studyID and dataCommons for proper scoping
            query = {
                STUDY_ID: studyID, 
                SUBMISSION_STATUS: {"$in": status_list}, 
                ID: {"$ne": submission_id}
            }
            if data_common:
                query[DATA_COMMON_NAME] = data_common
            
            other_submissions = self.find_submissions(query)
            if len(other_submissions) > 0:
                other_submission_ids = [item[ID] for item in other_submissions]
                duplicate_nodes = list(data_collection.find({DATA_COMMON_NAME: data_common, NODE_TYPE: node_type, NODE_ID: nodeId, SUBMISSION_ID: {"$in": other_submission_ids}}))
                if len(duplicate_nodes) > 0:
                    other_submission_ids = [item[SUBMISSION_ID] for item in duplicate_nodes]
                    submissions = [item for item in other_submissions if item[ID] in other_submission_ids]
            return True, submissions
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{submission_id}: Failed to retrieve child nodes: {get_exception_msg()}")
            return False, None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to retrieve child nodes: {get_exception_msg()}")
            return False, None

    """
    find submission by query
    """
    def find_submissions(self, query):
        db = self.client[self.db_name]
        data_collection = db[SUBMISSION_COLLECTION]
        try:
            return list(data_collection.find(query))
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to retrieve submissions: {get_exception_msg()}")
            return False, None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to retrieve submissions:: {get_exception_msg()}")
            return False, None

    """
    set dataRecords search index, 'submissionID_nodeType_nodeID'
    """
    def set_search_index_dataRecords(self, submission_index, crdc_index, study_entity_type_index):
        db = self.client[self.db_name]
        data_collection = db[DATA_COLLECTION]
        try:
            index_dict = data_collection.index_information()
            if not index_dict.get(submission_index):
                result = data_collection.create_index([(SUBMISSION_ID), (NODE_TYPE),(NODE_ID)], \
                            name=submission_index)
            if not index_dict.get(crdc_index):
                result = data_collection.create_index([(DATA_COMMON_NAME), (NODE_TYPE),(NODE_ID)], \
                            name=crdc_index)
            if not index_dict.get(study_entity_type_index):
                result = data_collection.create_index([(STUDY_ID), (ENTITY_TYPE),(NODE_ID)], \
                            name=study_entity_type_index)
            return True
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to set search index: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to set search index: {get_exception_msg()}")
            return False

    """
    set release search index, 'dataCommons_nodeType_nodeID'
    """
    def set_search_release_index(self, dataCommon_index, crdcID_index):
        db = self.client[self.db_name]
        data_collection = db[RELEASE_COLLECTION]
        try:
            index_dict = data_collection.index_information()
            if not index_dict or not index_dict.get(dataCommon_index):
                result = data_collection.create_index([(DATA_COMMON_NAME), (NODE_TYPE),(NODE_ID)], \
                            name=dataCommon_index)
            if not index_dict or not index_dict.get(crdcID_index):
                result = data_collection.create_index([(CRDC_ID)], \
                            name=crdcID_index)
            return True
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to set search index in release collection: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to set search index in release collection: {get_exception_msg()}")
            return False

    """
    set synonym search index, 'synonym_term'
    """
    def set_search_synonym_index(self, synonym_index):
        db = self.client[self.db_name]
        data_collection = db[SYNONYM_COLLECTION]
        try:
            index_dict = data_collection.index_information()
            if not index_dict or not index_dict.get(synonym_index):
                result = data_collection.create_index([(SYNONYM_TERM)], \
                            name=synonym_index)
            return True
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to set search index in synonym collection: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to set search index in synonym collection: {get_exception_msg()}")
            return False

    """
    find cached file md5 by submissionID and fileName
    """
    def get_file_md5(self, submission_id, file_name):
        db = self.client[self.db_name]
        data_collection = db[FILE_MD5_COLLECTION]
        try:
            md5_info = data_collection.find_one({SUBMISSION_ID: submission_id, FILE_NAME: file_name})
            return md5_info
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{submission_id}: Failed to retrieve data file md5: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to retrieve data file md5: {get_exception_msg()}")
            return None

    """
    save file md5 info to fileMD5 collection
    """
    def save_file_md5(self, md5_info):
        db = self.client[self.db_name]
        data_collection = db[FILE_MD5_COLLECTION]
        try:
            result = data_collection.replace_one({ID: md5_info[ID]}, md5_info,  upsert=True)
            return (result and result.upserted_id)
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{md5_info[SUBMISSION_ID]}: Failed to save data file md5: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{md5_info[SUBMISSION_ID]}: Failed to save data file md5: {get_exception_msg()}")
            return False

    """
    get release by CRDC_ID
    """
    def get_release(self, crdc_id):
        db = self.client[self.db_name]
        data_collection = db[RELEASE_COLLECTION]
        try:
            result = data_collection.find_one({CRDC_ID: crdc_id})
            return result
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find release record for {crdc_id}: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find release record for {crdc_id}: {get_exception_msg()}")
            return False

    """
    get release by dataCommon, nodeType and nodeId
    """
    def search_release(self, dataCommon, node_type, node_id):
        db = self.client[self.db_name]
        data_collection = db[RELEASE_COLLECTION]
        try:
            result = data_collection.find_one({DATA_COMMON_NAME: dataCommon, NODE_TYPE: node_type, NODE_ID: node_id})
            return result
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find release record for {dataCommon}/{node_type}/{node_id}: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find release record for {dataCommon}/{node_type}/{node_id}: {get_exception_msg()}")
            return False

    """
    insert release 
    """
    def insert_release(self, release):
        db = self.client[self.db_name]
        data_collection = db[RELEASE_COLLECTION]
        try:
            result = data_collection.insert_one(release)
            return (result and result.inserted_id)
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to insert crdcID record: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to insert crdcID record: {get_exception_msg()}")
            return False

    """
    update release 
    """
    def update_release(self, release):
        db = self.client[self.db_name]
        data_collection = db[RELEASE_COLLECTION]
        try:
            result = data_collection.replace_one({ID: release[ID]}, release)
            return True
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to update release record: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to update release record: {get_exception_msg()}")
            return False

    def search_node(self, data_commons, node_type, node_id):
        """
        Search release collection for given node, if not found, search it in dataRecord collection
        :param data_commons:
        :param node_type:
        :param node_id:
        :return:
        """
        db = self.client[self.db_name]
        data_collection = db[RELEASE_COLLECTION]
        rtn_val = None
        try:
            
            results = list(data_collection.find({DATA_COMMON_NAME: data_commons, NODE_TYPE: node_type, NODE_ID: node_id}))
            released_nodes = [node for node in results if node.get(SUBMISSION_REL_STATUS) != SUBMISSION_REL_STATUS_DELETED ]
            if len(released_nodes) == 0:
                # search dataRecords
                deleted_submission_ids = [rel[SUBMISSION_ID] for rel in results if rel.get(SUBMISSION_REL_STATUS) == SUBMISSION_REL_STATUS_DELETED ]
                rtn_val = self.search_node_by_index_crdc(data_commons, node_type, node_id, deleted_submission_ids)
            else:
                rtn_val = released_nodes[0]
            return rtn_val
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find release record for {data_commons}/{node_type}/{node_id}: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find release record for {data_commons}/{node_type}/{node_id}: {get_exception_msg()}")
            return False
        
    def search_node_by_study(self, studyID, entity_type, node_id):
        """
        Search release collection for given node, if not found, search it in dataRecord collection
        :param studyID:
        :param node_type:
        :param node_id:
        :return:
        """
        db = self.client[self.db_name]
        data_collection = db[DATA_COLLECTION]
        try:
            return data_collection.find_one({STUDY_ID: studyID, ENTITY_TYPE: entity_type, NODE_ID: node_id})
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to search node for study: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to search node for study {get_exception_msg()}")
            return None

    def search_released_node(self, data_commons, node_type, node_id):
        """
        Search release collection for given node
        :param data_commons:
        :param node_type:
        :param node_id:
        :return:
        """
        db = self.client[self.db_name]
        data_collection = db[RELEASE_COLLECTION]
        try:
            return data_collection.find_one({DATA_COMMON_NAME: data_commons, NODE_TYPE: node_type, NODE_ID: node_id})
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find release record for {data_commons}/{node_type}/{node_id}: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find release record for {data_commons}/{node_type}/{node_id}: {get_exception_msg()}")
            return False
   
    def search_released_node_with_status(self, data_commons, node_type, node_id, status):
        """
        Search release collection for given node with status
        :param data_commons:
        :param node_type:
        :param node_id:
        :return:
        """
        db = self.client[self.db_name]
        data_collection = db[RELEASE_COLLECTION]
        try:
            return data_collection.find_one({DATA_COMMON_NAME: data_commons, NODE_TYPE: node_type, NODE_ID: node_id, SUBMISSION_REL_STATUS: {"$in": status}})
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find release record for {data_commons}/{node_type}/{node_id}: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find release record for {data_commons}/{node_type}/{node_id}: {get_exception_msg()}")
            return False

    """
    find child node by type and id
    """
    def get_released_nodes_by_parent_with_status(self, datacommon, parent, status, submission_id):
        db = self.client[self.db_name]
        data_collection = db[RELEASE_COLLECTION]
        query = []
        node_type, node_id = parent.get(NODE_TYPE), parent.get(NODE_ID)
        query.append({DATA_COMMON_NAME: datacommon, PARENTS: {"$elemMatch": {PARENT_TYPE: node_type, PARENT_ID_VAL: node_id}}, SUBMISSION_REL_STATUS : {"$in": status}})
        try:
            results = list(data_collection.find({"$or": query})) if len(query) > 0 else []
            return True, results
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"{submission_id}: Failed to retrieve child releases: {get_exception_msg()}")
            return False, None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"{submission_id}: Failed to retrieve child releases: {get_exception_msg()}")
            return False, None
    
    def find_released_nodes_by_parent(self, node_type, data_commons, parent_node):
        """
        find released certain type children nodes by parent
        :param node_type:
        :param data_commons:
        :param parent_node:
        :return:
        """
        db = self.client[self.db_name]
        data_collection = db[RELEASE_COLLECTION]
        try:
            return list(data_collection.find({DATA_COMMON_NAME: data_commons, NODE_TYPE: node_type, PARENTS: {"$elemMatch": {PARENT_TYPE: parent_node[PARENT_TYPE], 
                        PARENT_ID_NAME: parent_node[PARENT_ID_NAME], PARENT_ID_VAL: parent_node[PARENT_ID_VAL]}}}))

        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to find release record for {data_commons}/{parent_node[PARENT_TYPE]}/{parent_node[PARENT_ID_VAL]}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to find release record for {data_commons}/{parent_node[PARENT_TYPE]}/{parent_node[PARENT_ID_VAL]}: {get_exception_msg()}")
            return None

    """
    count documents in a given collection and conditions 
    """  
    def count_docs(self, collection, query):
        db = self.client[self.db_name]
        data_collection = db[collection]
        try:
            return data_collection.count_documents(query)
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to count documents for collection, {collection} at conditions {query}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to count documents for collection, {collection} at conditions {query}")
            return False

    def increment_completed_batches(self, validation_id, total_batches,
                                    batch_failed=False, batch_status=None, status_detail=None,
                                    submission_id=None, batch_index=None):
        """Atomically increment completedBatches counter for a validation.

        When batch_failed is True, also increments failedBatches.
        When batch_status is provided, tracks the worst status via $max.
        When status_detail is provided, appends it to batchStatusDetails via $push.

        submission_id and batch_index are optional; when provided (e.g. by batched
        metadata validation), they are included in log messages.

        Returns 5-tuple: (completed_count, is_last_batch, failed_count,
                          worst_status_str, batch_details).
        """
        db = self.client[self.db_name]
        validation_collection = db[VALIDATION_COLLECTION]
        log_ctx = f'validation_id={validation_id}'
        if submission_id is not None:
            log_ctx += f' submission_id={submission_id}'
        if batch_index is not None:
            log_ctx += f' batch={batch_index + 1}/{total_batches}'
        try:
            inc_fields = {COMPLETED_BATCHES: 1}
            if batch_failed:
                inc_fields[FAILED_BATCHES] = 1
            update_ops = {'$inc': inc_fields}
            if batch_status is not None:
                if batch_status not in STATUS_PRECEDENCE:
                    self.log.warning(f"Unknown batch_status '{batch_status}', treating as worst (Error)")
                precedence = STATUS_PRECEDENCE.get(batch_status, STATUS_PRECEDENCE[STATUS_ERROR])
                update_ops['$max'] = {WORST_BATCH_STATUS: precedence}
            if status_detail:
                update_ops['$push'] = {BATCH_STATUS_DETAILS: status_detail}
            result = validation_collection.find_one_and_update(
                {ID: validation_id},
                update_ops,
                return_document=ReturnDocument.AFTER
            )
            if result:
                completed = result.get(COMPLETED_BATCHES, 0)
                failed = result.get(FAILED_BATCHES, 0)
                is_last = completed >= total_batches
                worst = PRECEDENCE_TO_STATUS.get(result.get(WORST_BATCH_STATUS, 0), STATUS_PASSED)
                details = result.get(BATCH_STATUS_DETAILS, [])
                self.log.info(f'Validation {log_ctx}: completed {completed}/{total_batches} batches, {failed} failed')
                return completed, is_last, failed, worst, details
            else:
                self.log.error(f'Validation document not found: {log_ctx}')
                return None, False, 0, None, []
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to increment completed batches for {log_ctx}: {get_exception_msg()}")
            return None, False, 0, None, []
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to increment completed batches for {log_ctx}: {get_exception_msg()}")
            return None, False, 0, None, []

    def atomic_update_validation(self, validation_id, updates, expected_status=None):
        """Atomically update a validation document.

        @param validation_id validation document id
        @param updates operator document or field dict converted to $set
        @param expected_status when set, match only a document with this status
        @returns updated validation document, or None when no document matched
        """
        update_ops = ensure_update_ops(updates)
        query = {ID: validation_id}
        if expected_status is not None:
            query[VALIDATION_STATUS] = expected_status

        db = self.client[self.db_name]
        data_collection = db[VALIDATION_COLLECTION]
        return data_collection.find_one_and_update(query, update_ops, return_document=ReturnDocument.AFTER)

    def atomic_update_submission(self, submission_id: str, updates: dict):
        update_ops = ensure_update_ops(updates)

        db = self.client[self.db_name]
        data_collection = db[SUBMISSION_COLLECTION]
        return data_collection.find_one_and_update({ID: submission_id}, update_ops, return_document=ReturnDocument.AFTER)

    """
    get bucket name based on dataCommons and type
    """   
    def get_bucket_name(self, type, dataCommon):
        db = self.client[self.db_name]
        data_collection = db[CONFIG_COLLECTION]
        try:
            result = data_collection.find_one({TYPE: type, DATA_COMMON_NAME: dataCommon})
            if result:
                return result.get(BATCH_BUCKET)
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to get bucket name: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to get bucket name: {get_exception_msg()}")
            return None

    def insert_cde(self, cde_list):
        db = self.client[self.db_name]
        data_collection = db[CDE_COLLECTION]
        try:
            result = data_collection.bulk_write([
                ReplaceOne( {ID: m[ID]}, remove_id(m),  upsert=True)
                    for m in list(cde_list)
                ])
            self.log.info(f'Total {result.upserted_count} CDE PV are upserted!')
            return True, None
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            msg = f"Failed to upsert CDE PV ."
            self.log.exception(msg)
            return False, msg
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to upsert CDE PV, {get_exception_msg()}"
            self.log.exception(msg)
            return False, msg 
    
    def upsert_property_pv(self, prop_list):
        db = self.client[self.db_name]
        data_collection = db["propertyPVs"]
        commands = []
        try:
            for m in list(prop_list):
                query = {PROPERTY: m[PROPERTY], VERSION: m[VERSION], MODEL: m[MODEL]}
                property = data_collection.find_one(query)
                if property:
                    property[UPDATED_AT] = current_datetime()
                    property[PROPERTY_PERMISSIBLE_VALUES] = m[PROPERTY_PERMISSIBLE_VALUES]
                    commands.append(UpdateOne({ID: property[ID]}, {"$set": property}))
                else:
                    m[CREATED_AT] = current_datetime()
                    m[UPDATED_AT] = current_datetime()
                    m[ID] = get_uuid_str()
                    commands.append(InsertOne(m))
            if len(commands) > 0:
                result = data_collection.bulk_write(commands)
            self.log.info(f'Total {result.inserted_count} property PV are inserted and {result.modified_count} property PV are updated.')
            return True, None
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            msg = f"Failed to upsert property PV ."
            self.log.exception(msg)
            return False, msg
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to upsert property PV, {get_exception_msg()}"
            self.log.exception(msg)
            return False, msg

    def upsert_cde(self, cde_list):
        db = self.client[self.db_name]
        data_collection = db[CDE_COLLECTION]
        commands = []
        try:
            for m in list(cde_list):
                query = {CDE_CODE: m[CDE_CODE], CDE_VERSION: m[CDE_VERSION]}
                cde = data_collection.find_one(query)
                if cde:
                    cde[UPDATED_AT] = current_datetime()
                    cde[CDE_FULL_NAME] = m[CDE_FULL_NAME]
                    cde[CDE_PERMISSIVE_VALUES] = m[CDE_PERMISSIVE_VALUES]
                    commands.append(UpdateOne({ID: cde[ID]}, {"$set": cde}))
                else:
                    m[CREATED_AT] = current_datetime()
                    m[UPDATED_AT] = current_datetime()
                    m[ID] = get_uuid_str()
                    commands.append(InsertOne(m))
            if len(commands) > 0:
                result = data_collection.bulk_write(commands)
            self.log.info(f'Total {result.inserted_count} CDE PV are inserted and {result.modified_count} CDE PV are updated.')
            return True, None
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            msg = f"Failed to upsert CDE PV ."
            self.log.exception(msg)
            return False, msg
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to upsert CDE PV, {get_exception_msg()}"
            self.log.exception(msg)
            return False, msg

    """
    set CDE search index, 'CDECode_1_CDEVersion_1'
    """
    def set_search_cde_index(self, cde_search_index):
        db = self.client[self.db_name]
        data_collection = db[CDE_COLLECTION]
        try:
            index_dict = data_collection.index_information()
            if not index_dict or not index_dict.get(cde_search_index):
                result = data_collection.create_index([(CDE_CODE), (CDE_VERSION)], \
                            name=cde_search_index)
            return True
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to set search index in CDE collection: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to set search index in CDE collection: {get_exception_msg()}")
            return False

    """
    get CDE permissible values
    """    
    def get_cde_permissible_values(self, cde_code, cde_version):
        db = self.client[self.db_name]
        data_collection = db[CDE_COLLECTION]
        query = {CDE_CODE: cde_code}
        if cde_version:
            query[CDE_VERSION] = cde_version
        try:
            return data_collection.find_one(query, sort=[( CDE_VERSION, DESCENDING )])  #find latest version 
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to get permissible values for {cde_code}/{cde_version}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to get permissible values for {cde_code}/{cde_version}: {get_exception_msg()}")
            return None
    
    def get_property_permissible_values(self, model, version, prop):
        prop_key = f"{model}_{version}_{prop}"
        if self.props.get(prop_key) is not None:
            return self.props.get(prop_key)
        db = self.client[self.db_name]
        data_collection = db["propertyPVs"]
        query = {PROPERTY: prop, VERSION: version, MODEL: model}
        try:
            property_result = data_collection.find_one(query, sort=[( VERSION, DESCENDING )])  #find latest version 
            self.props[prop_key] = property_result
            return property_result
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to get permissible values for {prop}/{version}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to get permissible values for {prop}/{version}: {get_exception_msg()}")
            return None

    """
    get qc record by qc_id
    :param qc_id:
    """
    def get_qcRecord(self, qc_id):
        db = self.client[self.db_name]
        data_collection = db[QC_COLLECTION]
        try:
            return data_collection.find_one({ID: qc_id})
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to get qc record for {qc_id}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to get qc record for {qc_id}: {get_exception_msg()}")
            return None

    """
    delete qc record by qc_id
    :param qc_id:
    """   
    def delete_qcRecord(self, qc_id):
        db = self.client[self.db_name]
        data_collection = db[QC_COLLECTION]
        try:
            result = data_collection.delete_one({ID: qc_id})
            return True if result.deleted_count > 0 else False
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to delete qc record for {qc_id}: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to delete qc record for {qc_id}: {get_exception_msg()}")
            return False

    """
    delete qc records by qc_id list
    :param qc_id:
    """   
    def delete_qcRecords(self, qc_ids):
        db = self.client[self.db_name]
        data_collection = db[QC_COLLECTION]
        try:
            result = data_collection.delete_many({ID: {"$in": qc_ids}})
            return True if result.deleted_count > 0 else False
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to delete qc records for {qc_ids}: {get_exception_msg()}")
            return False
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to delete qc records for {qc_ids}: {get_exception_msg()}")
            return False

    """
    save  rt qc records
    :param qc_list:
    """   
    def save_qc_results(self, qc_list):
        db = self.client[self.db_name]
        data_collection = db[QC_COLLECTION]
        try:
            result = data_collection.bulk_write([
                ReplaceOne({ID: m[ID]}, remove_id(m), upsert=True)
                    for m in list(qc_list)
                ])
            self.log.info(f'Total {result.upserted_count} QC records are upserted!')
            return True, None
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            msg = f"Failed to upsert QC records ."
            self.log.exception(msg)
            return False, msg
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to upsert QC records, {get_exception_msg()}"
            self.log.exception(msg)
            return False, msg

    """
    get configuration by env var
    :param env_var:
    """    
    def get_configuration_by_ev_var(self, env_var_list):
        db = self.client[self.db_name]
        data_collection = db[CONFIG_COLLECTION]
        query = {CONFIG_TYPE: {"$in": env_var_list}}
        try:
            return list(data_collection.find(query))
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to get configurations for {env_var_list}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to get configurations for {env_var_list}: {get_exception_msg()}")
            return None

    """
    find synonym records in synonyms collection by synonym term.
    Stored synonym terms are lowercase; lookup normalizes the input the same way as ingest (strip + lower).
    :param synonym:
    """   
    def find_pvs_by_synonym(self, synonym):
        term = str(synonym).strip().lower()
        if not term:
            return []
        if term in self._pvs_by_synonym_cache:
            return list(self._pvs_by_synonym_cache[term])
        db = self.client[self.db_name]
        data_collection = db[SYNONYM_COLLECTION]
        query = {SYNONYM_TERM: term}
        try:
            results = list(data_collection.find(query))
            self._pvs_by_synonym_cache[term] = results
            return list(results)
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to get synonyms for {synonym}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to get synonyms for {synonym}: {get_exception_msg()}")
            return None

    """
    upsert synonym records
    :param synonym_list
    """
    def insert_synonyms(self, synonym_list):
        db = self.client[self.db_name]
        data_collection = db[SYNONYM_COLLECTION]
        to_insert = []
        try:
            for item in synonym_list:
                synonym = {SYNONYM_TERM: item[0], PV_TERM: item[1]}
                # check if synonym exists
                existing_synonym = data_collection.find_one(synonym)
                if existing_synonym:
                    continue
                to_insert.append({ID: get_uuid_str(),  **synonym})

            if len(to_insert) == 0:
                return 0
            result = data_collection.insert_many(to_insert)
            return len(result.inserted_ids)
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            msg = f"Failed to upsert synonyms ."
            self.log.exception(msg)
            return None
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to upsert synonyms, {get_exception_msg()}"
            self.log.exception(msg)
            return None

    """
    upsert pv concept codes
    :param concept_codes
    """
    def insert_concept_codes(self, concept_codes):
        db = self.client[self.db_name]
        data_collection = db[PV_CONCEPT_CODE_COLLECTION]
        to_insert = []
        try:
            for item in concept_codes:
                concept_code = {CDE_CODE: item[0], PERMISSIBLE_VALUE: item[1], CONCEPT_CODE: item[2]}
                # check if synonym exists
                existing_concept_code = data_collection.find_one(concept_code)
                if existing_concept_code:
                    continue
                to_insert.append({ID: get_uuid_str(),  **concept_code})

            if len(to_insert) == 0:
                return 0
            result = data_collection.insert_many(to_insert)
            return len(result.inserted_ids)
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            msg = f"Failed to upsert concept code, {get_exception_msg()}"
            self.log.exception(msg)
            return None
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to upsert concept code, {get_exception_msg()}"
            self.log.exception(msg)
            return None

    def insert_concept_codes_v2(self, concept_codes):
        db = self.client[self.db_name]
        data_collection = db[PV_CONCEPT_CODE_COLLECTION]
        to_insert = []
        try:
            for item in concept_codes:
                concept_code = {MODEL: item[0], PROPERTY: item[1], PERMISSIBLE_VALUE: item[2], CONCEPT_CODE: item[3]}
                # check if synonym exists
                existing_concept_code = data_collection.find_one(concept_code)
                if existing_concept_code:
                    continue
                to_insert.append({ID: get_uuid_str(),  **concept_code})

            if len(to_insert) == 0:
                return 0
            result = data_collection.insert_many(to_insert)
            return len(result.inserted_ids)
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            msg = f"Failed to upsert concept code, {get_exception_msg()}"
            self.log.exception(msg)
            return None
        except Exception as e:
            self.log.exception(e)
            msg = f"Failed to upsert concept code, {get_exception_msg()}"
            self.log.exception(msg)
            return None

    """
    get concept code by pv
    :param pv
    """   
    def get_concept_code_by_pv(self, property, model, pv):
        pv_key = f"{property}_{model}_{pv}"
        if self.concept_codes.get(pv_key) is not None:
            return self.concept_codes.get(pv_key)
        db = self.client[self.db_name]
        data_collection = db[PV_CONCEPT_CODE_COLLECTION]
        query = {PROPERTY: property, MODEL: model, PERMISSIBLE_VALUE: pv}
        try:
            pv_result = data_collection.find_one(query)
            self.concept_codes[pv_key] = pv_result
            return pv_result
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to get concept code for {pv}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to get concept code for {pv}: {get_exception_msg()}")
            return None

    """
    find study by study_id
    :param study_id
    """
    def find_study_by_id(self, study_id):
        db = self.client[self.db_name]
        data_collection = db[STUDY_COLLECTION]
        query = {ID: study_id}
        try:
            return data_collection.find_one(query)
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to get study for {study_id}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to get study for {study_id}: {get_exception_msg()}")
            return None

    """
    find organization name by study_id
    :param study_id
    """   
    def find_organization_name_by_study_id(self, study_id):
        db = self.client[self.db_name]
        study_data_collection = db[STUDY_COLLECTION]
        program_data_collection = db[ORGANIZATION_COLLECTION]
        study_query = {ID: study_id}

        try:
            study_result = study_data_collection.find_one(study_query)
            if not study_result:
                self.log.error(f"No study found for study_id: {study_id}")
                return None
            program_id = study_result.get("programID")
            program_query = {ID: program_id}
            program_result = program_data_collection.find_one(program_query)
            if program_result is not None:
                return [program_result.get('name')]
            else:
                return None
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to get organization for {study_id}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to get organization for {study_id}: {get_exception_msg()}")
            return None

    """
    find user name by id
    :param id
    """   
    def find_user_by_id(self, id):
        db = self.client[self.db_name]
        data_collection = db[USER_COLLECTION]
        query = {"_id": id}
        try:
            return data_collection.find_one(query)
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to get user by {id}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to get user for {id}: {get_exception_msg()}")
            return None

    def find_grandparent_by_parent(self, parentType, parentIDValue, submissionID, dataCommon):
        db = self.client[self.db_name]
        data_collection = db[DATA_COLLECTION]
        query = {SUBMISSION_ID: submissionID, NODE_TYPE: parentType, NODE_ID: parentIDValue}
        data_collection_release = db[RELEASE]
        query_release = {DATA_COMMON_NAME: dataCommon, NODE_TYPE: parentType, NODE_ID: parentIDValue}
        try:
            result = data_collection.find_one(query)
            if result is not None:
                if result.get(PARENTS) and len(result[PARENTS]) > 0:
                    # convert parent to tuple (parentType, parentIDPropName, parentIDValue)
                    return [(parent.get(PARENT_TYPE), parent.get(PARENT_ID_NAME), parent.get(PARENT_ID_VAL)) for parent in result[PARENTS]]
            # if the parent can not be found in the same submission
            result_release = data_collection_release.find_one(query_release)
            if result_release is not None:
                if result_release.get(PARENTS) and len(result_release[PARENTS]) > 0:
                    return [(parent_release.get(PARENT_TYPE), parent_release.get(PARENT_ID_NAME), parent_release.get(PARENT_ID_VAL)) for parent_release in result_release[PARENTS]]
            return None
        except errors.PyMongoError as pe:
            self.log.exception(pe)
            self.log.exception(f"Failed to get grandparent for {parentIDValue}: {get_exception_msg()}")
            return None
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to get grandparent for {parentIDValue}: {get_exception_msg()}")
            return None

def _file_validation_updates(file_status, file_errors, validation_ended):
    """Build submission fields for a file status or fileErrors update.

    @param file_status file validation status, or None when only errors are updated
    @param file_errors file error list; None leaves errors unchanged unless file_status is set
    @param validation_ended validation ended time copied when file status is set
    @returns dict of submission fields
    """
    updated = {}
    if file_status:
        updated[FILE_VALIDATION_STATUS] = None if file_status == "None" else file_status
        updated[VALIDATION_ENDED] = validation_ended
        updated[FILE_ERRORS] = file_errors if file_errors else []
    elif file_errors is not None:
        updated[FILE_ERRORS] = file_errors if file_errors else []
    return updated


def _apply_new_scope_metadata_status(overall_metadata_status, submission, scope):
    """Keep a worse existing metadata status when scope is New.

    Validating and New are transient and are not treated as a prior result.
    Missing current status is treated as Passed.

    @param overall_metadata_status status about to be written
    @param submission submission document
    @param scope validation scope
    @returns status to write
    """
    if not (scope and str(scope).lower() == "new" and overall_metadata_status is not None):
        return overall_metadata_status
    current_status = submission.get(METADATA_VALIDATION_STATUS)
    if current_status in (STATUS_NEW, None, "Validating"):
        return overall_metadata_status
    new_prec = STATUS_PRECEDENCE.get(overall_metadata_status, 0)
    current_prec = STATUS_PRECEDENCE.get(current_status, 0)
    if new_prec < current_prec:
        return current_status
    return overall_metadata_status


def remove_id (data_record):
    """Remove _id from records for update."""
    data = {}
    for k in data_record.keys():
        if k == ID:
            continue
        data[k] = data_record[k]
    return data

"""
    Return update operations wrapped in $set operation if it contains non-operation keys
"""
def ensure_update_ops(updates: dict) -> dict:
    result = {}
    set_ops = {}
    for key, value in updates.items():
        if key.startswith('$'):
            result[key] = value
        else:
            set_ops[key] = value
    if len(set_ops) > 0:
        result['$set'] = set_ops
    return result