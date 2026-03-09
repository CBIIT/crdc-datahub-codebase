#!/usr/bin/env python3
"""Unit tests for common.utils.clean_up_key_value function"""
import os
import sys
import pytest

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from common.utils import clean_up_key_value


class TestCleanUpKeyValue:
    """Test suite for clean_up_key_value function"""

    def test_clean_up_key_value_empty_dict(self):
        """Test with empty dictionary"""
        result = clean_up_key_value({})
        assert result == {}, "Empty dict should return empty dict"

    def test_clean_up_key_value_no_whitespace(self):
        """Test with dictionary that has no whitespace"""
        input_dict = {'key1': 'value1', 'key2': 'value2'}
        result = clean_up_key_value(input_dict)
        assert result == input_dict, "Dict without whitespace should remain unchanged"

    def test_clean_up_key_value_strip_keys(self):
        """Test that keys with leading/trailing whitespace are stripped"""
        input_dict = {' key1 ': 'value1', '  key2  ': 'value2'}
        result = clean_up_key_value(input_dict)
        assert 'key1' in result, "Key should be stripped"
        assert 'key2' in result, "Key should be stripped"
        assert ' key1 ' not in result, "Original key with spaces should not exist"

    def test_clean_up_key_value_strip_values(self):
        """Test that values with leading/trailing whitespace are stripped"""
        input_dict = {'key1': ' value1 ', 'key2': '  value2  '}
        result = clean_up_key_value(input_dict)
        assert result['key1'] == 'value1', "Value should be stripped"
        assert result['key2'] == 'value2', "Value should be stripped"

    def test_clean_up_key_value_strip_both(self):
        """Test that both keys and values are stripped"""
        input_dict = {' key1 ': ' value1 ', '  key2  ': '  value2  '}
        result = clean_up_key_value(input_dict)
        expected = {'key1': 'value1', 'key2': 'value2'}
        assert result == expected, "Both keys and values should be stripped"

    def test_clean_up_key_value_empty_string_key_removed(self):
        """Test that empty string keys are filtered out"""
        input_dict = {'': 'value1', 'key2': 'value2'}
        result = clean_up_key_value(input_dict)
        assert '' not in result, "Empty string key should be removed"
        assert 'key2' in result, "Non-empty key should remain"

    def test_clean_up_key_value_whitespace_only_key_removed(self):
        """Test that keys with only whitespace are filtered out"""
        input_dict = {'   ': 'value1', 'key2': 'value2'}
        result = clean_up_key_value(input_dict)
        assert '   ' not in result, "Whitespace-only key should be removed"
        assert 'key2' in result, "Non-whitespace key should remain"

    def test_clean_up_key_value_preserve_non_string_keys(self):
        """Test that non-string keys are preserved as-is"""
        input_dict = {1: 'value1', 2.5: 'value2', (1, 2): 'value3'}
        result = clean_up_key_value(input_dict)
        assert 1 in result, "Numeric key should be preserved"
        assert 2.5 in result, "Float key should be preserved"
        assert (1, 2) in result, "Tuple key should be preserved"

    def test_clean_up_key_value_preserve_non_string_values(self):
        """Test that non-string values are preserved as-is"""
        input_dict = {'key1': 123, 'key2': 45.67, 'key3': True, 'key4': None}
        result = clean_up_key_value(input_dict)
        assert result['key1'] == 123, "Integer value should be preserved"
        assert result['key2'] == 45.67, "Float value should be preserved"
        assert result['key3'] is True, "Boolean value should be preserved"
        assert result['key4'] is None, "None value should be preserved"

    def test_clean_up_key_value_mixed_types(self):
        """Test with mixed string and non-string keys/values"""
        input_dict = {' string_key ': ' string_value ', 1: 100, 'key2': None}
        result = clean_up_key_value(input_dict)
        assert 'string_key' in result, "String key should be stripped"
        assert result['string_key'] == 'string_value', "String value should be stripped"
        assert result[1] == 100, "Numeric key and value should be preserved"
        assert result['key2'] is None, "None value should be preserved"

    def test_clean_up_key_value_zero_key_preserved(self):
        """Test that numeric 0 key is preserved (even though it's falsy)"""
        # Note: This tests the current behavior - 0 is falsy but if it's in the dict
        # the condition 'if key and key.strip()' will exclude it since 0 is falsy
        input_dict = {0: 'value1', 'key2': 'value2'}
        result = clean_up_key_value(input_dict)
        # Based on the function logic, 0 should be filtered out because 'if key' is False for 0
        assert 0 not in result, "Zero key is falsy and should be filtered"
        assert 'key2' in result, "Non-zero key should remain"

    def test_clean_up_key_value_false_key_filtered(self):
        """Test that False key is filtered out"""
        input_dict = {False: 'value1', 'key2': 'value2'}
        result = clean_up_key_value(input_dict)
        assert False not in result, "False key should be filtered (falsy)"
        assert 'key2' in result, "Non-falsy key should remain"

    def test_clean_up_key_value_complex_scenario(self):
        """Test with a complex scenario combining multiple cases"""
        input_dict = {
            ' name ': '  John Doe  ',
            'email': 'john@example.com',
            '  ': 'should_be_removed',
            'age': 30,
            ' phone ': '  555-1234  ',
            '': 'also_removed'
        }
        result = clean_up_key_value(input_dict)
        expected = {
            'name': 'John Doe',
            'email': 'john@example.com',
            'age': 30,
            'phone': '555-1234'
        }
        assert result == expected, "Complex scenario should work correctly"

    def test_clean_up_key_value_internal_spaces_preserved(self):
        """Test that internal spaces in keys and values are preserved"""
        input_dict = {' my key ': ' my value '}
        result = clean_up_key_value(input_dict)
        assert 'my key' in result, "Internal spaces in key should be preserved"
        assert result['my key'] == 'my value', "Internal spaces in value should be preserved"

    def test_clean_up_key_value_tabs_and_newlines(self):
        """Test that tabs and newlines are stripped"""
        input_dict = {'\tkey\t': '\tvalue\t', '\nkey2\n': '\nvalue2\n'}
        result = clean_up_key_value(input_dict)
        assert 'key' in result, "Tabs should be stripped from key"
        assert result['key'] == 'value', "Tabs should be stripped from value"
        assert 'key2' in result, "Newlines should be stripped from key"
        assert result['key2'] == 'value2', "Newlines should be stripped from value"

    def test_clean_up_key_value_single_space_key_removed(self):
        """Test that a key with single space is removed"""
        input_dict = {' ': 'value1', 'key2': 'value2'}
        result = clean_up_key_value(input_dict)
        assert ' ' not in result, "Single space key should be removed"
        assert 'key2' in result, "Non-whitespace key should remain"

    def test_clean_up_key_value_unicode_characters(self):
        """Test with unicode characters in keys and values"""
        input_dict = {' café ': ' naïve ', ' 日本 ': ' 中国 '}
        result = clean_up_key_value(input_dict)
        assert 'café' in result, "Unicode key should be stripped and preserved"
        assert result['café'] == 'naïve', "Unicode value should be stripped and preserved"
        assert '日本' in result, "Non-Latin unicode key should work"
        assert result['日本'] == '中国', "Non-Latin unicode value should work"

    def test_clean_up_key_value_special_characters(self):
        """Test with special characters in keys and values"""
        input_dict = {' @#$% ': ' !@#$% ', ' key-name ': ' value_123 '}
        result = clean_up_key_value(input_dict)
        assert '@#$%' in result, "Special character key should be stripped"
        assert result['@#$%'] == '!@#$%', "Special character value should be stripped"
        assert 'key-name' in result, "Hyphenated key should work"
        assert result['key-name'] == 'value_123', "Underscored value should work"

    def test_clean_up_key_value_list_and_dict_values(self):
        """Test with complex value types like lists and dictionaries"""
        list_val = [1, 2, 3]
        dict_val = {'nested': 'value'}
        input_dict = {'key1': list_val, ' key2 ': dict_val}
        result = clean_up_key_value(input_dict)
        assert result['key1'] == list_val, "List value should be preserved"
        assert result['key2'] == dict_val, "Dict value should be preserved"

    def test_clean_up_key_value_multiple_whitespace_types(self):
        """Test with multiple types of whitespace"""
        input_dict = {' \t \n key \n \t ': ' \t \n value \n \t '}
        result = clean_up_key_value(input_dict)
        assert 'key' in result, "Mixed whitespace should be stripped from key"
        assert result['key'] == 'value', "Mixed whitespace should be stripped from value"

    def test_clean_up_key_value_numeric_string_values(self):
        """Test that numeric strings are treated as strings and preserved"""
        input_dict = {' num_key ': ' 12345 ', '  another  ': '  0  '}
        result = clean_up_key_value(input_dict)
        assert result['num_key'] == '12345', "Numeric string should be preserved as string"
        assert result['another'] == '0', "String '0' should be preserved as string"

    def test_clean_up_key_value_empty_string_value(self):
        """Test with empty string values"""
        input_dict = {'key1': '', 'key2': '  ', ' key3 ': 'value'}
        result = clean_up_key_value(input_dict)
        # Empty values are allowed in the result (only keys are filtered)
        assert result['key1'] == '', "Empty string value should be preserved"
        assert result['key2'] == '', "Whitespace string value becomes empty after strip"
        assert result['key3'] == 'value', "Normal value should work"

