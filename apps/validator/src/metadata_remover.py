#!/usr/bin/env python3
import pandas as pd
import numpy as np
import re
import json
import os
from bento.common.utils import get_logger
from bento.common.s3 import S3Bucket
from common.constants import (
    DATA_COMMON_NAME, NODE_ID, FILE_NAME, MODEL_VERSION, ROOT_PATH,
    SUBMISSION_ID, NODE_TYPE, S3_FILE_INFO, BATCH_BUCKET, PARENT_TYPE, PARENT_ID_VAL, PARENTS, ID, TYPE,
    DATA_FILE_TYPE, S3_LIST_ORPHANS_PAGE_SIZE,
    SUBMITTED_ID, QC_VALIDATION_TYPE, BATCH_ID, DISPLAY_ID, QC_SEVERITY,
    UPLOADED_DATE, QC_VALIDATE_DATE, ERRORS, STATUS_ERROR, WARNINGS,
    NODE_IDS, DELETE_ALL, EXCLUSIVE_IDS, DELETE_ORPHANED_DATA_FILES, PENDING_METADATA_DELETE,
    LATEST_BATCH_ID,
)
from common.utils import get_exception_msg, create_error, current_datetime, get_uuid_str


def _chunks(items, size):
    """Yield lists of at most `size` items.

    @param items sequence to split
    @param size maximum chunk length
    @returns generator of lists
    """
    batch = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def _dao_write_ok(result):
    """True when a dataRecords write succeeded.

    MongoDao returns (succeeded, message). A bare boolean is also accepted.

    @param result DAO write result
    @returns True when the write succeeded
    """
    if isinstance(result, tuple):
        return bool(result) and result[0] is True
    return bool(result)

"""
Process delete metadata requests.
"""
class MetadataRemover:
    
    def __init__(self, mongo_dao, model_store):
        self.fileList = [] #list of files object {file_name, file_path, file_size, invalid_reason}
        self.errors = []
        self.log = get_logger('Essential Validator')
        self.mongo_dao = mongo_dao
        self.model_store = model_store
        self.datacommon = None
        self.model = None
        self.submission = None
        self.submission_id = None
        self.root_path = None
        self.bucket = None
        self.def_file_nodes = None
        self.delete_incomplete = False

    def remove_metadata(self, submission_id, node_type, node_ids, delete_orphaned_data_files=False, delete_all=False, exclusive_ids=None):
        """
        Delete metadata dataRecords for the given submission / node type / ids.

        delete_orphaned_data_files:
            False (default): Remove Mongo dataRecords only (including cascaded children).
                Do not delete S3 objects for removed file nodes; orphan scan still emits F008
                for unreferenced keys and does not delete them from S3.
            True: Also delete S3 objects for removed file nodes and their descendant file
                nodes during the cascade. The orphan scan still emits F008 for other
                unreferenced keys and does not delete them.

        The orphan scan runs before metadata is deleted on the first pass. A scan that
        cannot list or build F008 rows sets delete_incomplete and leaves the records
        in place. A failed delete stores pendingMetadataDelete (the request only) so a
        later delivery can finish the cascade from the records that remain.
        F008 rows are written to qcResults after the cascade succeeds.

        @param submission_id submission document id
        @param node_type requested node type
        @param node_ids requested node ids
        @param delete_orphaned_data_files True when associated data files are deleted
        @param delete_all True when every node of the type is requested
        @param exclusive_ids node ids excluded from a delete-all request
        @returns (succeeded, F008 errors)
        """
        self.delete_incomplete = False
        msg = None
        try:
            #1 validate submission
            submission = self.mongo_dao.get_submission(submission_id)
            if not submission:
                msg = f'Invalid submission, no record found, {submission_id}!'
                self.log.error(msg)
                return (False, [])
            if not submission.get(DATA_COMMON_NAME):
                msg = f'Invalid submission, missing {DATA_COMMON_NAME}, {submission_id}!'
                self.log.error(msg)
                return (False, [])
            self.submission = submission
            self.datacommon = submission.get(DATA_COMMON_NAME)
            self.submission_id  = submission_id
            self.root_path = submission.get(ROOT_PATH)
            model_version = submission.get(MODEL_VERSION) 
            self.model = self.model_store.get_model_by_data_common_version(self.datacommon, model_version)
            if not self.model.model or not self.model.get_nodes():
                msg = f'{self.datacommon} model version "{model_version}" is not available.'
                self.log.error(msg)
                return (False, [])
            self.def_file_nodes = self.model.get_file_nodes()
            self.bucket = S3Bucket(submission.get(BATCH_BUCKET))
            pending = submission.get(PENDING_METADATA_DELETE)
            if self._plan_matches(pending, node_type, node_ids, delete_all, exclusive_ids, delete_orphaned_data_files):
                return self._resume_pending_delete(pending, submission_id, delete_orphaned_data_files)
            if isinstance(pending, dict):
                self.log.error(
                    f'{submission_id}: pending metadata delete does not match this message; '
                    f'redeliver the matching delete or clear pendingMetadataDelete before retrying'
                )
                self.delete_incomplete = True
                return False, []
            roots = self._roots_for_request(node_type, node_ids, delete_all, exclusive_ids)
            if roots is None:
                self.delete_incomplete = True
                return False, []
            if len(roots) == 0:
                return (False, [])
            # A scan that cannot list fails before any metadata is deleted.
            if not self.bucket or not self.root_path:
                self.delete_incomplete = True
                return (False, [])
            removed_file_names = self._file_names_removed_by_delete(roots)
            try:
                orphan_errors = self._find_orphaned_files_and_build_errors(
                    submission_id, delete_orphaned_data_files, removed_file_names
                )
            except Exception:
                self.delete_incomplete = True
                self.log.exception(f'Failed to scan orphaned files before delete, {get_exception_msg()}!')
                return False, []
            plan = self._identity_plan(node_type, node_ids, delete_all, exclusive_ids, delete_orphaned_data_files)
            if not self._store_plan(plan):
                self.delete_incomplete = True
                return False, []
            if not self._delete_request_roots(node_type, node_ids, delete_all, exclusive_ids, delete_orphaned_data_files):
                self.delete_incomplete = True
                return (False, [])
            orphan_errors = self._find_orphaned_files_and_build_errors(
                submission_id, delete_orphaned_data_files, None
            )
            if not self._persist_orphan_errors(submission_id, orphan_errors):
                self.delete_incomplete = True
                return False, []
            if not self._clear_plan():
                return False, []
            return True, orphan_errors
        except Exception:
            self.delete_incomplete = True
            self.log.exception(f'Failed to delete metadata, {get_exception_msg()}!')
            return False, []

    def _identity_plan(self, node_type, node_ids, delete_all, exclusive_ids, delete_orphaned_data_files):
        """Request identity stored on the submission. Does not include the cascade.

        @param node_type requested node type
        @param node_ids requested node ids
        @param delete_all True when every node of the type is requested
        @param exclusive_ids node ids excluded from a delete-all request
        @param delete_orphaned_data_files True when associated data files are deleted
        @returns plan document
        """
        return {
            NODE_TYPE: node_type,
            NODE_IDS: [] if delete_all else list(node_ids or []),
            DELETE_ALL: bool(delete_all),
            EXCLUSIVE_IDS: list(exclusive_ids or []),
            DELETE_ORPHANED_DATA_FILES: bool(delete_orphaned_data_files),
        }

    def _plan_matches(self, plan, node_type, node_ids, delete_all, exclusive_ids, delete_orphaned_data_files):
        """True when the stored plan is this delete request.

        A delete-all plan matches on type, flags, and exclusive ids. The expanded
        node id list is not part of that identity.

        @param plan pendingMetadataDelete value
        @param node_type requested node type
        @param node_ids requested node ids
        @param delete_all True when every node of the type is requested
        @param exclusive_ids node ids excluded from a delete-all request
        @param delete_orphaned_data_files True when associated data files are deleted
        @returns True when the plan should be resumed
        """
        if not isinstance(plan, dict):
            return False
        if plan.get(NODE_TYPE) != node_type:
            return False
        if bool(plan.get(DELETE_ALL)) != bool(delete_all):
            return False
        if bool(plan.get(DELETE_ORPHANED_DATA_FILES)) != bool(delete_orphaned_data_files):
            return False
        if set(plan.get(EXCLUSIVE_IDS) or []) != set(exclusive_ids or []):
            return False
        if delete_all:
            return True
        return set(plan.get(NODE_IDS) or []) == set(node_ids or [])

    def _store_plan(self, plan):
        """Remember the delete plan on the submission before the first write.

        @param plan request identity
        @returns True when the plan was stored
        """
        stored = self.mongo_dao.set_pending_metadata_delete(self.submission.get(ID), plan) is not False
        if stored and isinstance(self.submission, dict):
            self.submission[PENDING_METADATA_DELETE] = plan
        return stored

    def _clear_plan(self):
        """Drop the delete plan after the cascade and orphan scan finish.

        @returns False when the plan is still stored
        """
        cleared = self.mongo_dao.set_pending_metadata_delete(self.submission_id, None) is not False
        if not cleared:
            self.delete_incomplete = True
            return False
        if isinstance(self.submission, dict):
            self.submission.pop(PENDING_METADATA_DELETE, None)
        return True

    def _roots_for_request(self, node_type, node_ids, delete_all, exclusive_ids):
        """Root nodes for this delete request.

        Delete-all resolves ids in memory via search_nodes_by_type_and_submission;
        they are not stored on pendingMetadataDelete. None means the load failed.

        @param node_type requested node type
        @param node_ids requested node ids
        @param delete_all True when every node of the type is requested
        @param exclusive_ids node ids excluded from a delete-all request
        @returns root nodes, or None when the load failed
        """
        if not delete_all:
            nodes = self.validate_data(self.submission_id, node_type, node_ids)
            return [] if nodes is None else nodes
        ids = self.mongo_dao.search_nodes_by_type_and_submission(
            node_type, self.submission_id, exclusive_ids or []
        )
        if ids is None:
            return None
        if len(ids) == 0:
            return []
        nodes = self.mongo_dao.check_metadata_ids(node_type, ids, self.submission_id)
        return nodes or []

    def _delete_request_roots(self, node_type, node_ids, delete_all, exclusive_ids, delete_orphaned_data_files):
        """Delete root nodes that still match this request.

        @param node_type requested node type
        @param node_ids requested node ids
        @param delete_all True when every node of the type is requested
        @param exclusive_ids node ids excluded from a delete-all request
        @param delete_orphaned_data_files True when associated data files are deleted
        @returns True when the delete succeeded or nothing remained
        """
        roots = self._roots_for_request(node_type, node_ids, delete_all, exclusive_ids)
        if roots is None:
            return False
        if not roots:
            return True
        return self.delete_nodes(roots, delete_orphaned_data_files)

    def _resume_pending_delete(self, plan, submission_id, delete_orphaned_data_files):
        """Finish a delete whose roots may already be gone.

        @param plan stored pendingMetadataDelete
        @param submission_id submission document id
        @param delete_orphaned_data_files True when associated data files are deleted
        @returns (succeeded, F008 errors)
        """
        if not self.bucket or not self.root_path:
            self.delete_incomplete = True
            return False, []
        try:
            if not self._delete_request_roots(
                plan.get(NODE_TYPE),
                plan.get(NODE_IDS) or [],
                bool(plan.get(DELETE_ALL)),
                plan.get(EXCLUSIVE_IDS) or [],
                delete_orphaned_data_files,
            ):
                self.delete_incomplete = True
                return False, []
            if not plan.get(DELETE_ALL):
                stubs = [
                    {NODE_TYPE: plan.get(NODE_TYPE), NODE_ID: node_id}
                    for node_id in (plan.get(NODE_IDS) or [])
                ]
                if stubs and not self.process_children(stubs, delete_orphaned_data_files):
                    self.delete_incomplete = True
                    return False, []
            if not self._finish_dangling_parents(plan, delete_orphaned_data_files):
                self.delete_incomplete = True
                return False, []
            orphan_errors = self._find_orphaned_files_and_build_errors(
                submission_id, delete_orphaned_data_files, None
            )
            if not self._persist_orphan_errors(submission_id, orphan_errors):
                self.delete_incomplete = True
                return False, []
        except Exception:
            self.delete_incomplete = True
            self.log.exception(f'Failed to resume metadata delete, {get_exception_msg()}!')
            return False, []
        if not self._clear_plan():
            return False, []
        return True, orphan_errors

    def _finish_dangling_parents(self, plan, delete_orphaned_data_files):
        """Delete or unlink nodes whose parent record is already gone.

        Exclusive ids of the requested type are left alone. This submission has one
        in-flight delete, so other missing parents are the unfinished cascade.
        Resume may scan all dataRecords for the submission (node keys and parent refs);
        that cost is acceptable on rare redelivery, not steady-state volume.

        @param plan stored pendingMetadataDelete
        @param delete_orphaned_data_files True when associated data files are deleted
        @returns True when the pass succeeded
        """
        live = self.mongo_dao.node_keys_by_submission(self.submission_id)
        if live is None:
            return False
        cursor = self.mongo_dao.parent_refs_by_submission(self.submission_id)
        if cursor is None:
            return False
        exclusive = set(plan.get(EXCLUSIVE_IDS) or [])
        requested_type = plan.get(NODE_TYPE)
        missing = set()
        try:
            for doc in cursor:
                for parent in doc.get(PARENTS) or []:
                    key = (parent.get(PARENT_TYPE), parent.get(PARENT_ID_VAL))
                    if key[0] is None or key[1] is None:
                        continue
                    if key[0] == requested_type and key[1] in exclusive:
                        continue
                    if key not in live:
                        missing.add(key)
        except Exception:
            self.log.exception(f'Failed to find dangling parents, {get_exception_msg()}!')
            return False
        if not missing:
            return True
        stubs = [{NODE_TYPE: node_type, NODE_ID: node_id} for node_type, node_id in missing]
        return self.process_children(stubs, delete_orphaned_data_files)

    def _persist_orphan_errors(self, submission_id, orphan_errors):
        """Replace this submission's F008 qcResults with the latest scan.

        @param submission_id submission document id
        @param orphan_errors F008 rows from the orphan scan
        @returns True when the qcResults write succeeded
        """
        if self.mongo_dao.delete_f008_qc_results(submission_id) is False:
            return False
        if not orphan_errors:
            return True
        rows = []
        for error in orphan_errors:
            row = dict(error)
            row[ID] = get_uuid_str()
            row[SUBMISSION_ID] = submission_id
            row.setdefault(WARNINGS, [])
            batch_id = row.get(BATCH_ID)
            if batch_id and batch_id != "-":
                row[LATEST_BATCH_ID] = batch_id
            rows.append(row)
        return _dao_write_ok(self.mongo_dao.save_qc_results(rows))

    def validate_data(self, submission_id, node_type, node_ids):
        """
        1) verify node_type
        2) verify node_id exists
        """
        msg = None
        existed_nodes = None
                
        # query db to find existed nodes in current submission.  
        existed_nodes = self.mongo_dao.check_metadata_ids(node_type, node_ids, submission_id)  
        if not existed_nodes or len(existed_nodes) == 0:
            msg = f'No metadata found for “{node_type}: "{json.dumps(node_ids)}.'
            self.log.error(msg)
            return None
        
        existed_ids = [item[NODE_ID] for item in existed_nodes]   
        # When metadata intention is "Delete", all IDs must exist in the database 
        not_existed_ids = list(set(node_ids) - set(existed_ids))
        if len(not_existed_ids) > 0:
            msg = f'metadata not found: “{node_type}": "{json.dumps(not_existed_ids)}".'
            self.log.error(msg)

        return existed_nodes
    
    def delete_nodes(self, existed_nodes, delete_orphaned_data_files=False):
        """
        Remove dataRecords for the given nodes. When delete_orphaned_data_files is True,
        delete their S3 objects before the dataRecords so a retry still has the file name.
        When False, skip S3 and rely on the orphan pass for F008 reporting.
        A database write succeeds only when the DAO success flag is true.
        """
        if len(existed_nodes) == 0:
            return True
        deleted_file_nodes = [node[S3_FILE_INFO] for node in existed_nodes if node.get(S3_FILE_INFO)]
        try:
            if delete_orphaned_data_files and not self.delete_files_in_s3(deleted_file_nodes):
                return False
            if not _dao_write_ok(self.mongo_dao.delete_data_records(existed_nodes)):
                self.errors.append(f'deleting metadata failed with database error.  Please try again and contact the helpdesk if this error persists.')
                return False
            return self.process_children(existed_nodes, delete_orphaned_data_files)
        except Exception as e:
            msg = f'Failed to delete metadata data and data file, {get_exception_msg(e)}!'
            self.log.exception(msg)
            return False
       
    def process_children(self, deleted_nodes, delete_orphaned_data_files=False):
        """
        Update or delete child dataRecords after parents are removed.
        When delete_orphaned_data_files is False, child file nodes are removed from Mongo
        but their S3 objects are left in place (orphan scan reports F008).
        When it is True, S3 objects are deleted before the dataRecords.
        A database write succeeds only when the DAO success flag is true.
        """
        # retrieve child nodes
        status, child_nodes = self.mongo_dao.get_nodes_by_parents(deleted_nodes, self.submission_id)
        if not status: # if exception occurred
            self.errors.append(f'deleting metadata failed with database error.  Please try again and contact the helpdesk if this error persists.')
            return False

        if len(child_nodes) == 0: # if no child
            return True
        
        rtn_val = True
        deleted_child_nodes = []
        updated_child_nodes = []
        file_nodes = []
        deleted_parent_keys = {(item[NODE_TYPE], item[NODE_ID]) for item in deleted_nodes}
        file_def_types = self.def_file_nodes.keys()
        for node in child_nodes:
            parents = [
                p for p in (node.get(PARENTS) or [])
                if (p.get(PARENT_TYPE), p.get(PARENT_ID_VAL)) not in deleted_parent_keys
            ]
            if len(parents) == 0:  #delete if no other parents
                deleted_child_nodes.append(node)
                if node.get(NODE_TYPE) in file_def_types and node.get(S3_FILE_INFO):
                    file_nodes.append(node[S3_FILE_INFO])
            else: #remove deleted parent and update the node
                node[PARENTS] = parents
                updated_child_nodes.append(node)

        updated_results = True
        deleted_results = True
        if len(updated_child_nodes) > 0:
            updated_results = _dao_write_ok(self.mongo_dao.update_data_records(updated_child_nodes))
            if not updated_results:
                self.errors.append(f'deleting metadata failed with database error.  Please try again and contact the helpdesk if this error persists.')
                rtn_val = rtn_val and False

        if len(deleted_child_nodes) > 0:
            if delete_orphaned_data_files and not self.delete_files_in_s3(file_nodes):
                return False
            deleted_results = _dao_write_ok(self.mongo_dao.delete_data_records(deleted_child_nodes))
            if updated_results and deleted_results:
                if not self.process_children(deleted_child_nodes, delete_orphaned_data_files):
                    self.errors.append(f'deleting metadata failed with database error.  Please try again and contact the helpdesk if this error persists.')
                    rtn_val = rtn_val and False
            else:
                self.errors.append(f'Deleting metadata failed with database error.  Please try again and contact the helpdesk if this error persists.')
                rtn_val = rtn_val and False
        return rtn_val

    def _file_names_removed_by_delete(self, root_nodes):
        """File names whose metadata this delete removes.

        Copies parent lists while walking. Does not write them back onto the nodes.
        Deleted parent keys accumulate across levels, so a file parented by a node
        and by that node's child is included once both parents are removed.

        @param root_nodes nodes passed to delete_nodes
        @returns set of removed file names
        @raises Exception when a child lookup fails
        """
        removed = set()
        seen_deleted = set()
        deleted_parent_keys = set()
        file_def_types = (self.def_file_nodes or {}).keys()

        def _keep(node):
            node_key = (node.get(NODE_TYPE), node.get(NODE_ID))
            if node_key in seen_deleted:
                return
            seen_deleted.add(node_key)
            deleted_parent_keys.add(node_key)
            if node.get(NODE_TYPE) in file_def_types:
                file_name = (node.get(S3_FILE_INFO) or {}).get(FILE_NAME)
                if file_name:
                    removed.add(file_name)

        for node in root_nodes or []:
            file_name = (node.get(S3_FILE_INFO) or {}).get(FILE_NAME)
            if file_name:
                removed.add(file_name)
            _keep(node)
        pending = list(root_nodes or [])
        while pending:
            status, child_nodes = self.mongo_dao.get_nodes_by_parents(pending, self.submission_id)
            if not status:
                raise Exception("Failed to load child nodes before the orphan scan")
            pending = []
            for node in child_nodes or []:
                parents = [
                    p for p in (node.get(PARENTS) or [])
                    if (p.get(PARENT_TYPE), p.get(PARENT_ID_VAL)) not in deleted_parent_keys
                ]
                if len(parents) != 0:
                    continue
                node_key = (node.get(NODE_TYPE), node.get(NODE_ID))
                if node_key in seen_deleted:
                    continue
                _keep(node)
                pending.append(node)
        return removed

    def _process_s3_list_page(self, response, manifest_file_names, orphan_s3_infos):
        """Process one page of list_objects_v2 response; append orphan items to orphan_s3_infos. Return NextContinuationToken."""
        for item in response.get("Contents") or []:
            obj_key = item.get("Key") or ""
            if "/log" in obj_key:
                continue
            file_name = obj_key.split("/")[-1]
            if not file_name or file_name in manifest_file_names:
                continue
            orphan_s3_infos.append({
                FILE_NAME: file_name,
                "last_modified": item.get("LastModified"),
            })
        return response.get("NextContinuationToken")

    def _find_orphaned_files_and_build_errors(self, submission_id, delete_orphaned_data_files, removed_file_names=None):
        """
        Find S3 keys under file/ that will be unreferenced after this delete.
        Names whose metadata this delete removes are dropped from the manifest.
        When delete_orphaned_data_files is True those names are also leaving S3, so they are not orphans.
        Returns F008-shaped errors. Returns [] when bucket or root_path is missing.
        Listing and batch-lookup errors propagate so remove_metadata can fail before any delete.
        Does not delete S3 objects.

        @param submission_id submission document id
        @param delete_orphaned_data_files True when removed file names are also deleted from S3
        @param removed_file_names file names whose metadata this delete removes
        @returns F008 error dicts for unreferenced files
        @raises Exception when the S3 listing or batch lookup fails
        """
        if not self.bucket or not self.root_path:
            return []
        orphan_errors = []
        manifest_info_list = self.mongo_dao.get_files_by_submission(submission_id)
        if manifest_info_list is None:
            raise Exception(f"Failed to load the file manifest for submission {submission_id}")
        manifest_file_names = set()
        for manifest_info in manifest_info_list:
            if manifest_info.get(S3_FILE_INFO) and manifest_info[S3_FILE_INFO].get(FILE_NAME):
                manifest_file_names.add(manifest_info[S3_FILE_INFO][FILE_NAME])
        removed = set(removed_file_names or [])
        if delete_orphaned_data_files:
            manifest_file_names.update(removed)
        else:
            manifest_file_names.difference_update(removed)

        # S3 keys use forward slashes; paginate list_objects_v2 (first page, then while token)
        key = (os.path.join(self.root_path, "file") + "/").replace("\\", "/")
        orphan_s3_infos = []

        response = self.bucket.client.list_objects_v2(
            Bucket=self.bucket.bucket_name,
            Prefix=key,
            MaxKeys=S3_LIST_ORPHANS_PAGE_SIZE,
        )
        continuation_token = self._process_s3_list_page(response, manifest_file_names, orphan_s3_infos)
        while continuation_token:
            response = self.bucket.client.list_objects_v2(
                Bucket=self.bucket.bucket_name,
                Prefix=key,
                MaxKeys=S3_LIST_ORPHANS_PAGE_SIZE,
                ContinuationToken=continuation_token,
            )
            continuation_token = self._process_s3_list_page(response, manifest_file_names, orphan_s3_infos)

        for info in orphan_s3_infos:
            file_name = info[FILE_NAME]
            file_batch = self.mongo_dao.find_batch_by_file_name(submission_id, DATA_FILE_TYPE, file_name)
            batch_id = file_batch[ID] if file_batch else "-"
            display_id = file_batch.get(DISPLAY_ID) if file_batch else None
            error = {
                TYPE: DATA_FILE_TYPE,
                QC_VALIDATION_TYPE: DATA_FILE_TYPE,
                SUBMITTED_ID: file_name,
                BATCH_ID: batch_id,
                DISPLAY_ID: display_id,
                QC_SEVERITY: STATUS_ERROR,
                UPLOADED_DATE: info.get("last_modified"),
                QC_VALIDATE_DATE: current_datetime(),
                ERRORS: [create_error("F008", [file_name], "file name", file_name)],
            }
            orphan_errors.append(error)
        return orphan_errors

    """
    delete files in s3 after deleted file nodes
    """
    def delete_files_in_s3(self, file_s3_infos):
        """Delete data-file objects in batches of 1000.

        A missing key is not an error. The dataRecord is left in place when this returns False.

        @param file_s3_infos S3 file info dicts with fileName
        @returns True when every batch succeeded
        """
        keys = []
        for s3_info in file_s3_infos or []:
            if not s3_info or not s3_info.get(FILE_NAME):
                continue
            key = os.path.join(self.root_path, os.path.join("file", s3_info[FILE_NAME])).replace("\\", "/")
            keys.append(key)
        if not keys:
            return True
        try:
            for chunk in _chunks(keys, S3_LIST_ORPHANS_PAGE_SIZE):
                response = self.bucket.client.delete_objects(
                    Bucket=self.bucket.bucket_name,
                    Delete={"Objects": [{"Key": key} for key in chunk], "Quiet": True},
                )
                errors = response.get("Errors") if isinstance(response, dict) else None
                if errors:
                    self.errors.append(
                        'deleting data files failed.  Please try again and contact the helpdesk if this error persists.'
                    )
                    return False
            return True
        except Exception as e:
            self.log.exception(e)
            self.log.exception(f"Failed to delete files in s3 bucket, {get_exception_msg()}.")
            self.errors.append(
                'deleting data files failed.  Please try again and contact the helpdesk if this error persists.'
            )
            return False
    
    def close(self):
        if self.bucket:
            del self.bucket

  