import pytest
import json
import sys
import os
from unittest.mock import MagicMock, patch

# Resolve project root from this file (src/test/validators/...) and add src to path.
_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, 'src'))

from metadata_validator import metadataValidate, MetaDataValidator, _process_cross_submission
from common import constants
from common.validation_closeout import METADATA_PROGRESS
from pymongo import errors


# ---------------------------------------------------------------------------
# increment_completed_batches (mongo_dao)
# ---------------------------------------------------------------------------

class TestIncrementCompletedBatches:

    def _setup_mock_db(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_db = MagicMock()
        mock_client.__getitem__.return_value = mock_db
        mock_validation_col = MagicMock()

        def db_getitem(key):
            if key == constants.VALIDATION_COLLECTION:
                return mock_validation_col
            return MagicMock()

        mock_db.__getitem__.side_effect = db_getitem
        return mock_validation_col

    @patch("common.mongo_dao.MongoClient")
    def test_increments_and_returns_count(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.return_value = {constants.COMPLETED_BATCHES: 2}

        dao = MongoDao("mongodb://localhost", "test_db")
        count, is_last, failed, worst, details = dao.increment_completed_batches("val-1", 5)

        assert count == 2
        assert is_last is False
        assert failed == 0
        assert worst == constants.STATUS_PASSED
        assert details == []

    @patch("common.mongo_dao.MongoClient")
    def test_is_last_batch_when_count_equals_total(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.return_value = {constants.COMPLETED_BATCHES: 5}

        dao = MongoDao("mongodb://localhost", "test_db")
        count, is_last, failed, worst, details = dao.increment_completed_batches("val-1", 5)

        assert count == 5
        assert is_last is True
        assert failed == 0

    @patch("common.mongo_dao.MongoClient")
    def test_is_last_batch_when_count_exceeds_total(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.return_value = {constants.COMPLETED_BATCHES: 6}

        dao = MongoDao("mongodb://localhost", "test_db")
        count, is_last, failed, worst, details = dao.increment_completed_batches("val-1", 5)

        assert count == 6
        assert is_last is True
        assert failed == 0

    @patch("common.mongo_dao.MongoClient")
    def test_batch_failed_increments_both_counters(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.return_value = {constants.COMPLETED_BATCHES: 3, constants.FAILED_BATCHES: 1}

        dao = MongoDao("mongodb://localhost", "test_db")
        count, is_last, failed, worst, details = dao.increment_completed_batches("val-1", 5, batch_failed=True)

        assert count == 3
        assert is_last is False
        assert failed == 1
        update_arg = col.find_one_and_update.call_args[0][1]
        assert update_arg['$inc'] == {constants.COMPLETED_BATCHES: 1, constants.FAILED_BATCHES: 1}

    @patch("common.mongo_dao.MongoClient")
    def test_batch_success_does_not_increment_failed(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.return_value = {constants.COMPLETED_BATCHES: 3}

        dao = MongoDao("mongodb://localhost", "test_db")
        count, is_last, failed, worst, details = dao.increment_completed_batches("val-1", 5, batch_failed=False)

        assert failed == 0
        update_arg = col.find_one_and_update.call_args[0][1]
        assert update_arg['$inc'] == {constants.COMPLETED_BATCHES: 1}

    @patch("common.mongo_dao.MongoClient")
    def test_batch_status_uses_max_operator(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.return_value = {
            constants.COMPLETED_BATCHES: 2, constants.WORST_BATCH_STATUS: 2,
        }

        dao = MongoDao("mongodb://localhost", "test_db")
        count, is_last, failed, worst, details = dao.increment_completed_batches(
            "val-1", 5, batch_status=constants.STATUS_ERROR
        )

        update_arg = col.find_one_and_update.call_args[0][1]
        assert update_arg['$max'] == {constants.WORST_BATCH_STATUS: constants.STATUS_PRECEDENCE[constants.STATUS_ERROR]}
        assert worst == constants.STATUS_ERROR

    @patch("common.mongo_dao.MongoClient")
    def test_worst_status_maps_back_from_numeric(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.return_value = {
            constants.COMPLETED_BATCHES: 3, constants.WORST_BATCH_STATUS: 2,
        }

        dao = MongoDao("mongodb://localhost", "test_db")
        _, _, _, worst, _ = dao.increment_completed_batches("val-1", 5, batch_status=constants.STATUS_ERROR)

        assert worst == constants.STATUS_ERROR

    @patch("common.mongo_dao.MongoClient")
    def test_status_detail_uses_push_operator(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.return_value = {
            constants.COMPLETED_BATCHES: 1,
            constants.BATCH_STATUS_DETAILS: ['Submission not found: sub-1'],
        }

        dao = MongoDao("mongodb://localhost", "test_db")
        _, _, _, _, details = dao.increment_completed_batches(
            "val-1", 5, status_detail='Submission not found: sub-1'
        )

        update_arg = col.find_one_and_update.call_args[0][1]
        assert update_arg['$push'] == {constants.BATCH_STATUS_DETAILS: 'Submission not found: sub-1'}
        assert details == ['Submission not found: sub-1']

    @patch("common.mongo_dao.MongoClient")
    def test_no_push_when_status_detail_is_none(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.return_value = {constants.COMPLETED_BATCHES: 1}

        dao = MongoDao("mongodb://localhost", "test_db")
        dao.increment_completed_batches("val-1", 5, status_detail=None)

        update_arg = col.find_one_and_update.call_args[0][1]
        assert '$push' not in update_arg

    @patch("common.mongo_dao.MongoClient")
    def test_no_max_when_batch_status_is_none(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.return_value = {constants.COMPLETED_BATCHES: 1}

        dao = MongoDao("mongodb://localhost", "test_db")
        dao.increment_completed_batches("val-1", 5, batch_status=None)

        update_arg = col.find_one_and_update.call_args[0][1]
        assert '$max' not in update_arg

    @patch("common.mongo_dao.MongoClient")
    def test_validation_not_found_returns_none(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.return_value = None

        dao = MongoDao("mongodb://localhost", "test_db")
        count, is_last, failed, worst, details = dao.increment_completed_batches("val-missing", 5)

        assert count is None
        assert is_last is False
        assert failed == 0
        assert worst is None
        assert details == []

    @patch("common.mongo_dao.MongoClient")
    def test_pymongo_error_returns_none(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find_one_and_update.side_effect = errors.PyMongoError("db error")

        dao = MongoDao("mongodb://localhost", "test_db")
        count, is_last, failed, worst, details = dao.increment_completed_batches("val-1", 5)

        assert count is None
        assert is_last is False
        assert failed == 0
        assert worst is None
        assert details == []


# ---------------------------------------------------------------------------
# get_dataRecords_by_ids (mongo_dao)
# ---------------------------------------------------------------------------

class TestGetDataRecordsByIds:

    def _setup_mock_db(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_db = MagicMock()
        mock_client.__getitem__.return_value = mock_db
        mock_data_col = MagicMock()

        def db_getitem(key):
            if key == constants.DATA_COLLECTION:
                return mock_data_col
            return MagicMock()

        mock_db.__getitem__.side_effect = db_getitem
        return mock_data_col

    @patch("common.mongo_dao.MongoClient")
    def test_full_match(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        records = [{constants.ID: 'r1'}, {constants.ID: 'r2'}]
        col.find.return_value = records

        dao = MongoDao("mongodb://localhost", "test_db")
        result = dao.get_dataRecords_by_ids(['r1', 'r2'])

        assert len(result) == 2

    @patch("common.mongo_dao.MongoClient")
    def test_partial_match_logs_warning(self, mock_client_class, caplog):
        import logging
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find.return_value = [{constants.ID: 'r1'}]

        dao = MongoDao("mongodb://localhost", "test_db")
        with caplog.at_level(logging.WARNING):
            result = dao.get_dataRecords_by_ids(['r1', 'r2', 'r3'])

        assert len(result) == 1
        warning_msgs = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
        assert any('Partial match' in m for m in warning_msgs)

    @patch("common.mongo_dao.MongoClient")
    def test_empty_result(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find.return_value = []

        dao = MongoDao("mongodb://localhost", "test_db")
        result = dao.get_dataRecords_by_ids(['r1'])

        assert result == []

    @patch("common.mongo_dao.MongoClient")
    def test_pymongo_error_returns_none(self, mock_client_class):
        from common.mongo_dao import MongoDao
        col = self._setup_mock_db(mock_client_class)
        col.find.side_effect = errors.PyMongoError("db error")

        dao = MongoDao("mongodb://localhost", "test_db")
        result = dao.get_dataRecords_by_ids(['r1'])

        assert result is None


# ---------------------------------------------------------------------------
# Batch handler (metadataValidate) — integration tests
# ---------------------------------------------------------------------------

class TestBatchHandler:
    """Tests for metadata batch messages in metadataValidate."""

    @pytest.fixture
    def mock_configs(self):
        from common.constants import MODEL_FILE_DIR, TIER_CONFIG, SQS_NAME
        return {
            MODEL_FILE_DIR: '/fake/models',
            TIER_CONFIG: '/fake/tier.json',
            SQS_NAME: 'test-queue',
        }

    @pytest.fixture
    def mock_model_store(self):
        store = MagicMock()
        model = MagicMock()
        model.model = True
        model.get_nodes.return_value = ['node1']
        store.get_model_by_data_common_version.return_value = model
        return store

    @pytest.fixture
    def mock_mongo_dao(self):
        dao = MagicMock()
        dao.get_dataRecords_by_ids.return_value = [{constants.ID: 'r1'}, {constants.ID: 'r2'}]
        dao.get_submission.return_value = {
            '_id': 'sub-1',
            constants.DATA_COMMON_NAME: 'CDS',
            constants.MODEL_VERSION: '1.0',
            constants.STUDY_ID: 'study-1',
        }
        dao.find_study_by_id.return_value = {'studyName': 'Test Study'}
        dao.find_organization_name_by_study_id.return_value = ['Test Org']
        dao.atomic_update_validation.return_value = {'status': constants.STATUS_FAILED}
        dao.atomic_update_submission.return_value = {'_id': 'sub-1'}
        return dao

    def _make_batch_msg(self, overrides=None):
        payload = {
            constants.SQS_TYPE: constants.TYPE_METADATA_VALIDATE_BATCH,
            constants.SUBMISSION_ID: 'sub-1',
            constants.VALIDATION_ID: 'val-1',
            constants.DATA_RECORD_IDS: ['r1', 'r2'],
            constants.TOTAL_BATCHES: 3,
            constants.BATCH_INDEX: 0,
            constants.SCOPE: 'New',
        }
        if overrides:
            payload.update(overrides)
        msg = MagicMock()
        msg.body = json.dumps(payload)
        return msg

    def _run_one_message(self, mock_configs, mock_model_store, mock_mongo_dao, msg):
        """Run the service loop for exactly one message then break."""
        job_queue = MagicMock()
        job_queue.receiveMsgs.side_effect = [[msg], KeyboardInterrupt]

        with patch('metadata_validator.ModelFactory', return_value=mock_model_store):
            with patch('metadata_validator.set_scale_in_protection'):
                metadataValidate(mock_configs, job_queue, mock_mongo_dao)

    def test_happy_path_records_passed_and_deletes(self, mock_configs, mock_model_store, mock_mongo_dao):
        """A successfully validated batch records Passed progress and is acknowledged.

        Stub node validation only to keep its error flags clear, then verify it
        receives the loaded records and metadata progress is recorded as Passed.
        """
        msg = self._make_batch_msg()
        records = [{constants.ID: 'r1'}, {constants.ID: 'r2'}]

        def leave_flags_unset(self, data_records):
            assert not self.isError
            assert not self.isWarning
            return len(data_records)

        with patch('metadata_validator.record_type_progress') as record:
            with patch.object(MetaDataValidator, 'validate_nodes', autospec=True, side_effect=leave_flags_unset) as validate_nodes:
                self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        validate_nodes.assert_called_once()
        assert validate_nodes.call_args[0][1] == records
        mock_mongo_dao.get_dataRecords_by_ids.assert_called_once_with(['r1', 'r2'])
        assert record.call_args[0][0] == constants.STATUS_PASSED
        assert record.call_args[0][4] is METADATA_PROGRESS
        assert record.call_args[1]['total_count'] == 3
        assert record.call_args[1].get('status_detail') is None
        msg.delete.assert_called_once()

    def test_error_flag_records_error(self, mock_configs, mock_model_store, mock_mongo_dao):
        """A node-validation error flag makes the batch result Error.

        Have validate_nodes set the validator's real isError flag, then inspect
        the status and progress type passed to record_type_progress.
        """
        msg = self._make_batch_msg()
        records = [{constants.ID: 'r1'}, {constants.ID: 'r2'}]

        def flag_error(self, _data_records):
            self.isError = True
            return 0

        with patch('metadata_validator.record_type_progress') as record:
            with patch.object(MetaDataValidator, 'validate_nodes', autospec=True, side_effect=flag_error) as validate_nodes:
                self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        validate_nodes.assert_called_once()
        assert validate_nodes.call_args[0][1] == records
        assert record.call_args[0][0] == constants.STATUS_ERROR
        assert record.call_args[0][4] is METADATA_PROGRESS
        msg.delete.assert_called_once()

    def test_validate_node_exception_records_error_and_deletes(self, mock_configs, mock_model_store, mock_mongo_dao):
        """An exception inside one node becomes a handled Error batch.

        Patch only validate_node so real validate_nodes catches the exception,
        sets isError, records Error progress, and permits message deletion.
        """
        msg = self._make_batch_msg()

        with patch('metadata_validator.record_type_progress') as record:
            with patch.object(MetaDataValidator, 'validate_node', side_effect=RuntimeError('boom')):
                self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        assert record.call_args[0][0] == constants.STATUS_ERROR
        assert record.call_args[0][4] is METADATA_PROGRESS
        msg.delete.assert_called_once()

    def test_model_unavailable_records_failed_task(self, mock_configs, mock_model_store, mock_mongo_dao):
        bad_model = MagicMock()
        bad_model.model = None
        bad_model.get_nodes.return_value = []
        mock_model_store.get_model_by_data_common_version.return_value = bad_model
        msg = self._make_batch_msg()

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        assert record.call_args[0][0] == constants.FAILED
        assert 'not available' in record.call_args[1]['status_detail']
        msg.delete.assert_called_once()

    def test_missing_study_records_failed_task(self, mock_configs, mock_model_store, mock_mongo_dao):
        mock_mongo_dao.find_study_by_id.return_value = None
        msg = self._make_batch_msg()

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        assert record.call_args[0][0] == constants.FAILED
        assert 'no study found' in record.call_args[1]['status_detail']
        msg.delete.assert_called_once()

    def test_submission_not_found_fails_fast(self, mock_configs, mock_model_store, mock_mongo_dao):
        """A missing submission fails the run without normal progress or submission writes.

        Return no submission and inspect the fail-fast validation update while
        verifying record_type_progress and atomic_update_submission are unused.
        """
        mock_mongo_dao.get_submission.return_value = None
        msg = self._make_batch_msg()

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        record.assert_not_called()
        mock_mongo_dao.atomic_update_submission.assert_not_called()
        fail_call = mock_mongo_dao.atomic_update_validation.call_args
        fail_update = fail_call[0][1]
        assert fail_update[constants.VALIDATION_STATUS] == constants.STATUS_FAILED
        assert any('Submission not found' in detail for detail in fail_update[constants.STATUS_DETAIL])
        assert fail_call[1]['expected_status'] == 'Validating'
        msg.delete.assert_called_once()

    def test_no_data_records_fails_fast(self, mock_configs, mock_model_store, mock_mongo_dao):
        mock_mongo_dao.get_dataRecords_by_ids.return_value = []
        msg = self._make_batch_msg()

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        record.assert_not_called()
        fail_call = mock_mongo_dao.atomic_update_validation.call_args
        fail_update = fail_call[0][1]
        assert fail_update[constants.VALIDATION_STATUS] == constants.STATUS_FAILED
        assert any('No data records found' in detail for detail in fail_update[constants.STATUS_DETAIL])
        assert fail_call[1]['expected_status'] == 'Validating'
        msg.delete.assert_called_once()

    def test_missing_scope_fails_fast_without_counting_the_batch(self, mock_configs, mock_model_store, mock_mongo_dao):
        payload = {
            constants.SQS_TYPE: constants.TYPE_METADATA_VALIDATE_BATCH,
            constants.SUBMISSION_ID: 'sub-1',
            constants.VALIDATION_ID: 'val-1',
            constants.DATA_RECORD_IDS: ['r1', 'r2'],
            constants.TOTAL_BATCHES: 3,
            constants.BATCH_INDEX: 0,
        }
        msg = MagicMock()
        msg.body = json.dumps(payload)

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        record.assert_not_called()
        mock_mongo_dao.get_dataRecords_by_ids.assert_not_called()
        fail_call = mock_mongo_dao.atomic_update_validation.call_args
        fail_update = fail_call[0][1]
        assert fail_update[constants.VALIDATION_STATUS] == constants.STATUS_FAILED
        assert any('scope' in detail for detail in fail_update[constants.STATUS_DETAIL])
        assert fail_call[1]['expected_status'] == 'Validating'
        msg.delete.assert_called_once()

    def test_zero_total_batches_fails_fast(self, mock_configs, mock_model_store, mock_mongo_dao):
        """A nonpositive totalBatches is a permanent content error.

        Send zero and inspect the fail-fast status and detail, while verifying no
        records are loaded and normal batch progress is not recorded.
        """
        msg = self._make_batch_msg({constants.TOTAL_BATCHES: 0})

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        record.assert_not_called()
        mock_mongo_dao.get_dataRecords_by_ids.assert_not_called()
        fail_call = mock_mongo_dao.atomic_update_validation.call_args
        fail_update = fail_call[0][1]
        assert fail_update[constants.VALIDATION_STATUS] == constants.STATUS_FAILED
        assert any('total_batches' in detail for detail in fail_update[constants.STATUS_DETAIL])
        assert fail_call[1]['expected_status'] == 'Validating'
        msg.delete.assert_called_once()

    def test_fail_fast_predicate_miss_still_deletes_message(self, mock_configs, mock_model_store, mock_mongo_dao):
        """An already-finalized validation is a race, not a retryable write failure."""
        mock_mongo_dao.get_submission.return_value = None
        mock_mongo_dao.atomic_update_validation.return_value = None
        msg = self._make_batch_msg()

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        record.assert_not_called()
        mock_mongo_dao.atomic_update_submission.assert_not_called()
        msg.delete.assert_called_once()

    def test_init_failure_records_detail_for_accumulation(self, mock_configs, mock_model_store, mock_mongo_dao):
        """A model init failure records Failed progress with a detail for later close-out."""
        bad_model = MagicMock()
        bad_model.model = None
        bad_model.get_nodes.return_value = []
        mock_model_store.get_model_by_data_common_version.return_value = bad_model
        msg = self._make_batch_msg()

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        assert record.call_args[0][0] == constants.FAILED
        assert record.call_args[0][4] is METADATA_PROGRESS
        assert 'not available' in record.call_args[1]['status_detail']
        msg.delete.assert_called_once()

    def test_missing_validation_id_deletes_without_failing_a_run(self, mock_configs, mock_model_store, mock_mongo_dao):
        msg = self._make_batch_msg({constants.VALIDATION_ID: None})

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        record.assert_not_called()
        mock_mongo_dao.atomic_update_validation.assert_not_called()
        mock_mongo_dao.get_dataRecords_by_ids.assert_not_called()
        msg.delete.assert_called_once()

    def test_data_records_lookup_error_is_retried(self, mock_configs, mock_model_store, mock_mongo_dao):
        mock_mongo_dao.get_dataRecords_by_ids.return_value = None
        msg = self._make_batch_msg()

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        record.assert_not_called()
        mock_mongo_dao.atomic_update_validation.assert_not_called()
        msg.delete.assert_not_called()

    def test_closeout_write_failure_is_retried(self, mock_configs, mock_model_store, mock_mongo_dao):
        """A close-out persistence failure leaves the message available for retry.

        Raise from record_type_progress and verify the message is not deleted and
        the retryable path does not separately mark the validation Failed.
        """
        msg = self._make_batch_msg()

        with patch('metadata_validator.record_type_progress', side_effect=RuntimeError('db down')):
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        msg.delete.assert_not_called()
        for update_call in mock_mongo_dao.atomic_update_validation.call_args_list:
            assert update_call[0][1].get(constants.VALIDATION_STATUS) != constants.STATUS_FAILED

    def test_missing_datacommon_records_failed_task(self, mock_configs, mock_model_store, mock_mongo_dao):
        mock_mongo_dao.get_submission.return_value = {
            '_id': 'sub-1',
            constants.MODEL_VERSION: '1.0',
            constants.STUDY_ID: 'study-1',
        }
        msg = self._make_batch_msg()

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        assert record.call_args[0][0] == constants.FAILED
        assert 'no datacommon found' in record.call_args[1]['status_detail']
        msg.delete.assert_called_once()

    def test_submission_read_failure_is_retried(self, mock_configs, mock_model_store, mock_mongo_dao):
        """A transient get_submission error is not treated as a missing submission."""
        mock_mongo_dao.get_submission.side_effect = Exception('database unavailable')
        msg = self._make_batch_msg()

        with patch('metadata_validator.record_type_progress') as record:
            self._run_one_message(mock_configs, mock_model_store, mock_mongo_dao, msg)

        record.assert_not_called()
        mock_mongo_dao.atomic_update_validation.assert_not_called()
        msg.delete.assert_not_called()


def test_cross_submission_status_write_failure_raises():
    """A false set_cross_submission_status result is a retryable write failure."""
    mongo_dao = MagicMock()
    mongo_dao.get_submission.return_value = {'_id': 'sub-1'}
    mongo_dao.set_cross_submission_status.return_value = False

    with patch('metadata_validator.CrossSubmissionValidator') as validator_cls:
        validator = validator_cls.return_value
        validator.submission = {'_id': 'sub-1'}
        validator.validate.return_value = constants.STATUS_PASSED
        with pytest.raises(Exception, match='Failed to update cross-submission status'):
            _process_cross_submission(mongo_dao, {
                constants.SUBMISSION_ID: 'sub-1',
                constants.VALIDATION_ID: 'val-1',
            })
