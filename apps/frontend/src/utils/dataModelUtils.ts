import { chain, keys, sortBy } from "lodash";

import { MODEL_FILE_REPO } from "@/config/ModelNavigator";
import env from "@/env";
import { RetrievePVsByPropertyNameResponse } from "@/graphql";

import { isRecord } from "./jsonUtils";
import { Logger } from "./logger";

/**
 * Normalizes manifest entries into Data Models, ordered by finite order values first.
 * Entries without an order retain their manifest order.
 */
export const buildDataModels = (manifest: Record<string, unknown>): DataCommon[] => {
  const models: DataCommon[] = Object.entries(manifest).flatMap(([name, value]) => {
    if (!name || !isRecord(value)) {
      Logger.error("DataModelsProvider: Skipping invalid model manifest entry", name);
      return [];
    }

    const assets = value as ManifestAssets;
    const displayName = value["display-name"];

    return [
      {
        name,
        displayName:
          typeof displayName === "string" && displayName.trim() ? displayName.trim() : name,
        isHidden: value.isHidden === true,
        assets,
      },
    ];
  });

  return sortBy(models, [
    ({ assets }) => (Number.isFinite(assets.order) ? 0 : 1),
    ({ assets }) => (Number.isFinite(assets.order) ? assets.order : 0),
  ]);
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
    propertyToPVs.set(property, permissibleValues);
  });

  // Map the REQUESTED properties to their corresponding permissible values from the API
  const mappedPVs = new Map<string, string[] | null | undefined>();
  properties.forEach((propertyName) => {
    mappedPVs.set(propertyName, propertyToPVs.get(propertyName));
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
        //
        // Critical Note: If pvs are null, that is explicitly a NO-OP and means we should not modify the MDF.
      } else if (typeof permissibleValues === "undefined" && property.enum) {
        Logger.error("No permissible values returned for property", propertyName, property);
        property.enum = [
          "Permissible values are currently not available. Please contact the CRDC Submission Portal HelpDesk at NCICRDCHelpDesk@mail.nih.gov",
        ];
      }
    });
};
