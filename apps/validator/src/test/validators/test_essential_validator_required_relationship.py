"""Unit tests for EssentialValidator.validate_data missing required relationship column check."""
import json
import os
import sys
from unittest.mock import MagicMock

import pandas as pd

_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, "src"))

from common.constants import ERRORS, FILE_NAME
from essential_validator import EssentialValidator

NODE_TYPE = "participant"
ID_FIELD = "participant_id"


def _make_validator(required_rel_columns):
    """Build an EssentialValidator with just enough state to reach the
    required-relationship check in validate_data, bypassing everything else."""
    validator = EssentialValidator(MagicMock(), MagicMock())
    validator.model = MagicMock()
    validator.model.get_node_keys.return_value = [NODE_TYPE]
    validator.model.get_node_id.return_value = ID_FIELD
    validator.model.get_composition_key.return_value = None
    validator.model.get_node_req_props.return_value = {}
    validator.model.get_node_req_rel_columns.return_value = required_rel_columns
    validator.model.get_node_relationships.return_value = {}
    validator.def_file_nodes = []
    validator.def_file_name = None
    validator.submission_intention = "New"
    validator.batch = {ERRORS: []}
    validator.df = pd.DataFrame({"type": [NODE_TYPE], ID_FIELD: ["p1"]})
    return validator


def _make_file_info():
    return {FILE_NAME: "test.tsv", ERRORS: []}


def test_missing_single_required_relationship_column():
    validator = _make_validator(["diagnosis.diagnosis_id"])
    file_info = _make_file_info()

    result = validator.validate_data(file_info)

    assert result is False
    expected_msg = f'“{file_info[FILE_NAME]}”: Relationship column "diagnosis.diagnosis_id" is required.'
    assert expected_msg in file_info[ERRORS]
    assert expected_msg in validator.batch[ERRORS]


def test_missing_multiple_required_relationship_columns():
    required_rels = ["diagnosis.diagnosis_id", "sample.sample_id"]
    validator = _make_validator(required_rels)
    file_info = _make_file_info()

    result = validator.validate_data(file_info)

    assert result is False
    expected_msg = f'“{file_info[FILE_NAME]}”: Relationship columns {json.dumps(required_rels)} are required.'
    assert expected_msg in file_info[ERRORS]
    assert expected_msg in validator.batch[ERRORS]


def test_no_missing_required_relationship_columns():
    validator = _make_validator([])
    file_info = _make_file_info()

    validator.validate_data(file_info)

    assert not any("Relationship column" in msg for msg in file_info[ERRORS])
    assert not any("Relationship column" in msg for msg in validator.batch[ERRORS])
