import { Factory } from "../Factory";

type TermDefinition = MDFDictionary[number]["properties"][number]["Term"][number];

/**
 * Base MDF Property Term Definition
 */
export const baseMDFNode: TermDefinition = {
  Code: "",
  Origin: "",
  Value: "",
  Version: "0.00",
};

/**
 * A factory for generating MDFDictionary Property Terms
 */
export const modelDefinitionTermFactory = new Factory<TermDefinition>((overrides) => ({
  ...baseMDFNode,
  ...overrides,
}));
