from common.srf import SRF
from common.constants import STUDY_NAME

srf_data = {}
system_populated_props = {}


def test_get_study_name():
    srf = SRF()
    study_name = srf.get_property_value(STUDY_NAME)
    assert study_name is None