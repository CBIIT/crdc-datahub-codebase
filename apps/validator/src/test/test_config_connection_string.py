import os
import sys
from urllib.parse import quote, unquote
from unittest.mock import patch

import pytest

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from config import (
    build_connection_string,
    build_document_db_connection_string,
    get_document_db_ca_file,
    is_document_db_tls_enabled,
)


def test_tls_off_includes_auth_source_retry_writes_and_encoded_credentials():
    uri = build_connection_string("user@name", "p@ss:word", "example.host", "27017", "my-db")

    assert "authSource=admin" in uri
    assert "retryWrites=false" in uri
    assert "tls=true" not in uri
    assert "tlsCAFile" not in uri
    assert "authMechanism=SCRAM-SHA-1" not in uri
    assert "example.host:27017/" in uri
    assert quote("user@name", safe="") in uri
    assert quote("p@ss:word", safe="") in uri
    assert quote("my-db", safe="") in uri


def test_tls_on_includes_tls_ca_file_and_scram():
    ca_file = "/tmp/docdb-ca.pem"
    uri = build_connection_string("user", "secret", "docdb.example", "27017", "crdc-datahub", ca_file)

    assert "tls=true" in uri
    assert "authMechanism=SCRAM-SHA-1" in uri
    assert "tlsCAFile=" in uri
    assert unquote(uri.split("tlsCAFile=")[1].split("&")[0]) == ca_file
    assert "authSource=admin" in uri
    assert "retryWrites=false" in uri


def test_tls_enabled_when_docdb_tls_unset():
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("DOCDB_TLS", None)
        assert is_document_db_tls_enabled() is True


def test_tls_disabled_when_docdb_tls_false():
    with patch.dict(os.environ, {"DOCDB_TLS": "false"}):
        assert is_document_db_tls_enabled() is False


def test_tls_enabled_when_docdb_tls_true():
    with patch.dict(os.environ, {"DOCDB_TLS": "TRUE"}):
        assert is_document_db_tls_enabled() is True


def test_invalid_docdb_tls_raises():
    with patch.dict(os.environ, {"DOCDB_TLS": "treu"}):
        with pytest.raises(ValueError, match="DOCDB_TLS must be true or false"):
            is_document_db_tls_enabled()


def test_ca_file_none_when_tls_disabled():
    with patch.dict(os.environ, {"DOCDB_CA_FILE": "/custom/ca.pem"}):
        assert get_document_db_ca_file(False) is None


def test_ca_file_uses_env_override_when_tls_enabled():
    with patch.dict(os.environ, {"DOCDB_CA_FILE": "/custom/ca.pem"}):
        assert get_document_db_ca_file(True) == "/custom/ca.pem"


def test_build_document_db_connection_string_tls_off_omits_tls():
    uri = build_document_db_connection_string(
        "user", "secret", "localhost", "27017", "crdc-datahub", False
    )
    assert "tls=true" not in uri
    assert "tlsCAFile" not in uri
    assert "retryWrites=false" in uri


def test_build_document_db_connection_string_tls_on_with_ca_file(tmp_path):
    ca_file = tmp_path / "global-bundle.pem"
    ca_file.write_text("test-ca")
    uri = build_document_db_connection_string(
        "user", "secret", "docdb.example", "27017", "crdc-datahub", True, str(ca_file)
    )
    assert "tls=true" in uri
    assert "authMechanism=SCRAM-SHA-1" in uri
    assert unquote(uri.split("tlsCAFile=")[1].split("&")[0]) == str(ca_file)


def test_build_document_db_connection_string_tls_on_missing_ca_raises():
    missing = "/path/does/not/exist/global-bundle.pem"
    with pytest.raises(FileNotFoundError, match="CA file was not found"):
        build_document_db_connection_string(
            "user", "secret", "docdb.example", "27017", "crdc-datahub", True, missing
        )
