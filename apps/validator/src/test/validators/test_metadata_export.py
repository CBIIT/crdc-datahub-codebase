import os
import sys
from unittest.mock import MagicMock

import pytest

_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, "src"))

from metadata_export import ExportMetadata


def _make_export_metadata(submission_overrides=None, concierge_user=None):
    submission = {"conciergeID": "concierge-1"}
    if submission_overrides is not None:
        submission = submission_overrides

    mongo_dao = MagicMock()
    mongo_dao.find_user_by_id.return_value = concierge_user

    # Bypass __init__ (which creates a real S3Service/boto3 client) since only
    # mongo_dao/submission are needed to exercise _resolve_concierge.
    export_metadata = ExportMetadata.__new__(ExportMetadata)
    export_metadata.mongo_dao = mongo_dao
    export_metadata.submission = submission
    return export_metadata, mongo_dao


class TestResolveConcierge:

    def test_returns_name_and_email_when_concierge_found(self):
        gen, mongo_dao = _make_export_metadata(
            concierge_user={"firstName": "Jane", "lastName": "Doe", "email": "jane.doe@example.com"}
        )

        result = gen._resolve_concierge()

        mongo_dao.find_user_by_id.assert_called_once_with("concierge-1")
        assert result == {"name": "Jane Doe", "email": "jane.doe@example.com"}

    def test_returns_null_name_and_email_when_conciergeID_missing(self):
        gen, mongo_dao = _make_export_metadata(submission_overrides={"conciergeID": None})

        result = gen._resolve_concierge()

        mongo_dao.find_user_by_id.assert_not_called()
        assert result == {"name": None, "email": None}

    def test_returns_null_name_and_email_when_conciergeID_key_absent(self):
        gen, mongo_dao = _make_export_metadata(submission_overrides={})

        result = gen._resolve_concierge()

        mongo_dao.find_user_by_id.assert_not_called()
        assert result == {"name": None, "email": None}

    def test_returns_null_name_and_email_when_user_not_found(self):
        gen, mongo_dao = _make_export_metadata(concierge_user=None)

        result = gen._resolve_concierge()

        mongo_dao.find_user_by_id.assert_called_once_with("concierge-1")
        assert result == {"name": None, "email": None}

    def test_returns_null_name_when_first_and_last_name_missing(self):
        gen, _ = _make_export_metadata(
            concierge_user={"email": "no-name@example.com"}
        )

        result = gen._resolve_concierge()

        assert result == {"name": None, "email": "no-name@example.com"}

    def test_uses_only_available_name_part(self):
        gen, _ = _make_export_metadata(
            concierge_user={"firstName": "Jane", "email": "jane@example.com"}
        )

        result = gen._resolve_concierge()

        assert result == {"name": "Jane", "email": "jane@example.com"}

    def test_returns_null_email_when_email_missing(self):
        gen, _ = _make_export_metadata(
            concierge_user={"firstName": "Jane", "lastName": "Doe"}
        )

        result = gen._resolve_concierge()

        assert result == {"name": "Jane Doe", "email": None}

    def test_does_not_use_stale_conciergeName_conciergeEmail_fields_on_submission(self):
        # Regression test for CRDCDH-3771: these fields are never persisted on the
        # submission document, so they must not be relied upon.
        gen, mongo_dao = _make_export_metadata(
            submission_overrides={
                "conciergeID": "concierge-1",
                "conciergeName": "Stale Name",
                "conciergeEmail": "stale@example.com",
            },
            concierge_user={"firstName": "Jane", "lastName": "Doe", "email": "jane.doe@example.com"},
        )

        result = gen._resolve_concierge()

        mongo_dao.find_user_by_id.assert_called_once_with("concierge-1")
        assert result == {"name": "Jane Doe", "email": "jane.doe@example.com"}


def _make_export_metadata_with_submitter(submitter_user):
    export_metadata, mongo_dao = _make_export_metadata(
        submission_overrides={"submitterID": "submitter-1"},
        concierge_user=submitter_user,
    )
    return export_metadata, mongo_dao


class TestResolveSubmitter:
    """_resolve_submitter builds the nullable submitter block of the release manifest."""

    def test_institution_null_yields_null_institution(self):
        gen, mongo_dao = _make_export_metadata_with_submitter(
            {"firstName": "Ada", "lastName": "Admin", "email": "ada@example.com", "institution": None}
        )

        result = gen._resolve_submitter()

        mongo_dao.find_user_by_id.assert_called_once_with("submitter-1")
        assert result == {"name": "Ada Admin", "email": "ada@example.com", "institution": None}

    def test_institution_key_absent(self):
        gen, _ = _make_export_metadata_with_submitter(
            {"firstName": "Ada", "lastName": "Admin", "email": "ada@example.com"}
        )

        assert gen._resolve_submitter() == {"name": "Ada Admin", "email": "ada@example.com", "institution": None}

    def test_institution_name_is_used_when_present(self):
        gen, _ = _make_export_metadata_with_submitter(
            {"firstName": "Sam", "lastName": "Submitter", "email": "sam@example.com",
             "institution": {"_id": "inst-1", "name": "NCI", "status": "Active"}}
        )

        assert gen._resolve_submitter() == {"name": "Sam Submitter", "email": "sam@example.com", "institution": "NCI"}

    def test_institution_without_name_yields_null(self):
        gen, _ = _make_export_metadata_with_submitter(
            {"firstName": "Sam", "lastName": "Submitter", "email": "sam@example.com", "institution": {"_id": "inst-1"}}
        )

        assert gen._resolve_submitter()["institution"] is None

    def test_name_uses_available_parts(self):
        gen, _ = _make_export_metadata_with_submitter({"firstName": "Ada", "lastName": None, "email": "a@example.com"})
        assert gen._resolve_submitter()["name"] == "Ada"

        gen, _ = _make_export_metadata_with_submitter({"email": "a@example.com"})
        assert gen._resolve_submitter()["name"] is None

    def test_returns_none_when_user_not_found(self):
        gen, _ = _make_export_metadata_with_submitter(None)

        assert gen._resolve_submitter() is None


class TestExportDataToFileIncompleteSubmission:
    """export_data_to_file raises when the submission lacks the fields needed to export."""

    def _make(self, submission):
        export_metadata = ExportMetadata.__new__(ExportMetadata)
        export_metadata.mongo_dao = MagicMock()
        export_metadata.submission = submission
        export_metadata.model_store = MagicMock()
        export_metadata.s3_service = MagicMock()
        export_metadata.log = MagicMock()
        export_metadata.submission_type = None
        return export_metadata

    @pytest.mark.parametrize("missing", ["_id", "rootPath", "bucketName"])
    def test_missing_field_raises_before_model_lookup(self, missing):
        submission = {"_id": "sub-1", "rootPath": "submissions/sub-1", "bucketName": "bucket",
                      "dataCommons": "CDS", "studyID": "study-1"}
        submission[missing] = None
        export_metadata = self._make(submission)

        with pytest.raises(ValueError, match="incomplete data in the submission"):
            export_metadata.export_data_to_file()

        export_metadata.model_store.get_model_by_data_common_version.assert_not_called()
        export_metadata.s3_service.archive_s3_if_exists.assert_not_called()
        export_metadata.log.error.assert_called_once()
