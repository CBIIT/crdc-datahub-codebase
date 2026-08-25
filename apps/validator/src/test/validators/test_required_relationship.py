from common.constants import ERRORS, STATUS_PASSED, STATUS_ERROR, WARNINGS

from metadata_validator import get_column_name_from_parent_obj

from test.utils.mock_metadata_validator import create_mock_validator

validator = create_mock_validator()


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

def test_error_message_format_for_missing_required_relationship():
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
    error = result[ERRORS][0]
    assert isinstance(error, dict)
    assert error["code"] == "M037"
    assert error["offendingProperty"] == "participant.participant_id"
    assert error["offendingValue"] == ""
    assert error["title"] == "Missing required relationship"
    assert error["severity"] == "Error"
    assert error["description"] == 'test_prefix:  Required relationship "participant.participant_id" is empty.'

def test_error_message_format_for_empty_required_relationship():
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
                    "parentIDValue": ""
                }
        ]
    }
    result = validator.validate_required_relationship(test_data_record, "test_prefix")
    error = result[ERRORS][0]
    assert isinstance(error, dict)
    assert error["code"] == "M037"
    assert error["offendingProperty"] == "participant.participant_id"
    assert error["offendingValue"] == ""
    assert error["title"] == "Missing required relationship"
    assert error["severity"] == "Error"
    assert error["description"] == 'test_prefix:  Required relationship "participant.participant_id" is empty.'

def test_error_message_format_for_none_value_in_required_relationship():
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
                    "parentIDValue": None
                }
        ]
    }
    result = validator.validate_required_relationship(test_data_record, "test_prefix")
    error = result[ERRORS][0]
    assert isinstance(error, dict)
    assert error["code"] == "M037"
    assert error["offendingProperty"] == "participant.participant_id"
    assert error["offendingValue"] == ""
    assert error["title"] == "Missing required relationship"
    assert error["severity"] == "Error"
    assert error["description"] == 'test_prefix:  Required relationship "participant.participant_id" is empty.'