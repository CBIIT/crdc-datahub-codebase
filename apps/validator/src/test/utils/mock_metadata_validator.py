from unittest.mock import MagicMock
from common.model import DataModel
from common.mdf_reader import get_model_from_mdf_files

from metadata_validator import MetaDataValidator
from common.constants import DATA_COMMON_NAME, STUDY_ID, MODEL_VERSION

default_submission = {
    '_id': 'submission_id_1',
    DATA_COMMON_NAME: 'data_commons_1',
    STUDY_ID: 'study_id_1',
    MODEL_VERSION: '1.0'
}

default_study = {
    '_id': "study_id_1",
    'id': "study_id_1",
    'studyName': "study_1",
    'dbGaPID': "dbgap_id_1",
}

def create_mock_validator(test_submission=default_submission, test_study=default_study):

    model_file = 'src/test/test_data/test_mdf.yml'
    model = get_model_from_mdf_files([model_file], handle="CRDC")

    data_model = DataModel({}, model)

    mock_mongo_dao = MagicMock()
    mock_mongo_dao.find_study_by_id = MagicMock(return_value=test_study)
    mock_model_store = MagicMock()
    mock_model_store.get_model_by_data_common_version = MagicMock(return_value=data_model)
    validator = MetaDataValidator(mock_mongo_dao, mock_model_store, {})
    validator._initialize_for_validation(test_submission, 'submission_id_1', 'all')
    
    return validator