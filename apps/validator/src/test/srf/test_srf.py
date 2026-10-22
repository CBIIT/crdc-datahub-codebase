from common.srf import SRF
import json
import pytest

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


get_property_value_test_data = [
    pytest.param({}, {}, "study_name", None, id="Empty srf with no system populated props should return None"),
    pytest.param(srf_data, {}, "study_name", None, id="Srf with no system populated props should return None"),
    pytest.param(
        {"questionnaireData": {"study": {"name": "  "}}},
        system_populated_props,
        "study_name",
        "",
        id="Whitespace-only srf value should return empty string",
    ),
    pytest.param(srf_data, system_populated_props, "study_name", "Ming 2nd condition", id="Should get study name"),
    pytest.param(srf_data, system_populated_props, "program_name", "My Program", id="Should get program name"),
    pytest.param({}, system_populated_props, "program_name", "", id="Empty srf should return empty string for mapped property"),
    pytest.param(
        {"questionnaireData": json.dumps(srf_data["questionnaireData"])},
        system_populated_props,
        "study_acronym",
        "MING-COND-2",
        id="String questionnaire data should get study acronym",
    ),
]

@pytest.mark.parametrize("srf_data, system_populated_porps, prop, expected", get_property_value_test_data)
def test_get_property_value(srf_data, system_populated_porps, prop, expected):
    srf = SRF(srf_data, system_populated_porps)
    assert srf._get_property_value(prop) == expected

property_value_map_test_data = [
    pytest.param(srf_data, {}, {}, id="No system populated props should get empty dict"),
    pytest.param(
        srf_data,
        system_populated_props,
        {
            "program_name": "My Program",
            "program_acronym": "MY_PROGRAM",
            "program_description": "Program description",
            "study_name": "Ming 2nd condition",
            "study_acronym": "MING-COND-2",
            "study_description": "ming's second conditionally approved study",
        },
        id="Should get correct property value map",
    ),
    pytest.param(
        {
            "questionnaireData": {
                "program": {
                    "name": "My Program",
                    "abbreviation": "MY_PROGRAM",
                    "description": "Program description",
                },
                "study": {
                    "name": "Ming 2nd condition",
                    "abbreviation": "  ",
                    "description": "ming's second conditionally approved study",
                },
            }
        },
        system_populated_props,
        {
            "program_name": "My Program",
            "program_acronym": "MY_PROGRAM",
            "program_description": "Program description",
            "study_name": "Ming 2nd condition",
            "study_acronym": "",
            "study_description": "ming's second conditionally approved study",
        },
        id="Blank srf value should get empty string in property map",
    ),
    pytest.param(
        {},
        system_populated_props,
        {
            "program_name": "",
            "program_acronym": "",
            "program_description": "",
            "study_name": "",
            "study_acronym": "",
            "study_description": "",
        },
        id="Empty srf should return properties with empty values",
    ),
]

@pytest.mark.parametrize("srf_data, system_populated_porps, expected", property_value_map_test_data)
def test_get_system_populated_property_value_map(srf_data, system_populated_porps, expected):
    srf = SRF(srf_data, system_populated_porps)
    values = srf.get_system_populated_property_value_map()
    assert values == expected

test_data = [
    pytest.param(srf_data, system_populated_props, {"program.program_acronym": "ProgramAcronym"}, {"program.program_acronym": "MY_PROGRAM" }, id="Should get correct relationship dict"),
    pytest.param(srf_data, system_populated_props, {}, {}, id="Empty system populated relationships should get empty relationship dict"),
    pytest.param(srf_data, system_populated_props, {"property": "ProgramAcronym"}, {}, id="Invalid relationship column name should get empty relationship dict"),
    pytest.param(srf_data, system_populated_props, {"program.program_acronym": "wrong system prop"}, {}, id="Invalid system property should get empty relationship dict"),
    pytest.param({
        "questionnaireData": { "program": { "abbreviation": "  ", }}}, system_populated_props, system_populated_relationships, {}, id="Blank srf value should get empty relationship dict"),
    pytest.param({}, system_populated_props, system_populated_relationships, {}, id="Empty srf should get empty relationship dict"),
]

@pytest.mark.parametrize("srf_data, system_populated_porps, system_populated_rels, expected", test_data)
def test_get_system_populated_relationship_value_map(srf_data, system_populated_porps, system_populated_rels, expected):
    srf = SRF(srf_data, system_populated_porps, system_populated_rels)
    relationships = srf.get_system_populated_relationship_value_map()
    assert relationships == expected
