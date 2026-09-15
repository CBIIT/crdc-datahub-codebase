class SRF:
    def __init__(self, srf_data={}, system_populated_prop={}):
        self.srf_data = srf_data
        self.system_populated_props = system_populated_prop

    def get_property_value(self, prop):
        return None