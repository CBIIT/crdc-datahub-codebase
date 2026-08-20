from test.utils.mock_metadata_validator import create_mock_validator, default_study

test_study = default_study.copy()
test_study.update({
    'dbGaPID': "dbgap_id_1",
})

validator = create_mock_validator(test_study=test_study)

def test_validator():
    assert validator is not None

def test_validator_has_dbgapid():
    assert validator.dbGaPID == "dbgap_id_1"

