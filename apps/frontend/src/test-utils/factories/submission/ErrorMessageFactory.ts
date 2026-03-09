import { Factory } from "../Factory";

/**
 * Base error message object
 */
export const baseErrorMessage: ErrorMessage = {
  code: "M018",
  title: "",
  description: "",
};

/**
 * Error message factory for creating error message instances
 */
export const errorMessageFactory = new Factory<ErrorMessage>((overrides) => ({
  ...baseErrorMessage,
  ...overrides,
}));
