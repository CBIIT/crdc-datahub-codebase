import { Factory } from "../Factory";

import { qcResultFactory } from "./QCResultFactory";

/**
 * Base cross validation result object
 */
export const baseCrossValidationResult: CrossValidationResult = {
  ...qcResultFactory.build(),
  conflictingSubmission: "",
};

/**
 * Cross validation result factory for creating cross validation result instances
 */
export const crossValidationResultFactory = new Factory<CrossValidationResult>((overrides) => ({
  ...baseCrossValidationResult,
  ...overrides,
}));
