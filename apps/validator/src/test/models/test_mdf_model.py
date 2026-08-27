from common.model import DataModel
from unittest.mock import MagicMock

from common.mdf_reader import get_model_from_mdf_files

model_file = 'src/test/test_data/test_mdf.yml'
model = get_model_from_mdf_files([model_file], handle="CRDC")

def test_mdf_model_is_not_none():
    builtin_model = {}
    assert model is not None
    data_model = DataModel(builtin_model, model)
    assert data_model is not None

def test_mdf_model_nodes_props():
    file_node = model.nodes['file']
    assert isinstance(file_node, object)
    props = file_node.props
    assert isinstance(props, object)
    file_size = props['file_size']
    assert isinstance(file_size, object)
    assert file_size.handle == 'file_size'

def test_mdf_model_req_rels_1():
    rels = model.edges.values()
    assert rels is not None
    assert isinstance(rels, object)

    file_diagnosis = None
    for rel in rels:
        if rel.src.handle == 'file' and rel.dst.handle == 'diagnosis':
            file_diagnosis = rel
            break
    assert file_diagnosis is not None
    assert isinstance(file_diagnosis, object)
    assert file_diagnosis.is_required == True
    assert file_diagnosis.handle == 'of_diagnosis'

def test_mdf_model_req_rels_2():
    rels = model.edges.values()
    assert rels is not None
    assert isinstance(rels, object)

    file_participant_rel = None
    for rel in rels:
        if rel.src.handle == 'file' and rel.dst.handle == 'participant':
            file_participant_rel = rel
            break
    assert file_participant_rel is not None
    assert isinstance(file_participant_rel, object)
    assert file_participant_rel.is_required == True
    assert file_participant_rel.handle == 'of_participant'

def test_mdf_model_none_req_rels():
    rels = model.edges.values()
    assert rels is not None
    assert isinstance(rels, object)

    diagnosis_participant = None
    for rel in rels:
        if rel.src.handle == 'diagnosis' and rel.dst.handle == 'participant':
            diagnosis_participant = rel
            break
    assert diagnosis_participant != True
    assert isinstance(diagnosis_participant, object)
    assert not diagnosis_participant.is_required
    assert diagnosis_participant.handle == 'of_participant'