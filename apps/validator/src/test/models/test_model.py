from test.utils.mock_metadata_validator import create_mock_data_model

data_model = create_mock_data_model()

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
    edges = data_model.get_edges()
    rel = None
    for edge in edges:
        if edge.handle == 'of_diagnosis':
            rel = edge
            break
    assert data_model.edge_to_column_name(rel) == 'diagnosis.diagnosis_id'

def test_get_entity_type():
    assert data_model.get_entity_type('study') == 'Study'
    assert data_model.get_entity_type('file') == 'File'
    assert data_model.get_entity_type('diagnosis') is None

def test_get_main_nodes():
    main_nodes = data_model.get_main_nodes()
    assert isinstance(main_nodes, dict)
    assert 'study' in main_nodes
    assert 'diagnosis' not in main_nodes

def test_configured_prop_name():
    assert data_model.get_configured_prop_name('studyName') == 'study_name'
    assert data_model.get_configured_prop_name('dbGaPID') == 'phs_accession'
    assert data_model.get_configured_prop_name('file_id') is None

def test_get_file_nodes():
    file_nodes = data_model.get_file_nodes()
    assert isinstance(file_nodes, dict)
    assert 'file' in file_nodes
    assert 'data_file' not in file_nodes

def test_get_file_name():
    assert data_model.get_file_name() == 'file_name'

def test_get_list_delimiter():
    assert data_model.get_list_delimiter() == '*'

def test_get_omit_dcf_prefix():
    assert data_model.get_omit_dcf_prefix() == True