"""Shared MongoDao mock wiring for validator tests."""

from common.mongo_dao import MongoDao


def wire_mock_dao_replace_f008_qc_results(mock_dao):
    """Route replace_f008_qc_results through MongoDao using mock delete/save."""
    mock_dao.delete_f008_qc_results.return_value = True
    mock_dao.save_qc_results.return_value = (True, None)
    mock_dao.replace_f008_qc_results.side_effect = (
        lambda submission_id, orphan_rows: MongoDao.replace_f008_qc_results(
            mock_dao, submission_id, orphan_rows
        )
    )
