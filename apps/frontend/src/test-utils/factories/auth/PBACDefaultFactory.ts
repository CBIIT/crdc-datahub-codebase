import { Factory } from "../Factory";

/**
 * Base PBAC default object
 */
export const basePBACDefault: PBACDefault = {
  _id: "submission_request:view",
  group: "",
  name: "",
  inherited: [],
  order: 0,
  checked: false,
  disabled: false,
};

/**
 * PBAC default factory for creating PBAC default instances
 */
export const pbacDefaultFactory = new Factory<PBACDefault>((overrides) => ({
  ...basePBACDefault,
  ...overrides,
}));
