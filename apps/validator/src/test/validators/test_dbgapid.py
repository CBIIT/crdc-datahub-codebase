from test.utils.mock_metadata_validator import create_mock_validator, default_study, create_mock_data_model
from common.constants import VALIDATION_RESULT, ERRORS, WARNINGS, STATUS_PASSED

test_study = default_study.copy()
test_study.update({
    'dbGaPID': "dbgap_id_1",
})

validator = create_mock_validator(test_study=test_study)

def test_validator():
    assert validator is not None

def test_validator_has_dbgapid():
    assert validator.dbGaPID == "dbgap_id_1"

def test_validate_dbgapid_return_type():
    data_record = {
        "nodeType": "non-study-node"
    }
    result = validator.validate_dbGaPID(data_record, "message prefix")
    assert result == {}

def test_entity_type():
    entity_type = validator.model.get_entity_type("study")
    assert entity_type == 'Study'

def test_valid_dbgapid():
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "dbgap_id_1"
        }
    }
    result = validator.validate_dbGaPID(data_record, "message prefix")
    assert result == {VALIDATION_RESULT: STATUS_PASSED, ERRORS: [], WARNINGS: []}

def test_invalid_dbgapid():
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "wrong_dbgapid"
        }
    }
    result = validator.validate_dbGaPID(data_record, "message prefix:")
    assert len(result[ERRORS]) == 1
    error = result[ERRORS][0]
    assert error['code'] == "M038"
    assert error["offendingProperty"] == "phs_accession"
    assert error["offendingValue"] == "wrong_dbgapid"
    assert error['title'] == "dbGaPID mismatch"
    assert error["severity"] == "Error"
    assert error['description'] == "message prefix: dbGaPID mismatch: dbGaPID doesn't match the pre-approved value - 'dbgap_id_1'."

def test_dbgapid_not_in_data():
    data_record = {
        "nodeType": "study",
        "props": {
            "other_property": "some_value"
        }
    }
    result = validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {}

def test_dbgapid_empty_in_data():
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": ""
        }
    }
    result = validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {}

def test_dbgapid_none_in_data():
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": None
        }
    }
    result = validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {}


def test_dbgapid_set_to_empty_in_study():
    test_study = default_study.copy()
    test_study.update({
        'dbGaPID': "",
    })

    local_validator = create_mock_validator(test_study=test_study)
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "wrong_dbgapid"
        }
    }
    result = local_validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {}

def test_dbgapid_set_to_none_in_study():
    test_study = default_study.copy()
    test_study.update({
        'dbGaPID': None
    })

    local_validator = create_mock_validator(test_study=test_study)
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "wrong_dbgapid"
        }
    }
    result = local_validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {}

def test_dbgapid_doesnt_exist_in_study():
    local_test_study = default_study.copy()

    local_validator = create_mock_validator(test_study=local_test_study)
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "wrong_dbgapid"
        }
    }
    result = local_validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {}

def test_dbgapid_not_configured_in_model():
    model_config_file = 'src/test/test_data/content-no-dbGaPID.json'
    data_model = create_mock_data_model(model_config_file=model_config_file)
    local_validator = create_mock_validator(data_model=data_model, test_study=test_study)

    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "wrong_dbgapid"
        }
    }
    result = local_validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {}

def test_dbgapid_v_p_present_in_data():
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "dbgap_id_1.v1.p3"
        }
    }
    result = validator.validate_dbGaPID(data_record, "message prefix")
    assert result == {VALIDATION_RESULT: STATUS_PASSED, ERRORS: [], WARNINGS: []}

def test_dbgapid_v_present_in_data():
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "dbgap_id_1.v1"
        }
    }
    result = validator.validate_dbGaPID(data_record, "message prefix")
    assert result == {VALIDATION_RESULT: STATUS_PASSED, ERRORS: [], WARNINGS: []}

def test_dbgapid_v_multi_digit_present_in_data():
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "dbgap_id_1.v1"
        }
    }
    result = validator.validate_dbGaPID(data_record, "message prefix")
    assert result == {VALIDATION_RESULT: STATUS_PASSED, ERRORS: [], WARNINGS: []}

def test_dbgapid_v_p_present_in_study():
    test_study = default_study.copy()
    test_study.update({
        'dbGaPID': "dbgap_id_1.v1.p3",
    })

    local_validator = create_mock_validator(test_study=test_study)
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "dbgap_id_1"
        }
    }
    result = local_validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {VALIDATION_RESULT: STATUS_PASSED, ERRORS: [], WARNINGS: []}

def test_dbgapid_v_present_in_study():
    test_study = default_study.copy()
    test_study.update({
        'dbGaPID': "dbgap_id_1.v1",
    })

    local_validator = create_mock_validator(test_study=test_study)
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "dbgap_id_1"
        }
    }
    result = local_validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {VALIDATION_RESULT: STATUS_PASSED, ERRORS: [], WARNINGS: []}

def test_dbgapid_v_multi_digit_present_in_study():
    test_study = default_study.copy()
    test_study.update({
        'dbGaPID': "dbgap_id_1.v112",
    })

    local_validator = create_mock_validator(test_study=test_study)
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "dbgap_id_1"
        }
    }
    result = local_validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {VALIDATION_RESULT: STATUS_PASSED, ERRORS: [], WARNINGS: []}

def test_dbgapid_only_v_p_different():
    test_study = default_study.copy()
    test_study.update({
        'dbGaPID': "dbgap_id_1.v1.p3",
    })

    local_validator = create_mock_validator(test_study=test_study)
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "dbgap_id_1.v2.p1"
        }
    }
    result = local_validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {VALIDATION_RESULT: STATUS_PASSED, ERRORS: [], WARNINGS: []}

def test_dbgapid_case_different_different():
    test_study = default_study.copy()
    test_study.update({
        'dbGaPID': "phs000007.v1.p3",
    })

    local_validator = create_mock_validator(test_study=test_study)
    data_record = {
        "nodeType": "study",
        "props": {
            "phs_accession": "PHs000007.v2.p1"
        }
    }
    result = local_validator.validate_dbGaPID(data_record, "message prefix:")
    assert result == {VALIDATION_RESULT: STATUS_PASSED, ERRORS: [], WARNINGS: []}