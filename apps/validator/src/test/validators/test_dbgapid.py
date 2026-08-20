from test.utils.mock_metadata_validator import create_mock_validator

validator = create_mock_validator()

def test_validator():
    assert validator is not None