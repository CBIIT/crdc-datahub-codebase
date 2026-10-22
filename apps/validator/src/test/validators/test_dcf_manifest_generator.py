
import json
import os
import sys
from unittest.mock import MagicMock

_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, "src"))

from common.constants import (
    ID, ROOT_PATH, BATCH_BUCKET,
    CONTROL_ACCESS, DBGA_PID, STUDY_ID, NODE_ID, DCF_PREFIX,
    S3_FILE_INFO, MD5, SIZE, FILE_NAME, CONSENT_CODE,
    PROD_BUCKET_CONFIG_NAME,
)
from dcf_manifest_generator import GenerateDCF


def _make_generator(submission_overrides=None, file_nodes=None, release_manifest_data=None):
    base_submission = {
        ID: "sub-1",
        ROOT_PATH: "submissions/sub-1",
        BATCH_BUCKET: "test-bucket",
        STUDY_ID: "study-1",
        CONTROL_ACCESS: False,
        DBGA_PID: None,
    }
    if submission_overrides:
        base_submission.update(submission_overrides)

    configs = {PROD_BUCKET_CONFIG_NAME: "prod-bucket"}

    mongo_dao = MagicMock()
    mongo_dao.get_files_by_submission.return_value = file_nodes if file_nodes is not None else []

    s3_service = MagicMock()

    manifest_data = release_manifest_data if release_manifest_data is not None else {
        "metadata files": {"dcf manifest file path": ""}
    }

    return GenerateDCF(configs, mongo_dao, base_submission, s3_service, manifest_data)


def _make_file_node(node_id="file-1", md5="abc123", size=1024, file_name="file.bam", consent_codes=None):
    node = {
        NODE_ID: node_id,
        S3_FILE_INFO: {MD5: md5, SIZE: size, FILE_NAME: file_name},
    }
    if consent_codes is not None:
        node[CONSENT_CODE] = consent_codes
    return node


# ---------------------------------------------------------------------------
# _build_rows
# ---------------------------------------------------------------------------

class TestBuildRows:

    def test_returns_none_when_no_file_nodes(self):
        gen = _make_generator(file_nodes=[])
        rows, columns = gen._build_rows()
        assert rows is None
        assert columns is None

    def test_returns_none_when_controlled_access_missing_dbgapid(self):
        gen = _make_generator(
            submission_overrides={CONTROL_ACCESS: True, DBGA_PID: None},
            file_nodes=[_make_file_node()]
        )
        rows, columns = gen._build_rows()
        assert rows is None

    def test_open_access_row_has_wildcard_acl(self):
        gen = _make_generator(
            submission_overrides={CONTROL_ACCESS: False},
            file_nodes=[_make_file_node(node_id="file-1", md5="md5", size=100, file_name="f.bam")]
        )
        rows, columns = gen._build_rows()
        assert rows is not None
        assert rows[0]["acl"] == "['*']"
        assert rows[0]["authz"] == "['/open']"

    def test_controlled_access_row_uses_dbgapid(self):
        gen = _make_generator(
            submission_overrides={CONTROL_ACCESS: True, DBGA_PID: "phs000001.v1"},
            file_nodes=[_make_file_node()]
        )
        rows, _ = gen._build_rows()
        assert rows is not None
        assert rows[0]["acl"] == '["phs000001"]'
        assert rows[0]["authz"] == '["/programs/phs000001"]'

    def test_consent_code_open_data_code(self):
        gen = _make_generator(
            submission_overrides={CONTROL_ACCESS: True, DBGA_PID: "phs000002"},
            file_nodes=[_make_file_node(consent_codes=["-1"])]
        )
        rows, _ = gen._build_rows()
        acl = json.loads(rows[0]["acl"])
        authz = json.loads(rows[0]["authz"])
        assert "*" in acl
        assert "/open" in authz

    def test_consent_code_controlled_access(self):
        gen = _make_generator(
            submission_overrides={CONTROL_ACCESS: True, DBGA_PID: "phs000003"},
            file_nodes=[_make_file_node(consent_codes=["1", "2"])]
        )
        rows, _ = gen._build_rows()
        acl = json.loads(rows[0]["acl"])
        assert "phs000003.c1" in acl
        assert "phs000003.c2" in acl

    def test_node_id_without_dcf_prefix_gets_prefixed(self):
        gen = _make_generator(file_nodes=[_make_file_node(node_id="raw-id")])
        rows, _ = gen._build_rows()
        assert rows[0]["guid"] == DCF_PREFIX + "raw-id"

    def test_node_id_already_prefixed_is_unchanged(self):
        gen = _make_generator(file_nodes=[_make_file_node(node_id=DCF_PREFIX + "raw-id")])
        rows, _ = gen._build_rows()
        assert rows[0]["guid"] == DCF_PREFIX + "raw-id"

    def test_url_combines_prod_bucket_study_and_filename(self):
        gen = _make_generator(
            submission_overrides={STUDY_ID: "study-99"},
            file_nodes=[_make_file_node(file_name="data.bam")]
        )
        rows, _ = gen._build_rows()
        assert "prod-bucket" in rows[0]["urls"]
        assert "study-99" in rows[0]["urls"]
        assert "data.bam" in rows[0]["urls"]

    def test_columns_order(self):
        gen = _make_generator(file_nodes=[_make_file_node()])
        _, columns = gen._build_rows()
        assert columns == ["guid", "md5", "size", "acl", "authz", "urls"]

    def test_multiple_file_nodes_produce_multiple_rows(self):
        nodes = [_make_file_node(node_id=f"f-{i}") for i in range(3)]
        gen = _make_generator(file_nodes=nodes)
        rows, _ = gen._build_rows()
        assert len(rows) == 3


# ---------------------------------------------------------------------------
# generate_dcf_preview
# ---------------------------------------------------------------------------

class TestGenerateDCFPreview:

    def test_returns_false_when_no_file_nodes(self):
        gen = _make_generator(file_nodes=[])
        result = gen.generate_dcf_preview()
        assert result is False
        gen.s3_service.upload_file_to_s3.assert_not_called()

    def test_uploads_to_fixed_path(self):
        gen = _make_generator(file_nodes=[_make_file_node()])
        gen.generate_dcf_preview()
        call_args = gen.s3_service.upload_file_to_s3.call_args
        s3_key = call_args[0][2]
        assert s3_key == "submissions/sub-1/dcf_manifest.tsv"

    def test_uses_submission_bucket(self):
        gen = _make_generator(file_nodes=[_make_file_node()])
        gen.generate_dcf_preview()
        call_args = gen.s3_service.upload_file_to_s3.call_args
        bucket = call_args[0][1]
        assert bucket == "test-bucket"

    def test_does_not_mutate_release_manifest_data(self):
        manifest_data = {"metadata files": {"dcf manifest file path": ""}}
        gen = _make_generator(file_nodes=[_make_file_node()], release_manifest_data=manifest_data)
        gen.generate_dcf_preview()
        assert manifest_data["metadata files"]["dcf manifest file path"] == ""

    def test_returns_true_on_success(self):
        gen = _make_generator(file_nodes=[_make_file_node()])
        result = gen.generate_dcf_preview()
        assert result is True

    def test_returns_false_on_s3_upload_failure(self):
        gen = _make_generator(file_nodes=[_make_file_node()])
        gen.s3_service.upload_file_to_s3.side_effect = Exception("S3 error")
        result = gen.generate_dcf_preview()
        assert result is False

    def test_preview_path_differs_from_release_path(self):
        gen = _make_generator(file_nodes=[_make_file_node()])
        gen.generate_dcf_preview()
        s3_key = gen.s3_service.upload_file_to_s3.call_args[0][2]
        assert "release" not in s3_key
        assert "indexd" not in s3_key


# ---------------------------------------------------------------------------
# generate_dcf (existing behaviour is unchanged)
# ---------------------------------------------------------------------------

class TestGenerateDCFUnchanged:

    def test_returns_false_when_no_file_nodes(self):
        gen = _make_generator(file_nodes=[])
        result = gen.generate_dcf()
        assert result is False

    def test_release_path_contains_indexd_and_submission_id(self):
        gen = _make_generator(file_nodes=[_make_file_node()])
        gen.generate_dcf()
        s3_key = gen.s3_service.upload_file_to_s3.call_args[0][2]
        assert "indexd" in s3_key
        assert "sub-1" in s3_key
        assert "release" in s3_key

    def test_updates_release_manifest_data(self):
        manifest_data = {"metadata files": {"dcf manifest file path": ""}}
        gen = _make_generator(file_nodes=[_make_file_node()], release_manifest_data=manifest_data)
        gen.generate_dcf()
        assert manifest_data["metadata files"]["dcf manifest file path"] != ""
        assert "indexd" in manifest_data["metadata files"]["dcf manifest file path"]
