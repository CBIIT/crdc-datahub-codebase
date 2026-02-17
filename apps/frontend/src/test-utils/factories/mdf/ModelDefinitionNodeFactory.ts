import { Factory } from "../Factory";

/**
 * Base MDF Node object
 */
export const baseMDFNode: MDFDictionary[number] = {
  properties: {},
};

/**
 * A factory for generating MDFDictionary Nodes
 */
export const modelDefinitionNodeFactory = new Factory<MDFDictionary[number]>((overrides) => ({
  ...baseMDFNode,
  ...overrides,
}));
