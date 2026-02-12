import { Factory } from "../Factory";

/**
 * Base submission history event object
 */
export const baseSubmissionHistoryEvent: SubmissionHistoryEvent = {
  status: "New",
  dateTime: "",
  userID: "",
  reviewComment: null,
  userName: null,
};

/**
 * Submission history event factory for creating submission history event instances
 */
export const submissionHistoryEventFactory = new Factory<SubmissionHistoryEvent>((overrides) => ({
  ...baseSubmissionHistoryEvent,
  ...overrides,
}));
