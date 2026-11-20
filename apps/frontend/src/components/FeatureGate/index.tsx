import { FC, ReactNode } from "react";

import { FeatureFlagKey } from "@/config/FeatureFlags";

import { useFeatureFlag } from "../Contexts/FeatureFlagsContext";

export type Props = {
  /**
   * The feature flag that must be on for `children` to render.
   */
  flag: FeatureFlagKey;
  /**
   * Rendered when the flag is off. Defaults to null.
   */
  fallback?: ReactNode;
  /**
   * The children to render when feature flag is enabled.
   */
  children: ReactNode;
};

/**
 * Renders its children only when the feature flag is on.
 *
 * @returns The children, or the fallback when the flag is off
 */
const FeatureGate: FC<Props> = ({ flag, fallback = null, children }) => {
  const isEnabled = useFeatureFlag(flag);

  if (!isEnabled) {
    return fallback;
  }

  return children;
};

export default FeatureGate;
