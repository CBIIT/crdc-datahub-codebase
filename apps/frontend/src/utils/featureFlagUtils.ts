import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS,
  FeatureFlagKey,
  FeatureFlags,
} from "@/config/FeatureFlags";

import { isRecord } from "./jsonUtils";

/**
 * Builds the complete set of feature flags.
 *
 * @param {unknown} rawFlags The raw flags returned by the API
 * @returns {FeatureFlags} A frozen object containing every feature flag
 */
export const resolveFeatureFlags = (rawFlags?: unknown): FeatureFlags => {
  const flags = isRecord(rawFlags) ? rawFlags : {};

  const entries = FEATURE_FLAG_KEYS.map((key): [FeatureFlagKey, boolean] => {
    const value = flags[key];
    if (typeof value === "boolean") {
      return [key, value];
    }

    return [key, FEATURE_FLAGS[key].defaultValue];
  });

  return Object.freeze(Object.fromEntries(entries)) as FeatureFlags;
};
