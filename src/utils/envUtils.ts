import env from "../env";

import { Logger } from "./logger";

/**
 * A regular expression to match the release version from the build tag.
 *
 * @see {@link parseReleaseVersion} for a usage example.
 */
export const ReleaseRegex = /^(\d{1,4}\.\d{1,4}\.\d{1,4}).*/;

/**
 * Safely parse the release version from the environment variable.
 * If it is not set, return an empty string.
 *
 * @note This utility expects the current tag to be defined as `X.X.X.buildNumber`.
 * @see {@link AppEnv.VITE_FE_VERSION}
 * @returns The parsed release version or "N/A" if not set.
 */
export const parseReleaseVersion = (): string => {
  const { VITE_FE_VERSION } = env || {};

  if (!VITE_FE_VERSION || typeof VITE_FE_VERSION !== "string") {
    Logger.error("parseReleaseVersion: VITE_FE_VERSION is not set or is not a string");
    return "N/A";
  }

  if (!ReleaseRegex.test(VITE_FE_VERSION)) {
    Logger.error(
      `parseReleaseVersion: VITE_FE_VERSION is not in the expected format: ${VITE_FE_VERSION}`
    );
    return "N/A";
  }

  const splitVersion = VITE_FE_VERSION.match(ReleaseRegex);
  if (!splitVersion || splitVersion.length < 2 || !splitVersion[1]) {
    Logger.error(
      `parseReleaseVersion: Unable to get release version from build tag: ${VITE_FE_VERSION}`
    );
    return "N/A";
  }

  return splitVersion[1];
};

/**
 * A utility to build the Release Notes Markdown URL based on the current build tag.
 *
 * @note If the build tag is not set or is not in the expected format, it will default to the main branch instead of a tag.
 * @returns The URL to the Release Notes Markdown file.
 */
export const buildReleaseNotesUrl = (): string => {
  const { VITE_FE_VERSION } = env || {};

  if (
    VITE_FE_VERSION &&
    typeof VITE_FE_VERSION === "string" &&
    ReleaseRegex.test(VITE_FE_VERSION)
  ) {
    return `https://raw.githubusercontent.com/CBIIT/crdc-datahub-ui/refs/tags/${VITE_FE_VERSION}/CHANGELOG.md`;
  }

  return "https://raw.githubusercontent.com/CBIIT/crdc-datahub-ui/refs/heads/main/CHANGELOG.md";
};

/**
 * A utility to safely get the hidden Data Commons from the environment variable.
 * If it is not set, return an empty array.
 *
 * @returns An array of hidden Data Commons or an empty array if not set.
 */
export const getFilteredDataCommons = (): string[] => {
  const { VITE_HIDDEN_MODELS } = env || {};

  if (!VITE_HIDDEN_MODELS || typeof VITE_HIDDEN_MODELS !== "string") {
    Logger.error("getFilteredDataCommons: VITE_HIDDEN_MODELS is not set or is not a string");
    return [];
  }

  const mapped = VITE_HIDDEN_MODELS.split(",")
    .map((dc) => dc?.trim())
    .filter((dc) => dc?.length);

  if (!mapped?.length) {
    return [];
  }

  return mapped;
};

/**
 * A utility to determine the correct base URL for the CRDC Data commons domain.
 *
 * @returns The base URL as a string.
 */
export const getCRDCBaseUrl = (): string => {
  const { VITE_DEV_TIER } = env || {};
  const lowerTiers: string[] = ["dev", "dev2", "qa", "qa2"];

  if (VITE_DEV_TIER && lowerTiers.includes(VITE_DEV_TIER.toLowerCase())) {
    return "https://datacommons-dev.cancer.gov/";
  }

  return "https://datacommons.cancer.gov/";
};
