"""Unit tests for MetadataRemover: delete metadata SQS flow, deleteOrphanedDataFiles, and F008 orphan errors."""
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, os.path.join(_project_root, "src"))

from common import constants
from metadata_remover import MetadataRemover


# ---------------------------------------------------------------------------
# __init__ and remove_metadata return contract
# ---------------------------------------------------------------------------

def test_errors_initialized():
    """MetadataRemover initializes self.errors to empty list."""
    mock_dao = MagicMock()
    mock_store = MagicMock()
    remover = MetadataRemover(mock_dao, mock_store)
    assert remover.errors == []
    assert isinstance(remover.errors, list)


def test_remove_metadata_returns_tuple_on_invalid_submission():
    """When get_submission returns None, remove_metadata returns (False, [])."""
    mock_dao = MagicMock()
    mock_dao.get_submission.return_value = None
    mock_store = MagicMock()

    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, mock_store)
        result, orphan_errors = remover.remove_metadata("sub-1", "Subject", ["n1"])

    assert result is False
    assert orphan_errors == []
    mock_dao.get_submission.assert_called_once_with("sub-1")


def test_remove_metadata_logs_no_record_when_submission_missing(caplog):
    """Missing submission document logs no-record-found (not missing dataCommons)."""
    mock_dao = MagicMock()
    mock_dao.get_submission.return_value = None
    mock_store = MagicMock()
    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, mock_store)
        with caplog.at_level("ERROR", logger="Essential Validator"):
            remover.remove_metadata("sub-1", "Subject", ["n1"])
    assert "no record found" in caplog.text
    assert f"missing {constants.DATA_COMMON_NAME}" not in caplog.text


def test_remove_metadata_logs_missing_datacommons(caplog):
    """Submission without dataCommons field logs missing field (not no-record-found)."""
    mock_dao = MagicMock()
    mock_dao.get_submission.return_value = {"_id": "sub-1"}
    mock_store = MagicMock()
    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, mock_store)
        with caplog.at_level("ERROR", logger="Essential Validator"):
            remover.remove_metadata("sub-1", "Subject", ["n1"])
    assert f"missing {constants.DATA_COMMON_NAME}" in caplog.text
    assert "no record found" not in caplog.text


def test_remove_metadata_returns_tuple_on_no_datacommon():
    """When submission has no dataCommons, remove_metadata returns (False, [])."""
    mock_dao = MagicMock()
    mock_dao.get_submission.return_value = {"_id": "sub-1"}  # no dataCommons
    mock_store = MagicMock()

    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, mock_store)
        result, orphan_errors = remover.remove_metadata("sub-1", "Subject", ["n1"])

    assert result is False
    assert orphan_errors == []


def test_remove_metadata_returns_tuple_on_model_unavailable():
    """When model is not available, remove_metadata returns (False, [])."""
    mock_dao = MagicMock()
    mock_dao.get_submission.return_value = {
        "_id": "sub-1",
        constants.DATA_COMMON_NAME: "dc1",
        constants.ROOT_PATH: "r",
        constants.MODEL_VERSION: "v1",
        constants.BATCH_BUCKET: "b1",
    }
    mock_store = MagicMock()
    bad_model = MagicMock()
    bad_model.model = None
    bad_model.get_nodes.return_value = []
    mock_store.get_model_by_data_common_version.return_value = bad_model

    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, mock_store)
        result, orphan_errors = remover.remove_metadata("sub-1", "Subject", ["n1"])

    assert result is False
    assert orphan_errors == []


def test_remove_metadata_returns_tuple_on_no_existed_nodes():
    """When validate_data returns None/empty, remove_metadata returns (False, [])."""
    mock_dao = MagicMock()
    mock_dao.get_submission.return_value = {
        "_id": "sub-1",
        constants.DATA_COMMON_NAME: "dc1",
        constants.ROOT_PATH: "r",
        constants.MODEL_VERSION: "v1",
        constants.BATCH_BUCKET: "b1",
    }
    mock_store = MagicMock()
    mock_model = MagicMock()
    mock_model.model = {"nodes": []}
    mock_model.get_nodes.return_value = []
    mock_model.get_file_nodes.return_value = {}
    mock_store.get_model_by_data_common_version.return_value = mock_model
    mock_dao.check_metadata_ids.return_value = []  # no nodes to delete

    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, mock_store)
        result, orphan_errors = remover.remove_metadata("sub-1", "Subject", ["n1"])

    assert result is False
    assert orphan_errors == []


def test_remove_metadata_success_returns_true_and_orphan_errors():
    """On successful delete, remove_metadata returns (True, orphan_errors) from _find_orphaned_files_and_build_errors."""
    mock_dao = MagicMock()
    mock_dao.get_submission.return_value = {
        "_id": "sub-1",
        constants.DATA_COMMON_NAME: "dc1",
        constants.ROOT_PATH: "r",
        constants.MODEL_VERSION: "v1",
        constants.BATCH_BUCKET: "b1",
    }
    mock_store = MagicMock()
    mock_model = MagicMock()
    mock_model.model = {"nodes": [{}]}
    mock_model.get_nodes.return_value = [{}]  # truthy so "model available" check passes
    mock_model.get_file_nodes.return_value = {}
    mock_store.get_model_by_data_common_version.return_value = mock_model
    mock_dao.check_metadata_ids.return_value = [{constants.NODE_ID: "n1", constants.NODE_TYPE: "Subject"}]
    mock_dao.get_nodes_by_parents.return_value = (True, [])
    mock_dao.delete_data_records.return_value = True

    mock_bucket = MagicMock()
    with patch("metadata_remover.S3Bucket", return_value=mock_bucket):
        remover = MetadataRemover(mock_dao, mock_store)
        with patch.object(remover, "process_children", return_value=True):
            with patch.object(
                remover,
                "_find_orphaned_files_and_build_errors",
                return_value=[{"submittedID": "orphan.csv", "errors": [{"code": "F008"}]}],
            ):
                result, orphan_errors = remover.remove_metadata(
                    "sub-1", "Subject", ["n1"], delete_orphaned_data_files=False
                )

    assert result is True
    assert len(orphan_errors) == 1
    assert orphan_errors[0]["submittedID"] == "orphan.csv"
    assert orphan_errors[0]["errors"][0]["code"] == "F008"


def test_delete_nodes_skips_s3_when_delete_orphaned_false():
    """When delete_orphaned_data_files is False, delete_nodes does not call delete_files_in_s3."""
    mock_dao = MagicMock()
    mock_dao.delete_data_records.return_value = True
    s3_info = {constants.FILE_NAME: "data.tsv"}
    nodes = [
        {
            constants.NODE_ID: "n1",
            constants.NODE_TYPE: "File",
            constants.S3_FILE_INFO: s3_info,
        }
    ]
    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, MagicMock())
        remover.submission_id = "sub-1"
        remover.def_file_nodes = {}
        with patch.object(remover, "delete_files_in_s3") as del_s3:
            with patch.object(remover, "process_children", return_value=True):
                assert remover.delete_nodes(nodes, delete_orphaned_data_files=False) is True
        del_s3.assert_not_called()
        mock_dao.delete_data_records.assert_called_once_with(nodes)


def test_process_children_skips_s3_when_delete_orphaned_false():
    """Cascaded child file node: Mongo delete runs but S3 is skipped when flag is False."""
    mock_dao = MagicMock()
    deleted_parent = {constants.NODE_TYPE: "Study", constants.NODE_ID: "p1"}
    child = {
        constants.NODE_TYPE: "CDSFile",
        constants.NODE_ID: "f1",
        constants.PARENTS: [{constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "p1"}],
        constants.S3_FILE_INFO: {constants.FILE_NAME: "child.tsv"},
    }
    mock_dao.get_nodes_by_parents.side_effect = [(True, [child]), (True, [])]
    mock_dao.delete_data_records.return_value = True
    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, MagicMock())
        remover.submission_id = "sub-1"
        remover.def_file_nodes = {"CDSFile": {}}
        with patch.object(remover, "delete_files_in_s3") as del_s3:
            assert remover.process_children([deleted_parent], delete_orphaned_data_files=False) is True
        del_s3.assert_not_called()
    mock_dao.delete_data_records.assert_called_once_with([child])


def test_process_children_removes_only_matching_parent_when_same_parent_type_twice():
    """Child may have multiple parents of the same type; deleting one removes only that edge."""
    mock_dao = MagicMock()
    deleted_parent = {constants.NODE_TYPE: "Study", constants.NODE_ID: "study_a"}
    child = {
        constants.NODE_TYPE: "Sample",
        constants.NODE_ID: "s1",
        constants.PARENTS: [
            {constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "study_a"},
            {constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "study_b"},
        ],
    }
    mock_dao.get_nodes_by_parents.return_value = (True, [child])
    mock_dao.delete_data_records.return_value = True
    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, MagicMock())
        remover.submission_id = "sub-1"
        remover.def_file_nodes = {}
        assert remover.process_children([deleted_parent], delete_orphaned_data_files=False) is True

    mock_dao.update_data_records.assert_called_once()
    updated = mock_dao.update_data_records.call_args[0][0]
    assert len(updated) == 1
    assert updated[0][constants.PARENTS] == [
        {constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "study_b"},
    ]
    mock_dao.delete_data_records.assert_not_called()


def test_process_children_calls_s3_when_delete_orphaned_true():
    """Cascaded child file node: delete_files_in_s3 runs when flag is True."""
    mock_dao = MagicMock()
    deleted_parent = {constants.NODE_TYPE: "Study", constants.NODE_ID: "p1"}
    s3_info = {constants.FILE_NAME: "child.tsv"}
    child = {
        constants.NODE_TYPE: "CDSFile",
        constants.NODE_ID: "f1",
        constants.PARENTS: [{constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "p1"}],
        constants.S3_FILE_INFO: s3_info,
    }
    mock_dao.get_nodes_by_parents.side_effect = [(True, [child]), (True, [])]
    mock_dao.delete_data_records.return_value = True
    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, MagicMock())
        remover.submission_id = "sub-1"
        remover.def_file_nodes = {"CDSFile": {}}
        with patch.object(remover, "delete_files_in_s3", return_value=True) as del_s3:
            assert remover.process_children([deleted_parent], delete_orphaned_data_files=True) is True
        del_s3.assert_called_once_with([s3_info])


def test_delete_nodes_calls_s3_when_delete_orphaned_true():
    """When delete_orphaned_data_files is True, delete_nodes calls delete_files_in_s3 for file nodes."""
    mock_dao = MagicMock()
    mock_dao.delete_data_records.return_value = True
    s3_info = {constants.FILE_NAME: "data.tsv"}
    nodes = [
        {
            constants.NODE_ID: "n1",
            constants.NODE_TYPE: "File",
            constants.S3_FILE_INFO: s3_info,
        }
    ]
    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, MagicMock())
        remover.submission_id = "sub-1"
        remover.def_file_nodes = {}
        with patch.object(remover, "delete_files_in_s3", return_value=True) as del_s3:
            with patch.object(remover, "process_children", return_value=True):
                assert remover.delete_nodes(nodes, delete_orphaned_data_files=True) is True
        del_s3.assert_called_once_with([s3_info])


def test_remove_metadata_passes_delete_orphaned_data_files_to_find_orphans():
    """The orphan scan runs once, before metadata is deleted."""
    mock_dao = MagicMock()
    mock_dao.get_submission.return_value = {
        "_id": "sub-1",
        constants.DATA_COMMON_NAME: "dc1",
        constants.ROOT_PATH: "r",
        constants.MODEL_VERSION: "v1",
        constants.BATCH_BUCKET: "b1",
    }
    mock_store = MagicMock()
    mock_model = MagicMock()
    mock_model.model = {"nodes": [{}]}
    mock_model.get_nodes.return_value = [{}]
    mock_model.get_file_nodes.return_value = {}
    mock_store.get_model_by_data_common_version.return_value = mock_model
    mock_dao.check_metadata_ids.return_value = [{constants.NODE_ID: "n1", constants.NODE_TYPE: "Subject"}]
    mock_dao.get_nodes_by_parents.return_value = (True, [])
    call_order = []
    mock_dao.delete_data_records.side_effect = lambda records: call_order.append("delete") or True

    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, mock_store)
        with patch.object(remover, "process_children", return_value=True):
            def find_orphans(*args):
                call_order.append("scan")
                return []
            with patch.object(remover, "_find_orphaned_files_and_build_errors", side_effect=find_orphans) as find_mock:
                remover.remove_metadata("sub-1", "Subject", ["n1"], delete_orphaned_data_files=True)

        assert find_mock.call_count == 1
        assert find_mock.call_args[0][0] == "sub-1"
        assert find_mock.call_args[0][1] is True
        assert call_order == ["scan", "delete"]


# ---------------------------------------------------------------------------
# _find_orphaned_files_and_build_errors
# ---------------------------------------------------------------------------

def test_find_orphaned_files_returns_empty_when_bucket_or_root_path_missing():
    """_find_orphaned_files_and_build_errors returns [] when bucket or root_path is not set."""
    mock_dao = MagicMock()
    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, MagicMock())
        remover.bucket = None
        remover.root_path = "root"
        assert remover._find_orphaned_files_and_build_errors("sub-1", False) == []
        remover.bucket = MagicMock()
        remover.root_path = None
        assert remover._find_orphaned_files_and_build_errors("sub-1", False) == []


def test_find_orphaned_files_builds_f008_shape():
    """_find_orphaned_files_and_build_errors returns error dicts with F008 and file_validator shape."""
    mock_dao = MagicMock()
    mock_dao.get_files_by_submission.return_value = []  # no manifest files
    mock_dao.find_batch_by_file_name.return_value = None

    mock_bucket = MagicMock()
    mock_bucket.bucket_name = "test-bucket"
    mock_bucket.client.list_objects_v2.return_value = {
        "Contents": [{"Key": "root/file/orphan.csv", "LastModified": "2024-01-01T00:00:00Z"}],
        "NextContinuationToken": None,
    }

    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, MagicMock())
        remover.bucket = mock_bucket
        remover.root_path = "root"

        errors = remover._find_orphaned_files_and_build_errors("sub-1", delete_orphaned_data_files=False)

    assert len(errors) == 1
    err = errors[0]
    assert err[constants.TYPE] == constants.DATA_FILE_TYPE
    assert err[constants.QC_VALIDATION_TYPE] == constants.DATA_FILE_TYPE
    assert err[constants.SUBMITTED_ID] == "orphan.csv"
    assert err[constants.BATCH_ID] == "-"
    assert err[constants.QC_SEVERITY] == constants.STATUS_ERROR
    assert err[constants.ERRORS][0]["code"] == "F008"


def test_find_orphaned_files_skips_log_keys():
    """S3 keys containing /log are not considered orphaned files."""
    mock_dao = MagicMock()
    mock_dao.get_files_by_submission.return_value = []
    mock_dao.find_batch_by_file_name.return_value = None

    mock_bucket = MagicMock()
    mock_bucket.bucket_name = "test-bucket"
    mock_bucket.client.list_objects_v2.return_value = {
        "Contents": [{"Key": "root/file/log/foo.txt", "LastModified": None}],
        "NextContinuationToken": None,
    }

    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, MagicMock())
        remover.bucket = mock_bucket
        remover.root_path = "root"

        errors = remover._find_orphaned_files_and_build_errors("sub-1", delete_orphaned_data_files=False)

    assert len(errors) == 0


def test_find_orphaned_files_excludes_manifest_files():
    """Files still in get_files_by_submission are not reported as orphaned."""
    mock_dao = MagicMock()
    mock_dao.get_files_by_submission.return_value = [
        {constants.S3_FILE_INFO: {constants.FILE_NAME: "in_manifest.csv"}}
    ]
    mock_dao.find_batch_by_file_name.return_value = None

    mock_bucket = MagicMock()
    mock_bucket.bucket_name = "test-bucket"
    mock_bucket.client.list_objects_v2.return_value = {
        "Contents": [
            {"Key": "root/file/in_manifest.csv", "LastModified": None},
            {"Key": "root/file/orphan.csv", "LastModified": None},
        ],
        "NextContinuationToken": None,
    }

    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, MagicMock())
        remover.bucket = mock_bucket
        remover.root_path = "root"

        errors = remover._find_orphaned_files_and_build_errors("sub-1", delete_orphaned_data_files=False)

    assert len(errors) == 1
    assert errors[0][constants.SUBMITTED_ID] == "orphan.csv"


def test_find_orphaned_files_does_not_delete_unrelated_s3_when_flag_true():
    """Unrelated orphans stay in S3 and are still reported as F008 when the checkbox is on."""
    mock_dao = MagicMock()
    mock_dao.get_files_by_submission.return_value = []
    mock_dao.find_batch_by_file_name.return_value = None

    mock_bucket = MagicMock()
    mock_bucket.bucket_name = "test-bucket"
    mock_bucket.client.list_objects_v2.return_value = {
        "Contents": [{"Key": "root/file/orphan.csv", "LastModified": None}],
        "NextContinuationToken": None,
    }

    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, MagicMock())
        remover.bucket = mock_bucket
        remover.root_path = "root"
        delete_files = MagicMock()
        remover.delete_files_in_s3 = delete_files

        errors = remover._find_orphaned_files_and_build_errors("sub-1", delete_orphaned_data_files=True)

    delete_files.assert_not_called()
    assert len(errors) == 1
    assert errors[0][constants.SUBMITTED_ID] == "orphan.csv"
    assert errors[0][constants.ERRORS][0]["code"] == "F008"


def test_process_children_deletes_grandchild_file_not_file_with_other_parent():
    """Checkbox on deletes a grandchild file and leaves a file that still has another parent."""
    mock_dao = MagicMock()
    deleted_parent = {constants.NODE_TYPE: "Study", constants.NODE_ID: "study_a"}
    intermediate = {
        constants.NODE_TYPE: "Sample",
        constants.NODE_ID: "sample_1",
        constants.PARENTS: [{constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "study_a"}],
    }
    grandchild_s3 = {constants.FILE_NAME: "grandchild.tsv"}
    grandchild = {
        constants.NODE_TYPE: "CDSFile",
        constants.NODE_ID: "file_gc",
        constants.PARENTS: [{constants.PARENT_TYPE: "Sample", constants.PARENT_ID_VAL: "sample_1"}],
        constants.S3_FILE_INFO: grandchild_s3,
    }
    shared = {
        constants.NODE_TYPE: "CDSFile",
        constants.NODE_ID: "file_shared",
        constants.PARENTS: [
            {constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "study_a"},
            {constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "study_b"},
        ],
        constants.S3_FILE_INFO: {constants.FILE_NAME: "shared.tsv"},
    }
    mock_dao.get_nodes_by_parents.side_effect = [
        (True, [intermediate, shared]),
        (True, [grandchild]),
        (True, []),
    ]
    mock_dao.delete_data_records.return_value = True
    mock_dao.update_data_records.return_value = True
    with patch("metadata_remover.S3Bucket"):
        remover = MetadataRemover(mock_dao, MagicMock())
        remover.submission_id = "sub-1"
        remover.def_file_nodes = {"CDSFile": {}}
        with patch.object(remover, "delete_files_in_s3", return_value=True) as del_s3:
            assert remover.process_children([deleted_parent], delete_orphaned_data_files=True) is True
        deleted_names = [
            info[constants.FILE_NAME]
            for call in del_s3.call_args_list
            for info in call[0][0]
        ]
    assert deleted_names == ["grandchild.tsv"]
    mock_dao.delete_data_records.assert_any_call([grandchild])
    updated = mock_dao.update_data_records.call_args[0][0]
    assert updated[0][constants.NODE_ID] == "file_shared"


def _associated_delete_remover(delete_orphaned_data_files):
    """Build a remover whose S3 listing drops names passed to delete_files_in_s3."""
    file_direct = {
        constants.NODE_TYPE: "CDSFile",
        constants.NODE_ID: "file_direct",
        constants.S3_FILE_INFO: {constants.FILE_NAME: "associated.tsv"},
    }
    study = {constants.NODE_TYPE: "Study", constants.NODE_ID: "study_a"}
    sample = {
        constants.NODE_TYPE: "Sample",
        constants.NODE_ID: "sample_1",
        constants.PARENTS: [{constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "study_a"}],
    }
    child_file = {
        constants.NODE_TYPE: "CDSFile",
        constants.NODE_ID: "child_file",
        constants.PARENTS: [{constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "study_a"}],
        constants.S3_FILE_INFO: {constants.FILE_NAME: "child.tsv"},
    }
    grandchild = {
        constants.NODE_TYPE: "CDSFile",
        constants.NODE_ID: "file_gc",
        constants.PARENTS: [{constants.PARENT_TYPE: "Sample", constants.PARENT_ID_VAL: "sample_1"}],
        constants.S3_FILE_INFO: {constants.FILE_NAME: "grandchild.tsv"},
    }
    shared = {
        constants.NODE_TYPE: "CDSFile",
        constants.NODE_ID: "file_shared",
        constants.PARENTS: [
            {constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "study_a"},
            {constants.PARENT_TYPE: "Study", constants.PARENT_ID_VAL: "study_b"},
        ],
        constants.S3_FILE_INFO: {constants.FILE_NAME: "shared.tsv"},
    }
    children_by_parent = {
        ("CDSFile", "file_direct"): [],
        ("Study", "study_a"): [sample, child_file, shared],
        ("Sample", "sample_1"): [grandchild],
        ("CDSFile", "child_file"): [],
        ("CDSFile", "file_gc"): [],
    }

    mock_dao = MagicMock()
    mock_dao.get_submission.return_value = {
        "_id": "sub-1",
        constants.DATA_COMMON_NAME: "dc1",
        constants.ROOT_PATH: "root",
        constants.MODEL_VERSION: "v1",
        constants.BATCH_BUCKET: "b1",
    }
    mock_dao.check_metadata_ids.return_value = [file_direct, study]
    mock_dao.delete_data_records.return_value = True
    mock_dao.update_data_records.return_value = True
    mock_dao.get_files_by_submission.return_value = [
        {constants.S3_FILE_INFO: {constants.FILE_NAME: "shared.tsv"}}
    ]
    mock_dao.find_batch_by_file_name.return_value = None

    def get_nodes_by_parents(parents, submission_id):
        found = []
        seen = set()
        for parent in parents:
            for child in children_by_parent.get((parent[constants.NODE_TYPE], parent[constants.NODE_ID]), []):
                if child[constants.NODE_ID] not in seen:
                    seen.add(child[constants.NODE_ID])
                    found.append(child)
        return True, found

    mock_dao.get_nodes_by_parents.side_effect = get_nodes_by_parents

    mock_store = MagicMock()
    mock_model = MagicMock()
    mock_model.model = {"nodes": [{}]}
    mock_model.get_nodes.return_value = [{}]
    mock_model.get_file_nodes.return_value = {"CDSFile": {}}
    mock_store.get_model_by_data_common_version.return_value = mock_model

    remaining = {"associated.tsv", "child.tsv", "grandchild.tsv", "shared.tsv", "unrelated.csv"}
    deleted_names = []

    mock_bucket = MagicMock()
    mock_bucket.bucket_name = "test-bucket"

    def list_objects_v2(**kwargs):
        return {
            "Contents": [
                {"Key": f"root/file/{name}", "LastModified": None}
                for name in sorted(remaining)
            ],
            "NextContinuationToken": None,
        }

    mock_bucket.client.list_objects_v2.side_effect = list_objects_v2

    def delete_files(infos):
        for info in infos or []:
            name = info.get(constants.FILE_NAME) if info else None
            if name:
                deleted_names.append(name)
                remaining.discard(name)
        return True

    with patch("metadata_remover.S3Bucket", return_value=mock_bucket):
        remover = MetadataRemover(mock_dao, mock_store)
        remover.delete_files_in_s3 = delete_files
        result, orphan_errors = remover.remove_metadata(
            "sub-1", "CDSFile", ["file_direct", "study_a"], delete_orphaned_data_files
        )
    return result, orphan_errors, deleted_names


def test_remove_metadata_checkbox_on_deletes_only_associated_files():
    """Checkbox on deletes the node, child, and grandchild files, and reports only the unrelated orphan."""
    result, orphan_errors, deleted_names = _associated_delete_remover(True)

    assert result is True
    assert set(deleted_names) == {"associated.tsv", "child.tsv", "grandchild.tsv"}
    assert "unrelated.csv" not in deleted_names
    assert "shared.tsv" not in deleted_names
    assert {err[constants.SUBMITTED_ID] for err in orphan_errors} == {"unrelated.csv"}
    assert orphan_errors[0][constants.ERRORS][0]["code"] == "F008"


def test_remove_metadata_checkbox_off_reports_new_and_existing_orphans_without_s3_delete():
    """Checkbox off leaves S3 in place and returns F008 for newly unreferenced files and the pre-existing orphan."""
    result, orphan_errors, deleted_names = _associated_delete_remover(False)

    assert result is True
    assert deleted_names == []
    assert {err[constants.SUBMITTED_ID] for err in orphan_errors} == {
        "associated.tsv",
        "child.tsv",
        "grandchild.tsv",
        "unrelated.csv",
    }
    assert all(err[constants.ERRORS][0]["code"] == "F008" for err in orphan_errors)


_USE_MOCK_BUCKET = object()


def _delete_study_then_scan(list_page=None, find_batch=None, root_path="root", bucket=_USE_MOCK_BUCKET, delete_records=True):
    """Scan once, then delete one Study node.

    @param list_page list_objects_v2 return value, callable, or exception
    @param find_batch find_batch_by_file_name return value, callable, or exception
    @param root_path submission root path; None omits the field
    @param bucket S3Bucket instance; None installs no bucket
    @param delete_records delete_data_records return value
    @returns result, orphan errors, dao mock, bucket mock, and remover
    """
    mock_dao = MagicMock()
    submission = {
        "_id": "sub-1",
        constants.DATA_COMMON_NAME: "dc1",
        constants.MODEL_VERSION: "v1",
        constants.BATCH_BUCKET: "b1",
    }
    if root_path is not None:
        submission[constants.ROOT_PATH] = root_path
    mock_dao.get_submission.return_value = submission
    mock_dao.check_metadata_ids.return_value = [
        {constants.NODE_TYPE: "Study", constants.NODE_ID: "study_a"}
    ]
    mock_dao.delete_data_records.return_value = delete_records
    mock_dao.get_nodes_by_parents.return_value = (True, [])
    mock_dao.get_files_by_submission.return_value = []
    if callable(find_batch) or isinstance(find_batch, BaseException):
        mock_dao.find_batch_by_file_name.side_effect = find_batch
    else:
        mock_dao.find_batch_by_file_name.return_value = find_batch

    mock_store = MagicMock()
    mock_model = MagicMock()
    mock_model.model = {"nodes": [{}]}
    mock_model.get_nodes.return_value = [{}]
    mock_model.get_file_nodes.return_value = {}
    mock_store.get_model_by_data_common_version.return_value = mock_model

    mock_bucket = MagicMock()
    mock_bucket.bucket_name = "test-bucket"
    if callable(list_page) or isinstance(list_page, BaseException):
        mock_bucket.client.list_objects_v2.side_effect = list_page
    else:
        mock_bucket.client.list_objects_v2.return_value = list_page or {
            "Contents": [],
            "NextContinuationToken": None,
        }
    installed_bucket = mock_bucket if bucket is _USE_MOCK_BUCKET else bucket

    with patch("metadata_remover.S3Bucket", return_value=installed_bucket):
        remover = MetadataRemover(mock_dao, mock_store)
        result, orphan_errors = remover.remove_metadata("sub-1", "Study", ["study_a"], True)
    return result, orphan_errors, mock_dao, mock_bucket, remover


def _assert_study_delete_finished(mock_dao):
    """The Study delete finished after a completed scan."""
    mock_dao.delete_data_records.assert_called_once_with([
        {constants.NODE_TYPE: "Study", constants.NODE_ID: "study_a"}
    ])
    mock_dao.get_nodes_by_parents.assert_called()


def _assert_study_not_deleted(mock_dao):
    """A scan that cannot finish does not delete metadata."""
    mock_dao.delete_data_records.assert_not_called()


def test_remove_metadata_listing_exception_is_not_a_successful_empty_scan():
    """A failed S3 listing does not delete metadata and is not an empty scan."""
    result, orphan_errors, mock_dao, mock_bucket, _remover = _delete_study_then_scan(
        list_page=RuntimeError("list failed")
    )

    _assert_study_not_deleted(mock_dao)
    mock_bucket.client.list_objects_v2.assert_called()
    assert result is False
    assert orphan_errors == []


def test_remove_metadata_partial_scan_exception_is_not_success():
    """An exception while building F008 rows does not delete metadata."""
    def list_two(**kwargs):
        return {
            "Contents": [
                {"Key": "root/file/a.csv", "LastModified": None},
                {"Key": "root/file/b.csv", "LastModified": None},
            ],
            "NextContinuationToken": None,
        }

    def find_batch(submission_id, file_type, file_name):
        if file_name == "b.csv":
            raise RuntimeError("batch lookup failed")
        return None

    result, orphan_errors, mock_dao, mock_bucket, _remover = _delete_study_then_scan(
        list_page=list_two, find_batch=find_batch
    )

    _assert_study_not_deleted(mock_dao)
    mock_bucket.client.list_objects_v2.assert_called()
    assert result is False
    assert orphan_errors == []


def test_remove_metadata_missing_root_path_is_not_a_successful_empty_scan():
    """A scan that cannot list does not delete metadata."""
    result, orphan_errors, mock_dao, mock_bucket, _remover = _delete_study_then_scan(root_path=None)

    _assert_study_not_deleted(mock_dao)
    mock_bucket.client.list_objects_v2.assert_not_called()
    assert result is False
    assert orphan_errors == []


def test_remove_metadata_missing_bucket_is_not_a_successful_empty_scan():
    """A scan with no bucket does not delete metadata."""
    result, orphan_errors, mock_dao, mock_bucket, _remover = _delete_study_then_scan(bucket=None)

    _assert_study_not_deleted(mock_dao)
    mock_bucket.client.list_objects_v2.assert_not_called()
    assert result is False
    assert orphan_errors == []


def test_remove_metadata_failed_delete_sets_incomplete_after_one_scan():
    """A failed metadata delete does not repeat the scan and is incomplete."""
    result, orphan_errors, mock_dao, mock_bucket, remover = _delete_study_then_scan(delete_records=False)

    mock_dao.delete_data_records.assert_called_once()
    assert mock_bucket.client.list_objects_v2.call_count == 1
    assert remover.delete_incomplete is True
    assert result is False
    assert orphan_errors == []


def test_remove_metadata_completed_empty_listing_is_success():
    """A finished listing with no unreferenced keys is a successful empty scan."""
    result, orphan_errors, mock_dao, mock_bucket, _remover = _delete_study_then_scan()

    _assert_study_delete_finished(mock_dao)
    mock_bucket.client.list_objects_v2.assert_called()
    assert result is True
    assert orphan_errors == []
