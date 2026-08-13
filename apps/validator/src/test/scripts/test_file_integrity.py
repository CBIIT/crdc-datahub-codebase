"""Unit tests for scripts/file_integrity.py."""
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(_this_dir)))
sys.path.insert(0, _project_root)

from src.scripts import file_integrity


def test_extrac_bucket_key_from_s3_url():
    bucket, key = file_integrity.extrac_bucket_key_from_s3_url(
        "s3://my-bucket/f2fe-4171-ace0-a178c46885d7/011223 Batch 12 #03 RABGMR-008B.zip"
    )
    assert bucket == "my-bucket"
    assert key == "f2fe-4171-ace0-a178c46885d7/011223 Batch 12 #03 RABGMR-008B.zip"

def test_get_old_data_file_location():
    bucket_name = "my-bucket"
    study_id = "study123"
    file_name = "file.txt"
    expected_location = f"s3://{bucket_name}/{study_id}/{file_name}"
    location = file_integrity.get_old_data_file_location(bucket_name, study_id, file_name)
    assert location == expected_location