from common.model import DataModel
from common.mdf_reader import get_model_from_mdf_files

model_file = 'src/test/test_data/test_mdf.yml'
model = get_model_from_mdf_files([model_file], handle="CRDC")

data_model = DataModel({}, model)

def test_node_with_required_relationships():
    rels = data_model.get_node_req_rel_columns('file')
    assert rels is not None
    assert isinstance(rels, list)
    assert len(rels) == 2
    assert 'diagnosis.diagnosis_id' in rels
    assert 'participant.participant_id' in rels

def test_node_without_required_relationships():
    rels = data_model.get_node_req_rel_columns('diagnosis')
    assert rels is not None
    assert isinstance(rels, list)
    assert len(rels) == 0

def test_edge_to_column_name_None():
    assert data_model.edge_to_column_name(None) == ''

def test_get_file_key_prop():
    key = data_model.get_node_key_prop('file')
    assert key is not None
    assert isinstance(key, str)
    assert key == 'file_id'

def test_get_participant_key_prop():
    key = data_model.get_node_key_prop('participant')
    assert key is not None
    assert isinstance(key, str)
    assert key == 'participant_id'

def test_edge_to_column_name():
    edges = model.edges.values()
    rel = None
    for edge in edges:
        if edge.handle == 'of_diagnosis':
            rel = edge
            break
    assert data_model.edge_to_column_name(rel) == 'diagnosis.diagnosis_id'