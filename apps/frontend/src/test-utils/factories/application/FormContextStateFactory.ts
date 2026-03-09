import { ContextState as FormContextState, Status } from "../../../components/Contexts/FormContext";
import { Factory } from "../Factory";

import { applicationFactory } from "./ApplicationFactory";

/**
 * Base FormContextState object
 */
export const baseFormContextState: FormContextState = {
  status: Status.LOADED,
  formRef: null,
  data: applicationFactory.build(),
};

/**
 * FormContextState factory for creating FormContextState instances
 */
export const formContextStateFactory = new Factory<FormContextState>((overrides) => ({
  ...baseFormContextState,
  ...overrides,
}));
