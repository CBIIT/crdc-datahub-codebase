import pytest
from datetime import datetime
from collections.abc import Callable

from scripts.validate_file_integrity import validate_file_integrity, validate_all_files_integrity, get_succeeded_result_file_name, \
get_failed_result_file_name

integrity_edge_cases = [
    pytest.param(None,  lambda x : {}, 'Invalid Parameter', id= 'Should detect None file_info'),
    pytest.param({}, lambda x : {}, 'Invalid Parameter', id='Should detect empty file_info'  ),
    pytest.param( "something", lambda x : {}, 'Invalid Parameter', id='Should detect wrong file_info type' ),
    pytest.param( {"size": 234}, lambda x: {}, 'Invalid Parameter', id='Should detect missing URI' ),
    pytest.param({"URI": "some uri"}, lambda x: {}, 'Invalid Parameter', id='Should detect missing size'),
    pytest.param( {"URI": "some uri", "size": 234}, lambda x: {'size': 234}, 'Succeeded', id='Should return Succeeded'),
    pytest.param( {"URI": "some uri", "size": '234'}, lambda x: {'size': 234}, 'Succeeded', id='Should return Succeeded for size as string'),
    pytest.param({"URI": "some uri", "size": 234}, lambda x: None, 'Missing', id='Should return Missing when header is None'),
    pytest.param({"URI": "some uri", "size": 234}, lambda x: {'size': 123}, 'Size Mismatch', id='Should return Succeeded'),
]

@pytest.mark.parametrize("file_info, get_file_header, expected", integrity_edge_cases)
def test_single_file_integrity(file_info: dict, get_file_header, expected: dict):
    result = validate_file_integrity(file_info, get_file_header)
    assert result == expected

def file_header(results: dict):
    return lambda x : results.get(x, None)

succeeded_file_uri_1 = 's3://bucket/my-study1/succeeded_file'
succeeded_file_info_1 = {'URI': succeeded_file_uri_1, 'size': 123, 'GUID': 'guid-1'}
succeeded_file_header_1 = {'size': 123}
succeeded_file_result_1 = {
    'Study ID': 'my-study1',
    'GUID': 'guid-1',
    'File Name': 'succeeded_file',
    'Location':succeeded_file_uri_1,
    'Result': 'Succeeded'
}

missing_file_uri_1 = 's3://bucket/my-study1/missing_file'
missing_file_info_1 = {'URI': missing_file_uri_1, 'size': 123, 'GUID': 'guid-2'}
missing_file_result_1 = {
    'Study ID': 'my-study1',
    'GUID': 'guid-2',
    'File Name': 'missing_file',
    'Location': missing_file_uri_1,
    'Result': 'Missing'
}

mismatch_file_uri_1 = 's3://bucket/my-study2/mismatch_file'
mismatch_file_info_1 = {'URI': mismatch_file_uri_1, 'size': 123, 'GUID': 'guid-3'}
mismatch_file_header_1 = {'size': 234}
mismatch_file_result_1 = {
    'Study ID': 'my-study2',
    'GUID': 'guid-3',
    'File Name': 'mismatch_file',
    'Location':mismatch_file_uri_1,
    'Result': 'Size Mismatch'
}

multi_file_integrity = [
    pytest.param([], file_header({}), ([], []), id='Should return empty lists for empty file list'),
    pytest.param([succeeded_file_info_1], file_header({succeeded_file_uri_1: succeeded_file_header_1}), ([succeeded_file_result_1], []), id='Should return succeeded result'),
    pytest.param([missing_file_info_1], file_header({}), ([], [missing_file_result_1]), id='Should return missing result'),
    pytest.param([mismatch_file_info_1], file_header({mismatch_file_uri_1: mismatch_file_header_1}),
                 ([], [mismatch_file_result_1]), id='Should return mismatch result'),
    pytest.param([mismatch_file_info_1, missing_file_info_1, succeeded_file_info_1], file_header({mismatch_file_uri_1: mismatch_file_header_1, succeeded_file_uri_1: succeeded_file_header_1}),
                 ([succeeded_file_result_1], [mismatch_file_result_1, missing_file_result_1]), id='Should return multiple results'),
]

@pytest.mark.parametrize("file_list, get_file_header, expected", multi_file_integrity)
def test_multiple_file_integrity(file_list: list, get_file_header, expected: list):
    result = validate_all_files_integrity(file_list, get_file_header)
    assert result == expected

intermediate_result_file = [
    pytest.param([], file_header({}), {'guid-13': {}, 'guid-14': {}}, ([], []), id='Should return empty lists for empty file list despite unrelated intermediate results'),
    pytest.param([succeeded_file_info_1], file_header({}), {'guid-1': 'Succeeded'}, ([succeeded_file_result_1], []), id='Should return succeeded result if in intermediate result' ),
    pytest.param([missing_file_info_1], file_header({}), {'guid-2': 'Missing'}, ([], [missing_file_result_1]), id='Should return missing result'),
    pytest.param([mismatch_file_info_1], file_header({}), {'guid-3': 'Size Mismatch'}, ([], [mismatch_file_result_1]), id='Should return mismatch result'),
    pytest.param([mismatch_file_info_1, missing_file_info_1, succeeded_file_info_1], file_header({}),
                 {'guid-1': 'Succeeded', 'guid-3': 'Size Mismatch'}, ([succeeded_file_result_1], [mismatch_file_result_1, missing_file_result_1]), id='Should return multiple results'),
]

@pytest.mark.parametrize("file_list, get_file_header, intermediate_results, expected", intermediate_result_file)
def test_using_intermediate_result_file(file_list: list, get_file_header: Callable[[str], dict] , intermediate_results: list, expected: list):
    result = validate_all_files_integrity(file_list, get_file_header, intermediate_results)
    assert result == expected

def test_writing_to_intermediate_result_file():
    intermediate_results = []
    def record_result(guid, status):
        intermediate_results.append({'GUID': guid, 'Result': status})
    result = validate_all_files_integrity([succeeded_file_info_1, missing_file_info_1], file_header({succeeded_file_uri_1: succeeded_file_header_1}), {}, record_result)
    assert result == ([succeeded_file_result_1], [missing_file_result_1])
    assert intermediate_results == [{'GUID': 'guid-1', 'Result': 'Succeeded'}, {'GUID': 'guid-2', 'Result': 'Missing' }]


def test_succeeded_result_file_name():
    date = datetime(2026, 9, 18, 15, 49, 9)
    result = get_succeeded_result_file_name(date, 143, 386)
    assert result == '2026-09-18T15-49-09_succeeded_143_of_386.csv'

def test_failed_result_file_name():
    date = datetime(2026, 9, 18, 15, 49, 9)
    result = get_failed_result_file_name(date, 13, 386)
    assert result == '2026-09-18T15-49-09_failed_13_of_386.csv'
