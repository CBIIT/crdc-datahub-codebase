import { Factory } from "../Factory";

/**
 * Base program input object
 */
export const baseProgramInput: ProgramInput = {
  _id: "Not Applicable",
  name: "",
  abbreviation: "",
  description: "",
};

/**
 * Program input factory for creating program input instances
 */
export const programInputFactory = new Factory<ProgramInput>((overrides) => ({
  ...baseProgramInput,
  ...overrides,
}));
