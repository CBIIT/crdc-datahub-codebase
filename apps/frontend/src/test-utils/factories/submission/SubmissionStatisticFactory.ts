import { Factory } from "../Factory";

/**
 * Base submission statistic object
 */
export const baseSubmissionStatistic: SubmissionStatistic = {
  nodeName: "",
  total: 0,
  new: 0,
  passed: 0,
  warning: 0,
  error: 0,
};

/**
 * Submission statistic factory for creating submission statistic instances
 */
export const submissionStatisticFactory = new Factory<SubmissionStatistic>((overrides) => ({
  ...baseSubmissionStatistic,
  ...overrides,
}));
