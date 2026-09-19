from data_loader import DataLoader
from test.utils.metadata_validator import create_test_data_model
from unittest.mock import MagicMock

model = create_test_data_model()
dao = MagicMock()
dao.get_srf.return_value = {}

loader = DataLoader(model, {}, dao, "some bucket", "some path", "CRDC", {})

def test_data_loader():
    assert loader is not None

def test_get_node_id():
    id = loader.get_node_id("study", {"study_id": "my-id"}, {})
    assert id == 'my-id'

def test_get_node_id_with_auto_populate():
    id = loader.get_node_id("study", {}, {"study_id": "auto-id"})
    assert id == 'auto-id'

def test_get_node_id_preserver_user_id():
    id = loader.get_node_id("study", {"study_id": "my-id"}, {"study_id": "auto-id"})
    assert id == 'my-id'

def test_get_parents():
    parents = loader.get_parents({}, {})
    assert parents == []

def test_get_parents_with_parent_value_no_auto_populate():
    """parent provided in data, no auto_populate data available"""
    raw_data = {"some-prop": "some value","study.study_id": "parent-id"}
    populated = {}
    parents = loader.get_parents(["study.study_id"], raw_data, populated)
    assert parents == [{
        "parentType": "study",
        "parentIDPropName": "study_id",
        "parentIDValue": "parent-id"
    }]

def test_get_parents_with_parent_value_and_auto_populate():
    """parent provided in data, don't use auto_populate data event available"""
    raw_data = {"some-prop": "some value","study.study_id": "parent-id"}
    populated = {"study.study_id": "populated-id"}
    parents = loader.get_parents(["study.study_id"], raw_data, populated)
    assert parents == [{
        "parentType": "study",
        "parentIDPropName": "study_id",
        "parentIDValue": "parent-id"
    }]

def test_get_parents_with_empty_parent_value_match_auto_populate():
    """parent column exist, but empty value, use auto_populate data available"""
    raw_data = {"some-prop": "some value", "study.study_id": ""}
    populated = {"study.study_id": "populated-id"}
    parents = loader.get_parents({"study.study_id"}, raw_data, populated )
    assert parents == [{
        "parentType": "study",
        "parentIDPropName": "study_id",
        "parentIDValue": "populated-id"
    }]

def test_get_parents_with_blank_parent_value_match_auto_populate():
    """parent column exist, but only space/blank value, use auto_populate data available"""
    raw_data = {"some-prop": "some value", "study.study_id": "   "}
    populated = {"study.study_id": "populated-id"}
    parents = loader.get_parents({"study.study_id"}, raw_data, populated )
    assert parents == [{
        "parentType": "study",
        "parentIDPropName": "study_id",
        "parentIDValue": "populated-id"
    }]

def test_get_parents_with_blank_parent_value_un_matched_auto_populate():
    """parent column exist, but only space/blank value, no auto_populate data available"""
    raw_data = {"some-prop": "some value", "study.study_id": "   "}
    populated = {"other.other_id": "populated-id"}
    parents = loader.get_parents({"study.study_id"}, raw_data, populated )
    assert parents == []

def test_get_parents_with_no_parent_value_unmatch_auto_populate():
    """ parent column doesn't exist, do not auto populate """
    raw_data = {"some-prop": "some value"}
    populated = {"other.other_id": "other-id"}
    parents = loader.get_parents({"study.study_id"}, raw_data, populated )
    assert parents == []

def test_get_parents_with_no_parent_column_match_auto_populate():
    """ parent column doesn't exist, do not auto populate even with auto populate data available """
    raw_data = {"some-prop": "some value"}
    populated = {"study.study_id": "populated-id"}
    parents = loader.get_parents({"study.study_id"}, raw_data, populated )
    assert parents == []