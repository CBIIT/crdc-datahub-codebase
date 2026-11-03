"""Unit tests for YamlModelParser item_type / Enum normalization.

item_type and Enum may be a type name, a list of allowed values, a {pattern: ...} dict, or a
{value_type: ...} dict; unsupported shapes are ignored with a warning.
"""
import os
import sys
from unittest.mock import MagicMock

_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, "src"))

from common.constants import ALLOWED_VALUES, TYPE, PROPERTY_PATTERN
from common.model_reader import (
    YamlModelParser,
    DEFAULT_TYPE,
    ITEM_TYPE,
    PROP_DEFINITIONS,
    PROP_TYPE,
    PROP_ENUM,
    VALUE_TYPE,
    HAS_UNIT,
)


def _make_parser(prop_definitions=None):
    """Build a YamlModelParser without reading files (bypass __init__)."""
    parser = YamlModelParser.__new__(YamlModelParser)
    parser.log = MagicMock()
    parser.schema = {PROP_DEFINITIONS: prop_definitions or {}}
    parser.nodes = {}
    return parser


class TestGetItemType:
    def test_string_is_returned_as_is(self):
        parser = _make_parser()
        assert parser._get_item_type("integer", "p") == "integer"

    def test_list_becomes_enum_without_urls(self):
        parser = _make_parser()
        result = parser._get_item_type(["a", "b", "https://x.org/term"], "p")
        assert result[TYPE] == DEFAULT_TYPE
        assert sorted(result[ALLOWED_VALUES]) == ["a", "b"]

    def test_list_of_only_urls_is_none(self):
        parser = _make_parser()
        assert parser._get_item_type(["https://x.org/term"], "p") is None

    def test_pattern_dict_is_preserved(self):
        parser = _make_parser()
        result = parser._get_item_type({PROPERTY_PATTERN: "^https:\\/\\/"}, "p")
        assert result == {TYPE: PROPERTY_PATTERN, PROPERTY_PATTERN: "^https:\\/\\/"}
        parser.log.error.assert_not_called()
        parser.log.warning.assert_not_called()

    def test_value_type_dict_returns_type_name(self):
        parser = _make_parser()
        assert parser._get_item_type({VALUE_TYPE: "integer", "units": ["kg"]}, "p") == "integer"
        parser.log.error.assert_not_called()

    def test_unknown_value_type_falls_back_to_default(self):
        parser = _make_parser()
        assert parser._get_item_type({VALUE_TYPE: "not-a-type"}, "p") == DEFAULT_TYPE

    def test_unsupported_dict_warns_and_returns_none(self):
        parser = _make_parser()
        assert parser._get_item_type({"something": 1}, "my_prop") is None
        parser.log.error.assert_not_called()
        parser.log.warning.assert_called_once()
        assert "my_prop" in parser.log.warning.call_args.args[0]


class TestGetPropDetailListTypes:
    def test_list_with_pattern_item_type(self):
        parser = _make_parser({
            "urls": {PROP_TYPE: {VALUE_TYPE: "list", ITEM_TYPE: {PROPERTY_PATTERN: "^https:\\/\\/"}}}
        })

        detail = parser.get_prop_detail("urls")

        assert detail[TYPE] == "value-list"
        assert detail[ITEM_TYPE] == {TYPE: PROPERTY_PATTERN, PROPERTY_PATTERN: "^https:\\/\\/"}
        parser.log.error.assert_not_called()

    def test_list_with_enum_sets_allowed_values(self):
        parser = _make_parser({
            "colors": {PROP_TYPE: {VALUE_TYPE: "list", PROP_ENUM: ["red", "blue"]}}
        })

        detail = parser.get_prop_detail("colors")

        assert detail[TYPE] == "value-list"
        assert sorted(detail[ALLOWED_VALUES]) == ["blue", "red"]

    def test_scalar_with_enum_sets_item_type_and_allowed_values(self):
        parser = _make_parser({
            "color": {PROP_TYPE: {VALUE_TYPE: "string", PROP_ENUM: ["red", "blue"]}}
        })

        detail = parser.get_prop_detail("color")

        assert detail[ITEM_TYPE] == DEFAULT_TYPE
        assert sorted(detail[ALLOWED_VALUES]) == ["blue", "red"]

    def test_dict_valued_enum_is_skipped_with_warning(self):
        parser = _make_parser({
            "weird": {PROP_TYPE: {VALUE_TYPE: "list", PROP_ENUM: {PROPERTY_PATTERN: "^x"}}}
        })

        detail = parser.get_prop_detail("weird")

        assert ALLOWED_VALUES not in detail
        parser.log.warning.assert_called()

    def test_enum_of_only_urls_sets_no_allowed_values(self):
        parser = _make_parser({
            "terms": {PROP_TYPE: {VALUE_TYPE: "list", PROP_ENUM: ["https://x.org/a"]}}
        })

        detail = parser.get_prop_detail("terms")

        assert ALLOWED_VALUES not in detail

    def test_units_still_sets_has_unit(self):
        parser = _make_parser({
            "weight": {PROP_TYPE: {VALUE_TYPE: "integer", "units": ["kg", "lbs"]}}
        })

        detail = parser.get_prop_detail("weight")

        assert detail[TYPE] == "integer"
        assert detail[HAS_UNIT] is True
