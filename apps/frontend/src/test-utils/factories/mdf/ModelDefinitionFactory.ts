import { Factory } from "../Factory";

/**
 * Base MDF Dictionary object
 */
export const baseMDFDictionary: MDFDictionary = {};

/**
 * MDF Dictionary factory for creating Data Model Navigator MDF Dictionary instances
 *
 * @note You must supply nodes via the ModelDefinitionNodeFactory
 */
export const modelDefinitionFactory = new Factory<MDFDictionary>((overrides) => ({
  ...baseMDFDictionary,
  ...overrides,
}));
