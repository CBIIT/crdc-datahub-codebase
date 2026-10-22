from common.constants import NODES_LABEL, RELATIONSHIPS, LIST_DELIMITER_PROP, PROPERTY_NAMES, OMIT_DCF_PREFIX, \
    COMPOSITION_KEY, DEF_SEMANTICS, DEF_MAIN_NODES, DEF_FILE_NODES, DEF_FILE_NAME_FIELD, SYSTEM_POPULATED_PROPS


class DataModel:
    def __init__(self, model, mdf_model=None, model_config={}):
        self.model = model
        self.mdf_model = mdf_model
        self.model_config = model_config

    # model connivent functions
    # """
    # get model id fields in the given model
    # """
    # def get_model_ids(self):       
    #         return self.model.get(IDS, None)
    """
    get nodes value
    """   
    def get_nodes(self): 
        return self.model.get(NODES_LABEL, {})
    """
    get id field of a given node in the model
    """   
    def get_node_id(self, node): 
        if self.model[NODES_LABEL].get(node):
            return self.model[NODES_LABEL][node].get("id_property", None)
        return None

    """
    get all node keys in the model
    """
    def get_node_keys(self):
        return self.model[NODES_LABEL].keys()

    """
    get properties of a node in the model
    """
    def get_node_props(self, node):
        if self.model[NODES_LABEL].get(node):
            return self.model[NODES_LABEL][node].get("properties", None)

    """
    get relationships of a node in the model
    """
    def get_node_relationships(self, node):
        if self.model[NODES_LABEL].get(node):
            return self.model[NODES_LABEL][node].get(RELATIONSHIPS, None)
        
    """
    get required properties of a node in the model
    """
    def get_node_req_props(self, node):
        props = self.get_node_props(node)
        if not props:
            return None
        return {k: v for (k, v) in props.items() if v.get("required") == True}

    """
    Return relationship columns user must provide
    """
    def get_final_req_rel_columns_for_node(self, node):
        required_columns = self.get_req_rel_columns_for_node(node)
        system_populated_relationships = self.get_system_populated_relationships_for_node(node)
        result = []
        for column in required_columns:
            if column not in system_populated_relationships:
                result.append(column)
        return result

    """
    Return required relationship columns defined in the model
    """
    def get_req_rel_columns_for_node(self, node):
        edges = self.mdf_model.edges.values() if self.mdf_model else []
        req_rel_columns = []
        for edge in edges:
            column_name = self.edge_to_column_name(edge)
            if edge.src.handle == node and edge.is_required:
                req_rel_columns.append(column_name)
        return req_rel_columns


    """
    Return all relationship columns defined in the model
    """
    def get_node_rel_columns(self, node):
        edges = self.mdf_model.edges.values() if self.mdf_model else []
        req_rel_columns = []
        for edge in edges:
            if edge.src.handle == node:
                req_rel_columns.append(self.edge_to_column_name(edge))
        return req_rel_columns

    """
    get file nodes in the model
    """
    def get_file_nodes(self):
        return self._get_semantics().get(DEF_FILE_NODES, {})
    
    """
    get main nodes in the model
    """
    def get_main_nodes(self):
        return self._get_semantics().get(DEF_MAIN_NODES, {})

    """
    get entity type of a given node in the model
    """
    def get_entity_type(self, node_type):
        return self.get_main_nodes().get(node_type)

        # return self.model.get(DEF_MAIN_NODES, {}).get(node_type, None)

    def _get_semantics(self):
        return self.model_config.get(DEF_SEMANTICS, {})
    
    """
    get configured property names of a given node's property name in the model
    """
    def get_configured_prop_name(self, prop_name):
        return self._get_semantics().get(PROPERTY_NAMES, {}).get(prop_name)

    def get_system_populated_props(self):
        return self._get_semantics().get(SYSTEM_POPULATED_PROPS, {})
    
    def get_system_populated_prop_list(self):
        return list(self.get_system_populated_props().keys())

    def get_system_populated_props_for_node(self, node):
        props = self.get_node_props(node)
        system_populated_props = self.get_system_populated_prop_list()
        if not props or not system_populated_props:
            return ({}, {})
        populated_props = set(props.keys()) & set(system_populated_props)
        populated_props_dict = self.get_system_populated_props()
        system_populated_properties = {prop: populated_props_dict[prop] for prop in populated_props}
        system_populated_relationships = self.get_system_populated_relationships_for_node(node)
        return system_populated_properties, system_populated_relationships

    def get_system_populated_relationships_for_node(self, node):
        relationship_columns = self.get_node_rel_columns(node)
        system_populated_props = self.get_system_populated_props()
        result = {}
        for relationship_column in relationship_columns:
            node, id_prop = relationship_column.split('.')
            if id_prop in system_populated_props:
                result[relationship_column] = system_populated_props[id_prop]
        return result

    """ 
    returns relationship columns that must be populated even user doesn't include the column
    """
    def get_must_populated_relationships_for_node(self, node):
        all_potential_relationships = self.get_node_rel_columns(node)
        required_relationships = self.get_req_rel_columns_for_node(node)
        system_populated_relationships = self.get_system_populated_relationships_for_node(node)

        # sole relationship
        if len(all_potential_relationships) == 1:
            return system_populated_relationships

        # required and system populated
        result = {}
        for relationship, system_prop in system_populated_relationships.items():
            if relationship in required_relationships:
                result[relationship] = system_prop
        return result

    """
    Returns properties user must provide
    """
    def get_final_required_props_for_node(self, node):
        required_props = self.get_node_req_props(node)
        system_populated_props = self.get_system_populated_prop_list()
        final_required_props = list(set(required_props.keys()) - set(system_populated_props))
        return final_required_props

    """
    get file name property, pick first file node name if there are multiple file nodes
    """
    def get_file_name(self):
        file_nodes = self.get_file_nodes()
        first_file_node = next(iter(file_nodes.values()), {})
        return first_file_node.get(DEF_FILE_NAME_FIELD)
    
    """
    get list delimiter
    """
    def get_list_delimiter(self):
        return self.model_config.get(LIST_DELIMITER_PROP, '|')

    """
    get dcf prefix
    """
    def get_omit_dcf_prefix(self):
        return self.model_config.get(OMIT_DCF_PREFIX, False)
    
    """
    get composition key
    """
    def get_composition_key(self, node):
        return self.model[NODES_LABEL][node].get(COMPOSITION_KEY, None)

    def get_model_version(self):
        return self.model.get("version", None)
    
    def get_data_commons(self):
        return self.model.get("data_commons", None)

    def edge_to_column_name(self, edge):
        if edge is None:
            return ''
        node = edge.dst
        key = self.get_node_key_prop(node.handle)
        return f'{node.handle}.{key}'

    def get_node_key_prop(self, node):
        props = self.mdf_model.nodes[node].props if self.mdf_model else {}
        key = None
        for prop in props.values():
            if prop.is_key:
                key = prop.handle
                break
        return key

    def get_edges(self):
        return self.mdf_model.edges.values() if self.mdf_model else []
