import { ApolloError, ApolloQueryResult, useQuery } from "@apollo/client";
import { cloneDeep, isEqual, merge } from "lodash";
import React, {
  FC,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { GetSubmissionResp, GET_SUBMISSION, GetSubmissionInput } from "../../graphql";
import { compareNodeStats, Logger } from "../../utils";

export type SubmissionCtxState = {
  /**
   * The current state of the context
   */
  status: SubmissionCtxStatus;
  /**
   * The data returned by the query
   */
  data: GetSubmissionResp | null;
  /**
   * The error returned by the query
   */
  error: ApolloError | null;
  /**
   * Initiates polling for the query at the specified interval, with options to skip queries
   */
  startPolling?: (pollInterval: number, partial?: boolean) => void;
  /**
   * Stops polling for the query
   */
  stopPolling?: () => void;
  /**
   * Force refetch the query
   */
  refetch?: (
    variables?: Partial<GetSubmissionInput>
  ) => Promise<ApolloQueryResult<GetSubmissionResp>>;
  /**
   * Update the cached query data without a network request
   *
   * @param callback The function to update the query data
   */
  updateQuery?: (callback: (prev: GetSubmissionResp) => GetSubmissionResp) => void;
};

export enum SubmissionCtxStatus {
  LOADING = "LOADING",
  POLLING = "POLLING",
  LOADED = "LOADED",
  ERROR = "ERROR",
}

/**
 * Data Submission Context
 *
 * @note Do NOT use this context directly. This is exported for testing purposes only.
 * @see {@link SubmissionCtxState}
 * @see {@link useSubmissionContext}
 */
export const SubmissionContext = createContext<SubmissionCtxState>(null);
SubmissionContext.displayName = "DataSubmissionContext";

/**
 * Hook to use the Data Submission Context
 *
 * @see {@link SubmissionProvider} Must be wrapped in the provider component
 * @see {@link SubmissionCtxState} Context state returned by the hook
 */
export const useSubmissionContext = (): SubmissionCtxState => {
  const context = useContext<SubmissionCtxState>(SubmissionContext);

  if (!context) {
    throw new Error(
      "useSubmissionContext cannot be used outside of the SubmissionProvider component"
    );
  }

  return context;
};

type ProviderProps = {
  /**
   * The Data Submission `_id` to populate the context for
   */
  _id: Submission["_id"];
  children: React.ReactNode;
};

/**
 * A memoized version of the Submission Provider
 *
 * @note This is to prevent unnecessary re-renders when the context value hasn't changed
 */
const MemoedProvider = React.memo<{ value: SubmissionCtxState; children: React.ReactNode }>(
  ({ value, children }) => (
    <SubmissionContext.Provider value={value}>{children}</SubmissionContext.Provider>
  ),
  isEqual
);

/**
 * Data Submission Provider component
 *
 * @note This provider will automatically start polling if:
 *  - The file, metadata, or cross submission status is "Validating"
 *  - Any batch status is "Uploading"
 * @see {@link useSubmissionContext} The context hook
 * @returns React Context Provider
 */
export const SubmissionProvider: FC<ProviderProps> = ({ _id, children }: ProviderProps) => {
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [mergedData, setMergedData] = useState<GetSubmissionResp>(null);

  useEffect(() => {
    setMergedData(null);
  }, [_id]);

  const {
    data,
    error,
    loading,
    startPolling: startApolloPolling,
    stopPolling: stopApolloPolling,
    refetch,
    updateQuery,
  } = useQuery<GetSubmissionResp, GetSubmissionInput>(GET_SUBMISSION, {
    notifyOnNetworkStatusChange: true,
    variables: { id: _id, partial: isPolling ?? false },
    context: { clientName: "backend" },
    fetchPolicy: "cache-and-network",
    onCompleted: (d) => {
      const isValidating =
        d?.getSubmission?.fileValidationStatus === "Validating" ||
        d?.getSubmission?.metadataValidationStatus === "Validating" ||
        d?.getSubmission?.crossSubmissionStatus === "Validating";
      const isDeleting = d?.getSubmission?.deletingData === true;
      const hasUploadingBatches =
        d?.getSubmissionAttributes?.submissionAttributes?.isBatchUploading;
      if (!isValidating && !hasUploadingBatches && !isDeleting) {
        stopPolling();
      } else if (!isPolling) {
        startPolling(1000);
      }
    },
    onError: (e) => {
      Logger.error("Error fetching submission data", e);
    },
  });

  const status: SubmissionCtxStatus = useMemo<SubmissionCtxStatus>(() => {
    if (error || (!loading && !mergedData)) {
      return SubmissionCtxStatus.ERROR;
    }
    if (isPolling) {
      return SubmissionCtxStatus.POLLING;
    }
    if (loading && !mergedData) {
      return SubmissionCtxStatus.LOADING;
    }

    return SubmissionCtxStatus.LOADED;
  }, [loading, error, isPolling, mergedData]);

  useEffect(() => {
    if (!data) {
      return;
    }
    let sortedStats = [];
    if (Array.isArray(data.submissionStats?.stats)) {
      sortedStats = cloneDeep(data.submissionStats.stats);
      sortedStats.sort(compareNodeStats);
    }
    // Polled partial data will replace existing data
    if (isPolling) {
      setMergedData((prev) => merge({}, prev, data));
      return;
    }

    // Otherwise, just replace all existing data with new data
    setMergedData((prev) => ({
      ...prev,
      getSubmission: data?.getSubmission,
      submissionStats: { stats: sortedStats },
      getSubmissionAttributes: data?.getSubmissionAttributes,
    }));
  }, [data]);

  /**
   * Wrapper function to start polling for the submission
   */
  const startPolling = useCallback(
    (interval: number) => {
      startApolloPolling(interval);
      setIsPolling(true);
    },
    [startApolloPolling]
  );

  /**
   * Wrapper function to stop polling for the submission
   */
  const stopPolling = useCallback(() => {
    stopApolloPolling();
    setIsPolling(false);
  }, [stopApolloPolling]);

  const value: SubmissionCtxState = useMemo<SubmissionCtxState>(
    () => ({
      status,
      data: mergedData,
      error,
      startPolling,
      stopPolling,
      refetch,
      updateQuery,
    }),
    [status, mergedData, error, startPolling, stopPolling, refetch, updateQuery]
  );

  return <MemoedProvider value={value}>{children}</MemoedProvider>;
};
