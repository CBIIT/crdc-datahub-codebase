import { Factory } from "../Factory";

/**
 * Base node type summary object
 */
export const baseNodeTypeSummary: NodeTypeSummary = {
  nodeType: "",
  new: 0,
  updated: 0,
  deleted: 0,
};

/**
 * New NodeTypeSummary factory for creating new node type summary instances
 */
export const nodeTypeSummaryFactory = new Factory<NodeTypeSummary>((overrides) => ({
  ...baseNodeTypeSummary,
  ...overrides,
}));
