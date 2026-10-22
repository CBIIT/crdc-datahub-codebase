import os
import sys
from unittest.mock import MagicMock

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
