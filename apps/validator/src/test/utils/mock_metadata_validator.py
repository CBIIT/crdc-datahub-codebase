from unittest.mock import MagicMock
from common.model import DataModel
from common.mdf_reader import get_model_from_mdf_files
import json
from common.model_reader import YamlModelParser
from metadata_validator import MetaDataValidator
from common.constants import DATA_COMMON_NAME, STUDY_ID, MODEL_VERSION
from common.model_store import DEF_FILE_NODES, DEF_MAIN_NODES, PROPERTY_NAMES, OMIT_DCF_PREFIX, DEF_SEMANTICS
    
default_submission = {
    '_id': 'submission_id_1',
    DATA_COMMON_NAME: 'data_commons_1',
    STUDY_ID: 'study_id_1',
    MODEL_VERSION: '1.0'
}

default_study = {
    '_id': "study_id_1",
    'id': "study_id_1",
    'studyName': "study_1"
}

def create_mock_validator(test_submission=default_submission, test_study=default_study, data_model=None):
    if data_model is None:
        data_model = create_mock_data_model()

    mock_mongo_dao = MagicMock()
    mock_mongo_dao.find_study_by_id = MagicMock(return_value=test_study)
    mock_model_store = MagicMock()
    mock_model_store.get_model_by_data_common_version = MagicMock(return_value=data_model)
    validator = MetaDataValidator(mock_mongo_dao, mock_model_store, {})
    validator._initialize_for_validation(test_submission, 'submission_id_1', 'all')
    
    return validator


def create_mock_data_model(model_file: str='src/test/test_data/test_mdf.yml', model_config_file: str='src/test/test_data/content.json') -> DataModel:
    mdf_model = get_model_from_mdf_files([model_file], handle="CRDC")
    model_reader = YamlModelParser([model_file], 'CRDC', '|', '1.0.0')
    with open(model_config_file, 'r') as f:
        model_config = json.loads(f.read())["CRDC"]
    old_model = model_reader.model

    data_model = DataModel(old_model, mdf_model, model_config)
    return data_model