from common.constants import SRF_PROGRAM, SRF_NAME, SRF_ACRONYM, SRF_DESCRIPTION, SRF_STUDY, PROGRAM_NAME, \
     PROGRAM_ACRONYM, PROGRAM_DESCRIPTION, STUDY_NAME, STUDY_ACRONYM, STUDY_DESCRIPTION
import json

NODE = "node"
PROP = "prop"

SRF_PROP_MAPPING = {
    PROGRAM_NAME: {
        NODE: SRF_PROGRAM,
        PROP: SRF_NAME
    },
    PROGRAM_ACRONYM: {
        NODE: SRF_PROGRAM,
        PROP: SRF_ACRONYM
    }, 
    PROGRAM_DESCRIPTION: {
        NODE: SRF_PROGRAM,
        PROP: SRF_DESCRIPTION
    },
    STUDY_NAME: {
        NODE: SRF_STUDY,
        PROP: SRF_NAME
    },
    STUDY_ACRONYM: {
        NODE: SRF_STUDY,
        PROP: SRF_ACRONYM
    },
    STUDY_DESCRIPTION: {
        NODE: SRF_STUDY,
        PROP: SRF_DESCRIPTION
    }
}

class SRF:
    def __init__(self, srf_data={}, system_populated_prop={}, system_populated_relationships={}):
        if not isinstance(srf_data, dict):
            raise ValueError("srf_data/application must be a dictionary")
        self.system_populated_props = system_populated_prop
        self.system_populated_relationships = system_populated_relationships

        questionnaire = srf_data.get("questionnaireData", {})
        self.questionnaire = questionnaire
        if isinstance(questionnaire, str):
            self.questionnaire = json.loads(questionnaire)

    def _get_property_value(self, prop):
        system_prop = self.system_populated_props.get(prop)
        if not system_prop:
            return None
        return self._get_questionaire_value(system_prop)

    def _get_questionaire_value(self, system_prop):
        srf_prop = SRF_PROP_MAPPING.get(system_prop)
        if not srf_prop:
            return None
        node = self.questionnaire.get(srf_prop.get(NODE, {}), {})
        value = node.get(srf_prop.get(PROP), "").strip()
        return value

    def get_system_populated_property_value_map(self):
        if not self.system_populated_props:
            return {}
        values = {}
        for prop in self.system_populated_props.keys():
            rawValue = self._get_property_value(prop)
            values[prop] = rawValue
        return  values

    def get_system_populated_relationship_value_map(self):
        result = {}
        for relationship, system_prop in self.system_populated_relationships.items():
            if is_valid_relationship_column(relationship):
                value = self._get_questionaire_value(system_prop)
                if value:
                    result[relationship] = value
        return result

def is_valid_relationship_column(column):
    if not isinstance(column, str):
        return False

    if '.' not in column:
        return False

    parts = column.split('.')
    if len(parts) != 2:
        return False

    return True