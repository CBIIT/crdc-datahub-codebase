import { useQuery } from "@apollo/client";
import { createContext, FC, useContext, useEffect, useMemo } from "react";

import { FeatureFlagKey, FeatureFlags } from "@/config/FeatureFlags";
import { GET_FEATURE_FLAGS, GetFeatureFlagsResp } from "@/graphql";
import { Logger } from "@/utils";
import { resolveFeatureFlags } from "@/utils/featureFlagUtils";

export type FeatureFlagsStatus = "LOADING" | "LOADED" | "ERROR";

export type FeatureFlagsCtxState = {
  /**
   * The current status of flag retrieval.
   */
  status: FeatureFlagsStatus;
  /**
   * The current state of every feature flag.
   */
  flags: FeatureFlags;
};

export const FeatureFlagsContext = createContext<FeatureFlagsCtxState>(null);
FeatureFlagsContext.displayName = "FeatureFlagsContext";

export const useFeatureFlags = (): FeatureFlagsCtxState => {
  const context = useContext<FeatureFlagsCtxState>(FeatureFlagsContext);

  if (!context) {
    throw new Error("useFeatureFlags cannot be used outside of the FeatureFlagsProvider component");
  }

  return context;
};

/**
 * Provides the state of a single feature flag.
 *
 * @param {FeatureFlagKey} key The flag to read
 * @returns {boolean} Whether the flag is on
 */
export const useFeatureFlag = (key: FeatureFlagKey): boolean => useFeatureFlags().flags[key];

/**
 * Determines the provider status from the request state.
 *
 * @param {boolean} isLoading Whether the request is still in progress
 * @param {boolean} hasFlags Whether the API returned a flags payload
 * @returns {FeatureFlagsStatus} The provider status
 */
const getStatus = (isLoading: boolean, hasFlags: boolean): FeatureFlagsStatus => {
  if (isLoading) {
    return "LOADING";
  }
  if (!hasFlags) {
    return "ERROR";
  }

  return "LOADED";
};

type ProviderProps = {
  children: React.ReactNode;
};

export const FeatureFlagsProvider: FC<ProviderProps> = ({ children }: ProviderProps) => {
  const { data, error, loading } = useQuery<GetFeatureFlagsResp>(GET_FEATURE_FLAGS, {
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (!error) {
      return;
    }

    Logger.error("FeatureFlagsProvider: Unable to fetch feature flags. Using defaults.", error);
  }, [error]);

  const value = useMemo<FeatureFlagsCtxState>(
    () => ({
      status: getStatus(loading, !!data?.getFeatureFlags),
      flags: resolveFeatureFlags(data?.getFeatureFlags),
    }),
    [data, loading]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};
