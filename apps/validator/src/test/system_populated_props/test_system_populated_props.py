from common.system_populated_props import backfill_missing_or_empty_properties

def test_replace_missing_or_empty_properties():
    original = {"abc": "123"}
    updated = {}
    result = backfill_missing_or_empty_properties(original, updated)
    assert result == {}

def test_replace_missing_properties():
    original = {"abc": "", "def": 2}
    updated = {"ghi": "hello"}
    result = backfill_missing_or_empty_properties(original, updated)
    assert result == {"ghi": "hello"}

def test_replace_empty_properties():
    original = {"abc": "", "def": 2}
    updated = {"abc": "hello", "ghi": "world"}
    result = backfill_missing_or_empty_properties(original, updated)
    assert result == {"abc": "hello", "ghi": "world"}
