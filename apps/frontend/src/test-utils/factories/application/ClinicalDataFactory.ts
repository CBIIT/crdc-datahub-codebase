import { Factory } from "../Factory";

/**
 * Base clinical data object
 */
export const baseClinicalData: ClinicalData = {
  dataTypes: [],
  otherDataTypes: "",
  futureDataTypes: false,
};

/**
 * Clinical data factory for creating clinical data instances
 */
export const clinicalDataFactory = new Factory<ClinicalData>((overrides) => ({
  ...baseClinicalData,
  ...overrides,
}));
