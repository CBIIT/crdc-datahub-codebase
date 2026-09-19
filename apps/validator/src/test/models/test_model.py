from unittest import TestCase

from test.utils.metadata_validator import create_test_data_model
from common.constants import STUDY_NAME, STUDY_ACRONYM, STUDY_DESCRIPTION, PROGRAM_ACRONYM

data_model = create_test_data_model()

def test_node_with_required_relationships():
    rels = data_model.get_node_req_rel_columns('file')
    assert isinstance(rels, list)
    assert len(rels) == 2
    assert 'diagnosis.diagnosis_id' in rels
    assert 'participant.participant_id' in rels

def test_node_without_required_relationships():
    rels = data_model.get_node_req_rel_columns('diagnosis')
    assert isinstance(rels, list)
    assert len(rels) == 0

def test_node_with_required_but_auto_populated_relationships():
    rels = data_model.get_node_req_rel_columns('participant')
    assert rels == ['study.study_id']

def test_node_with_only_required_but_auto_populated_relationships():
    rels = data_model.get_node_req_rel_columns('study')
    assert rels == []

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

def test_get_system_populated_props():
    system_populated_props = data_model.get_system_populated_props()
    assert isinstance(system_populated_props, dict)
    assert 'study_name' in system_populated_props
    assert system_populated_props['study_name'] == STUDY_NAME
    assert 'study_acronym' in system_populated_props
    assert system_populated_props['study_acronym'] == STUDY_ACRONYM
    assert 'study_description' in system_populated_props
    assert system_populated_props['study_description'] == STUDY_DESCRIPTION
    assert 'study_description' in system_populated_props

def test_get_system_populated_prop_list():
    system_populated_prop_list = data_model.get_system_populated_prop_list()
    TestCase().assertCountEqual(system_populated_prop_list, ['study_name', 'study_description', 'study_acronym', 'program_name', 'program_acronym', 'program_description'])

def test_get_system_populated_props_for_node_without_system_populated_props():
    assert data_model.get_system_populated_props_for_node('file') == ({}, {})

def test_get_system_populated_props_for_node_with_system_populated_props():
    props, relationships = data_model.get_system_populated_props_for_node('study')
    assert isinstance(props, dict)
    assert 'study_name' in props
    assert props['study_name'] == STUDY_NAME
    assert 'study_description' in props
    assert props['study_description'] == STUDY_DESCRIPTION
    assert 'study_acronym' in props
    assert props['study_acronym'] == STUDY_ACRONYM

    assert "program.program_acronym" in relationships
    assert relationships["program.program_acronym"] == PROGRAM_ACRONYM

def test_get_system_populated_relationships_for_node():
    relationships = data_model.get_system_populated_relationships_for_node('study')
    assert isinstance(relationships, dict)
    assert 'program.program_acronym' in relationships
    assert relationships['program.program_acronym'] == PROGRAM_ACRONYM

def test_get_system_populated_relationships_for_node_2():
    relationships = data_model.get_system_populated_relationships_for_node('participant')
    assert isinstance(relationships, dict)
    assert 'program.program_acronym' in relationships
    assert relationships['program.program_acronym'] == PROGRAM_ACRONYM

def test_get_system_populated_relationships_for_node_with_no_system_populated_relationships():
    relationships = data_model.get_system_populated_relationships_for_node('file')
    assert relationships == {}

def test_get_final_required_props():
    props = data_model.get_final_required_props_for_node('file')
    assert props == []

def test_get_final_required_props_for_node_with_system_populated_props():
    props = data_model.get_final_required_props_for_node('study')
    TestCase().assertCountEqual(props, ['phs_accession', 'study_data_types'])