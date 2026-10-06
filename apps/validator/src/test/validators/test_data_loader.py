from data_loader import DataLoader
from test.utils.metadata_validator import create_test_data_model
from unittest.mock import MagicMock
from common.constants import ID, SUBMISSION_ID, DISPLAY_ID, STUDY_ID, RAW_DATA, PARENTS

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

def test_get_parents_with_none_parent_value_match_auto_populate():
    """parent column exist, but only space/blank value, use auto_populate data available"""
    raw_data = {"some-prop": "some value", "study.study_id": None}
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
    """ parent column doesn't exist, auto populate if auto populate data available """
    raw_data = {"some-prop": "some value"}
    populated = {"study.study_id": "populated-id"}
    parents = loader.get_parents({"study.study_id"}, raw_data, populated )
    assert parents == [{
        "parentType": "study",
        "parentIDPropName": "study_id",
        "parentIDValue": "populated-id"
    }]

def test_load_data_keeps_parent_sorting_keys_on_raw_data(tmp_path):
    """Parent columns are stored on rawData with '.' replaced by '|'.

    Sorting by a parent column reads that pipe key from rawData. get_parents
    writes the key onto the dict it is given, so load_data must pass that same
    rawData dict (the object stored as rawData) into get_parents.
    """
    metadata_file = tmp_path / "study.tsv"
    metadata_file.write_text(
        "type\tstudy_id\tprogram.program_acronym\n"
        "study\tstudy-1\tMY_PROGRAM\n"
    )

    mongo_dao = MagicMock()
    mongo_dao.get_srf.return_value = {}
    mongo_dao.get_dataRecord_by_node.return_value = None
    mongo_dao.search_node.return_value = None
    mongo_dao.search_node_by_study.return_value = None
    mongo_dao.update_data_records.return_value = (True, None)

    batch_loader = DataLoader(
        model,
        {ID: "batch-1", SUBMISSION_ID: "submission-1", DISPLAY_ID: "B-1"},
        mongo_dao,
        "some bucket",
        "some path",
        "CRDC",
        {STUDY_ID: "study-1"},
    )

    loaded, errors = batch_loader.load_data([str(metadata_file)])

    assert loaded is True
    assert errors == []
    records = mongo_dao.update_data_records.call_args.args[0]
    assert len(records) == 1
    raw_data = records[0][RAW_DATA]
    assert raw_data["program.program_acronym"] == "MY_PROGRAM"
    assert raw_data["program|program_acronym"] == "MY_PROGRAM"
    assert records[0][PARENTS] == [{
        "parentType": "program",
        "parentIDPropName": "program_acronym",
        "parentIDValue": "MY_PROGRAM",
    }]