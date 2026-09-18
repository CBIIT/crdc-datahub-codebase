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
    def __init__(self, srf_data={}, system_populated_prop={}):
        if not isinstance(srf_data, dict):
            raise ValueError("srf_data/application must be a dictionary")
        self.system_populated_props = system_populated_prop

        questionnaire = srf_data.get("questionnaireData", {})
        self.questionnaire = questionnaire
        if isinstance(questionnaire, str):
            self.questionnaire = json.loads(questionnaire)

    def _get_property_value(self, prop):
        system_prop = self.system_populated_props.get(prop)
        if not system_prop:
            return None
        srf_prop = SRF_PROP_MAPPING.get(system_prop)
        if not srf_prop:
            return None
        node = self.questionnaire.get(srf_prop.get(NODE, {}), {})
        value = node.get(srf_prop.get(PROP), "").strip()
        return value

    def get_all_system_populated_values(self):
        if not self.system_populated_props:
            return {}
        values = {}
        for prop in self.system_populated_props.keys():
            rawValue = self._get_property_value(prop)
            values[prop] = rawValue
        return  values