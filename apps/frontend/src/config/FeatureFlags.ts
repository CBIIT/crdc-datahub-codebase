export type FeatureFlagDefinition = {
  /**
   * Internal description of what the flag controls.
   */
  description: string;
  /**
   * The safe fallback value for the flag.
   */
  defaultValue: boolean;
  /**
   * Internal indicator of how long the flag is expected to live.
   *
   * - `release` - Temporary. Hides a feature until it ships, then the flag should be removed.
   * - `killSwitch` - Permanent. An on/off switch that stays, like maintenance mode.
   */
  type: "release" | "killSwitch";
};

/**
 * The feature flags used to toggle features.
 */
export const FEATURE_FLAGS = {
  isMaintenanceMode: {
    description: "Replaces every route with the maintenance page.",
    defaultValue: false,
    type: "killSwitch",
  },
  isChatBotEnabled: {
    description: "Shows the ChatBot in the launcher.",
    defaultValue: false,
    type: "killSwitch",
  },
  isNetriasEnabled: {
    description: "Enables the Netrias integration.",
    defaultValue: false,
    type: "release",
  },
} as const satisfies Record<string, FeatureFlagDefinition>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export type FeatureFlags = Readonly<Record<FeatureFlagKey, boolean>>;

export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

/**
 * The value of every feature flag by default.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = Object.freeze(
  Object.fromEntries(FEATURE_FLAG_KEYS.map((key) => [key, FEATURE_FLAGS[key].defaultValue]))
) as FeatureFlags;
