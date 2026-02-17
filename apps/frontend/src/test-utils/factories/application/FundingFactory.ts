import { Factory } from "../Factory";

/**
 * Base funding object
 */
export const baseFunding: Funding = {
  agency: "",
  grantNumbers: "",
  nciProgramOfficer: "",
};

/**
 * Funding factory for creating funding instances
 */
export const fundingFactory = new Factory<Funding>((overrides) => ({
  ...baseFunding,
  ...overrides,
}));
