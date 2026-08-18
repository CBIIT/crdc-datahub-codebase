import os
import sys
from unittest.mock import MagicMock
from common.model import DataModel
from common.mdf_reader import get_model_from_mdf_files
from common.constants import ERRORS, STATUS_PASSED, STATUS_ERROR, WARNINGS, NODE_TYPE, NODE_ID

# Resolve project root from this file (src/test/validators/...) and add src to path.
_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, 'src'))

from metadata_validator import MetaDataValidator, get_column_name_from_parent_obj
from common.constants import DATA_COMMON_NAME, STUDY_ID, MODEL_VERSION

test_submission = {
    '_id': 'submission_id_1',
    DATA_COMMON_NAME: 'data_commons_1',
    STUDY_ID: 'study_id_1',
    MODEL_VERSION: '1.0'
}



test_study = {
    '_id': "study_id_1",
    'id': "study_id_1",
    'studyName': "study_1"
}

model_file = 'src/test/test_data/test_mdf.yml'
model = get_model_from_mdf_files([model_file], handle="CRDC")

data_model = DataModel({}, model)

mock_mongo_dao = MagicMock()
mock_mongo_dao.find_study_by_id = MagicMock(return_value=test_study)
mock_model_store = MagicMock()
mock_model_store.get_model_by_data_common_version = MagicMock(return_value=data_model)
validator = MetaDataValidator(mock_mongo_dao, mock_model_store, {})
validator._initialize_for_validation(test_submission, 'submission_id_1', 'all')

def test_column_name_from_parent_obj():
    parent = {
                "parentType": "diagnosis",
                "parentIDPropName": "diagnosis_id",
                "parentIDValue": "diagnosis_id_1"
    }
    column_name = get_column_name_from_parent_obj(parent)
    assert column_name == 'diagnosis.diagnosis_id'

def test_no_req_rels_exist():
    test_data_record = {
        'nodeType': 'file',
        'nodeID': 'node_id_1',
        'dataCommons': "CRDC",
    }

    result = validator.validate_required_relationship(test_data_record, "test_prefix")
    assert result["result"] == STATUS_ERROR
    assert len(result[ERRORS]) == 2
    assert len(result[WARNINGS]) == 0

def test_has_all_req_rels():
    test_data_record = {
        'nodeType': 'file',
        'nodeID': 'node_id_1',
        'dataCommons': "CRDC",
        "parents": [
                {
                    "parentType": "diagnosis",
                    "parentIDPropName": "diagnosis_id",
                    "parentIDValue": "diagnosis_id_1"
                },
                {
                    "parentType": "participant",
                    "parentIDPropName": "participant_id",
                    "parentIDValue": "participant_id_1"
                }
        ]
    }
    result = validator.validate_required_relationship(test_data_record, "test_prefix")
    assert result["result"] == STATUS_PASSED
    assert len(result[ERRORS]) == 0
    assert len(result[WARNINGS]) == 0


def test_missing_one_req_rel():
    test_data_record = {
        'nodeType': 'file',
        'nodeID': 'node_id_1',
        'dataCommons': "CRDC",
        "parents": [
                {
                    "parentType": "diagnosis",
                    "parentIDPropName": "diagnosis_id",
                    "parentIDValue": "diagnosis_id_1"
                }
        ]
    }
    result = validator.validate_required_relationship(test_data_record, "test_prefix")
    assert result["result"] == STATUS_ERROR
    assert len(result[ERRORS]) == 1
    assert len(result[WARNINGS]) == 0

def test_empty_values_in_req_rel():
    test_data_record = {
        'nodeType': 'file',
        'nodeID': 'node_id_1',
        'dataCommons': "CRDC",
        "parents": [
                {
                    "parentType": "diagnosis",
                    "parentIDPropName": "diagnosis_id",
                    "parentIDValue": ""
                },
                {
                    "parentType": "participant",
                    "parentIDPropName": "participant_id",
                    "parentIDValue": None
                }
        ]
    }
    result = validator.validate_required_relationship(test_data_record, "test_prefix")
    assert result["result"] == STATUS_ERROR
    assert len(result[ERRORS]) == 2
    assert len(result[WARNINGS]) == 0