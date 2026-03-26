import { chain, keys } from "lodash";

import { MODEL_FILE_REPO } from "@/config/DataCommons";
import env from "@/env";
import { RetrievePVsByPropertyNameResponse } from "@/graphql";

import { Logger } from "./logger";

/**
 * Fetch the tracked Data Model content manifest.
 *
 * @returns The parsed content manifest.
 * @throws An error if the manifest cannot be fetched.
 */
export const fetchManifest = async (): Promise<DataModelManifest> => {
  if (sessionStorage.getItem("manifest")) {
    return JSON.parse(sessionStorage.getItem("manifest"));
  }

  const response = await fetch(
    `${MODEL_FILE_REPO}${env.VITE_DEV_TIER || "prod"}/cache/content.json`
  ).catch(() => null);
  const parsed = await response?.json().catch(() => null);
  if (response && parsed) {
    sessionStorage.setItem("manifest", JSON.stringify(parsed));
    return parsed;
  }

  throw new Error("Unable to fetch or parse manifest");
};

/**
 * List the available Data Model versions for a given Data Model
 *
 * @param model The Data Model (DataCommon) to list versions for (e.g. "CDS")
 * @returns An array of version strings or empty if none are found
 */
export const listAvailableModelVersions = async (model: string): Promise<string[]> => {
  try {
    const manifest = await fetchManifest();
    if (!manifest || !manifest[model]) {
      throw new Error(`Unable to find manifest for ${model}`);
    }

    const { versions } = manifest[model];
    if (!Array.isArray(versions) || versions.length === 0) {
      throw new Error(`No versions found for ${model}`);
    }

    return versions;
  } catch (e) {
    Logger.error("listDataModelVersions: An exception was thrown", e);
  }

  return [];
};

/**
 * Builds the asset URLs for the Data Model Navigator to import from
 *
 * @param model The Data Model (DataCommon) to build asset URLs for
 * @param modelVersion The version of the Data Model to build asset URLs for
 * @returns ModelAssetUrls
 */
export const buildAssetUrls = (model: DataCommon, modelVersion: string): ModelAssetUrls => {
  const { name, assets } = model || {};
  const version = modelVersion === "latest" ? assets?.["current-version"] : modelVersion;
  const tier = env.VITE_DEV_TIER || "prod";

  return {
    model_files:
      assets?.["model-files"]?.map(
        (file) => `${MODEL_FILE_REPO}${tier}/cache/${name}/${version}/${file}`
      ) || [],
    readme: assets?.["readme-file"]
      ? `${MODEL_FILE_REPO}${tier}/cache/${name}/${version}/${assets?.["readme-file"]}`
      : null,
    loading_file: assets?.["loading-file"]
      ? `${MODEL_FILE_REPO}${tier}/cache/${name}/${version}/${assets?.["loading-file"]}`
      : null,
    navigator_icon: assets?.["model-navigator-logo"]
      ? `${MODEL_FILE_REPO}${tier}/cache/${name}/${version}/${assets?.["model-navigator-logo"]}`
      : "",
    changelog: assets?.["release-notes"]
      ? `${MODEL_FILE_REPO}${tier}/cache/${name}/${version}/${assets?.["release-notes"]}`
      : `${MODEL_FILE_REPO}${tier}/cache/${name}/${version}/version-history.md`,
  };
};

/**
 * Helper function to SAFELY build a set of base filter containers for the Data Model Navigator
 *
 * @example { category: [], uiDisplay: [], ... }
 * @param config The Data Model Navigator configuration to build the base filters from
 * @returns An array of base filters used by Data Model Navigator
 */
export const buildBaseFilterContainers = (config: ModelNavigatorConfig): { [key: string]: [] } => {
  if (!config || !config?.facetFilterSearchData) {
    return {};
  }
  if (!Array.isArray(config.facetFilterSearchData) || config.facetFilterSearchData.length === 0) {
    return {};
  }

  return config.facetFilterSearchData.reduce(
    (o, searchData) => ({
      ...o,
      [searchData?.datafield || "base"]: [],
    }),
    {}
  );
};

/**
 * Helper function to build an array of possible filter options for the Data Model Navigator
 *
 * @example [ 'administrative', 'case', ... ]
 * @param config The data common to build the filter options list for
 * @returns An array of filter options used by Data Model Navigator
 */
export const buildFilterOptionsList = (config: ModelNavigatorConfig): string[] => {
  if (!config || !config?.facetFilterSearchData) {
    return [];
  }
  if (!Array.isArray(config.facetFilterSearchData) || config.facetFilterSearchData.length === 0) {
    return [];
  }

  return config.facetFilterSearchData.reduce((a, searchData) => {
    if (!Array.isArray(searchData?.checkboxItems) || searchData.checkboxItems.length === 0) {
      return a;
    }

    return [...a, ...searchData.checkboxItems.map((item) => item?.name?.toLowerCase())];
  }, []);
};

/**
 * A utility to extract all unique property names from the MDF dictionary.
 *
 * @param dictionary the MDF dictionary to extract property names from
 * @returns An array of unique property names
 */
export const extractModelProperties = (dictionary: MDFDictionary): string[] => {
  if (!dictionary || Object.keys(dictionary).length === 0) {
    return [];
  }

  return chain(dictionary)
    .values()
    .flatMap((node) => keys(node?.properties ?? {}))
    .uniq()
    .value();
};

export const populatePermissibleValues = (
  dictionary: MDFDictionary,
  properties: string[],
  data: RetrievePVsByPropertyNameResponse["retrievePVsByPropertyName"]
): void => {
  if (!dictionary || Object.keys(dictionary).length === 0) {
    return;
  }

  // Create a mapping of API-provided property names to their permissible values for efficient lookup
  const propertyToPVs = new Map<string, string[] | null>();
  data?.forEach(({ property, permissibleValues }) => {
    propertyToPVs.set(property, permissibleValues ?? null);
  });

  // Map the REQUESTED properties to their corresponding permissible values from the API
  // If the requested property is not found in the API response, it will be set to null to indicate missing data
  const mappedPVs = new Map<string, string[] | null>();
  properties.forEach((propertyName) => {
    mappedPVs.set(propertyName, propertyToPVs.get(propertyName) ?? null);
  });

  chain(dictionary)
    .values()
    .flatMap((node) =>
      chain(node?.properties ?? {})
        .toPairs()
        .map(([propertyName, property]) => ({ propertyName, property }))
        .value()
    )
    .value()
    .forEach(({ propertyName, property }) => {
      const permissibleValues = mappedPVs.get(propertyName);
      if (permissibleValues) {
        // Populate Permissible Values if available from API
        if (Array.isArray(permissibleValues) && permissibleValues.length > 0) {
          property.enum = permissibleValues;
          // Permissible Values from API are empty, convert property to "string" type
        } else if (
          Array.isArray(permissibleValues) &&
          permissibleValues.length === 0 &&
          property.enum
        ) {
          delete property.enum;
          property.type = "string";
        }
        // The API did not return data for this property, but it has an enum defined in the MDF.
        // This likely means the API is missing data for this property.
        // Update the enum to reflect that permissible values are not currently available.
      } else if (!permissibleValues && property.enum) {
        Logger.error("No permissible values returned for property", propertyName, property);
        property.enum = [
          "Permissible values are currently not available. Please contact the CRDC Submission Portal HelpDesk at NCICRDCHelpDesk@mail.nih.gov",
        ];
      }
    });
};
