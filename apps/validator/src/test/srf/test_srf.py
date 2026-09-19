from common.srf import SRF
import json

srf_data = {
    "questionnaireData": {
        "program": {
            "name": "My Program",
            "abbreviation": "MY_PROGRAM",
            "description": "Program description"
        },
        "study": {
            "name": "Ming 2nd condition",
            "abbreviation": "MING-COND-2",
            "description": "ming's second conditionally approved study",
        }
    }
}

system_populated_props = {
    "program_name": "ProgramName",
    "program_acronym": "ProgramAcronym",
    "program_description": "ProgramDescription",
    "study_name": "StudyName",
    "study_acronym": "StudyAcronym",
    "study_description": "StudyDescription"
}

system_populated_relationships = {
    "program.program_acronym": "ProgramAcronym"
}


def test_get_study_name_from_empty_srf():
    srf = SRF()
    study_name = srf._get_property_value("study_name")
    assert study_name is None

def test_get_study_name_from_srf_with_no_system_populated_props():
    srf = SRF(srf_data, {})
    study_name = srf._get_property_value("study_name")
    assert study_name is None

def test_get_study_name_from_srf_with_multiple_spaces_value():
    local_srf_data = {
        "questionnaireData": {
            "study": {
                "name": "  "
            }
        }
    }
    srf = SRF(local_srf_data, system_populated_props)
    study_name = srf._get_property_value("study_name")
    assert study_name is ""

def test_get_study_name():
    srf = SRF(srf_data, system_populated_props)
    study_name = srf._get_property_value("study_name")
    assert study_name == "Ming 2nd condition"

def test_get_program_name():
    srf = SRF(srf_data, system_populated_props)
    program_name = srf._get_property_value("program_name")
    assert program_name == "My Program"

def test_get_program_name_when_srf_is_empty():
    srf = SRF({}, system_populated_props)
    program_name = srf._get_property_value("program_name")
    assert program_name == ""

def test_get_study_acronym_from_string_questionnaire():
    srf_string_data = {
        "questionnaireData": json.dumps(srf_data['questionnaireData'])
    }
    srf = SRF(srf_string_data, system_populated_props)
    value = srf._get_property_value("study_acronym")
    assert value == "MING-COND-2"

def test_get_all_system_populated_values_with_no_system_populated_props():
    srf = SRF(srf_data, {})
    values = srf.get_system_populated_property_value_map()
    assert values == {}

def test_get_all_system_populated_values_with_system_populated_props():
    srf = SRF(srf_data, system_populated_props)
    values = srf.get_system_populated_property_value_map()
    assert values == {
        "program_name": "My Program",
        "program_acronym": "MY_PROGRAM",
        "program_description": "Program description",
        "study_name": "Ming 2nd condition",
        "study_acronym": "MING-COND-2",
        "study_description": "ming's second conditionally approved study",
    }


def test_get_all_system_populated_values_with_empty_values():
    local_srf_data = {
        "questionnaireData": {
            "program": {
                "name": "My Program",
                "abbreviation": "MY_PROGRAM",
                "description": "Program description"
            },
            "study": {
                "name": "Ming 2nd condition",
                "abbreviation": "  ",
                "description": "ming's second conditionally approved study",
            }
        }
    }
    srf = SRF(local_srf_data, system_populated_props)
    values = srf.get_system_populated_property_value_map()
    assert values == {
        "program_name": "My Program",
        "program_acronym": "MY_PROGRAM",
        "program_description": "Program description",
        "study_name": "Ming 2nd condition",
        "study_acronym": "",
        "study_description": "ming's second conditionally approved study",
    }

def test_empty_srf_data_still_return_propertys_with_empty_values():
    local_srf_data = {}
    srf = SRF(local_srf_data, system_populated_props)
    values = srf.get_system_populated_property_value_map()
    assert values == {
        "program_name": "",
        "program_acronym": "",
        "program_description": "",
        "study_name": "",
        "study_acronym": "",
        "study_description": "",
    }

def test_system_populated_relationship_value_map():
    srf = SRF(srf_data, system_populated_props, {})
    relationships = srf.get_system_populated_relationship_value_map()
    assert  relationships == {}

def test_system_populated_relationship_value_map_not_valid():
    local_relationships_mapping = {"property": "ProgramAcronym"}
    srf = SRF(srf_data, system_populated_props, local_relationships_mapping)
    relationships = srf.get_system_populated_relationship_value_map()
    assert  relationships == {}

def test_system_populated_relationship_value_map_not_valid2():
    local_relationships_mapping = {"program.program_acronym": "wrong system property"}
    srf = SRF(srf_data, system_populated_props, local_relationships_mapping)
    relationships = srf.get_system_populated_relationship_value_map()
    assert  relationships == {}

def test_system_populated_relationship_value_missing_srf_value():
    local_srf_data = {
        "questionnaireData": {
            "program": {
                "name": "My Program",
                "abbreviation": "  ",
                "description": "Program description"
            },
            "study": {
                "name": "Ming 2nd condition",
                "abbreviation": "  ",
                "description": "ming's second conditionally approved study",
            }
        }
    }
    srf = SRF(local_srf_data, system_populated_props, system_populated_relationships)
    relationships = srf.get_system_populated_relationship_value_map()
    assert relationships == {}
