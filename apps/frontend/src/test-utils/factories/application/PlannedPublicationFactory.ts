import { Factory } from "../Factory";

/**
 * Base planned publication object
 */
export const basePlannedPublication: PlannedPublication = {
  title: "",
  expectedDate: "",
};

/**
 * Planned publication factory for creating planned publication instances
 */
export const plannedPublicationFactory = new Factory<PlannedPublication>((overrides) => ({
  ...basePlannedPublication,
  ...overrides,
}));
