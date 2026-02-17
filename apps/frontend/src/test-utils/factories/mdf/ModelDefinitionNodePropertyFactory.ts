import { Factory } from "../Factory";

/**
 * Base MDF Node Property object
 */
export const baseMDFNode: MDFDictionary[number]["properties"][number] = {
  Term: [],
  enum: undefined,
};

/**
 * A factory for generating MDFDictionary Node Properties
 */
export const modelDefinitionNodePropertyFactory = new Factory<
  MDFDictionary[number]["properties"][number]
>((overrides) => ({
  ...baseMDFNode,
  ...overrides,
}));
