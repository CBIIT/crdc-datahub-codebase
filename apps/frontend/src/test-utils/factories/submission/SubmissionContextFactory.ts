import { SubmissionCtxState, SubmissionCtxStatus } from "@/components/Contexts/SubmissionContext";

import { Factory } from "../Factory";

import { submissionAttributesFactory } from "./SubmissionAttributesFactory";
import { submissionFactory } from "./SubmissionFactory";

/**
 * Base SubmissionCtxState object
 */
export const baseSubmissionCtxState: SubmissionCtxState = {
  status: SubmissionCtxStatus.LOADING,
  data: {
    getSubmission: submissionFactory.build(),
    getSubmissionAttributes: {
      submissionAttributes: submissionAttributesFactory
        .pick(["isBatchUploading", "hasOrphanError"])
        .build(),
    },
    submissionStats: null,
  },
  error: null,
  refetch: null,
  startPolling: null,
  stopPolling: null,
  updateQuery: null,
};

/**
 * SubmissionCtxState factory for creating SubmissionCtxState instances
 */
export const submissionCtxStateFactory = new Factory<SubmissionCtxState>((overrides) => ({
  ...baseSubmissionCtxState,
  ...overrides,
}));
