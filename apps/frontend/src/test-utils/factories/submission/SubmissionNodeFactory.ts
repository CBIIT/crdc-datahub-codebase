import { Factory } from "../Factory";

/**
 * Base submission node object
 */
export const baseSubmissionNode: SubmissionNode = {
  submissionID: "",
  nodeType: "",
  nodeID: "",
  status: "New",
  createdAt: "",
  updatedAt: "",
  validatedAt: "",
  lineNumber: 0,
  props: "",
};

/**
 * Submission node factory for creating submission node instances
 */
export const submissionNodeFactory = new Factory<SubmissionNode>((overrides) => ({
  ...baseSubmissionNode,
  ...overrides,
}));
