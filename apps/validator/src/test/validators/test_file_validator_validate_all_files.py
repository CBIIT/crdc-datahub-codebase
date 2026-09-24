"""Tests for FileValidator.validate_all_files (submission-wide / orphan S3 files)."""
from unittest.mock import MagicMock

import pytest

from common import constants
from file_validator import FileValidator


class _S3Object:
    def __init__(self, key, last_modified=None):
        self.key = key
        self.last_modified = last_modified


def _validator_with_s3(mock_dao, submission, s3_objects):
    """Build a FileValidator with a mocked S3 listing (avoid real boto3 in get_root_path)."""
    mock_dao.get_submission.return_value = submission
    validator = FileValidator(mock_dao)
    validator.submission = submission
    validator.rootPath = submission["rootPath"]
    validator.bucket_name = submission[constants.BATCH_BUCKET]
    mock_bucket = MagicMock()
    mock_bucket.bucket.objects.filter.return_value = s3_objects
    validator.bucket = mock_bucket
    validator.get_root_path = MagicMock(return_value=True)
    return validator


@pytest.fixture
def submission_doc():
    return {
        constants.ID: "sub-1",
        "rootPath": "submissions/sub-1",
        constants.BATCH_BUCKET: "test-bucket",
        constants.SUBMISSION_INTENTION: "Update",
    }


def test_validate_all_files_no_records_but_s3_orphans_returns_error(submission_doc):
    mock_dao = MagicMock()
    mock_dao.get_files_by_submission.return_value = []
    mock_dao.find_batch_by_file_name.return_value = None

    validator = _validator_with_s3(
        mock_dao,
        submission_doc,
        [_S3Object("submissions/sub-1/file/orphan.csv", "2024-01-01T00:00:00Z")],
    )

    status, errors = validator.validate_all_files("sub-1")

    assert status == constants.STATUS_ERROR
    assert len(errors) == 1
    assert errors[0][constants.SUBMITTED_ID] == "orphan.csv"
    assert errors[0][constants.ERRORS][0]["code"] == "F008"


def test_validate_all_files_no_records_and_empty_s3_returns_none(submission_doc):
    mock_dao = MagicMock()
    mock_dao.get_files_by_submission.return_value = []

    validator = _validator_with_s3(mock_dao, submission_doc, [])

    status, errors = validator.validate_all_files("sub-1")

    assert status is None
    assert errors is None


def test_validate_all_files_skips_log_keys_when_no_records(submission_doc):
    mock_dao = MagicMock()
    mock_dao.get_files_by_submission.return_value = []

    validator = _validator_with_s3(
        mock_dao,
        submission_doc,
        [
            _S3Object("submissions/sub-1/file/log/audit.txt"),
            _S3Object("submissions/sub-1/file/real.csv"),
        ],
    )

    status, errors = validator.validate_all_files("sub-1")

    assert status == constants.STATUS_ERROR
    assert len(errors) == 1
    assert errors[0][constants.SUBMITTED_ID] == "real.csv"


def test_validate_all_files_with_manifest_still_reports_extra_s3(submission_doc):
    mock_dao = MagicMock()
    mock_dao.get_files_by_submission.return_value = [
        {
            constants.ID: "rec-1",
            constants.S3_FILE_INFO: {
                constants.FILE_NAME: "in_manifest.csv",
                constants.STATUS: constants.STATUS_PASSED,
            },
        }
    ]
    mock_dao.find_batch_by_file_name.return_value = None

    validator = _validator_with_s3(
        mock_dao,
        submission_doc,
        [
            _S3Object("submissions/sub-1/file/in_manifest.csv"),
            _S3Object("submissions/sub-1/file/extra.csv"),
        ],
    )

    status, errors = validator.validate_all_files("sub-1")

    assert status == constants.STATUS_ERROR
    assert len(errors) == 1
    assert errors[0][constants.SUBMITTED_ID] == "extra.csv"
