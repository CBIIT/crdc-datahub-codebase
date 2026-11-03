/**
 * The URL of the Data Commons Model Repo
 *
 * Model Data:
 * - `[tier]/cache/[model_name]/[model_version]/`
 *
 * Content Manifest:
 * - `[tier]/cache/content.json`
 */
export const MODEL_FILE_REPO = "https://raw.githubusercontent.com/CBIIT/crdc-datahub-models/";

/**
 * Configuration for the facet filter (i.e. the entire DMN)
 */
export const baseConfiguration = {
  // Populated by the useBuildReduxStore hook
  facetSearchData: null,
  facetSectionVariables: null,
  baseFilters: {},
  filterOptions: [],
  filterSections: [],
  showCheckboxCount: 6,
};

/**
 * Base configuration for the graph view
 */
export const graphViewConfig = {
  legend: {},
  canvas: {
    fit: {
      x: 0,
      y: 20,
      zoom: 0.7,
      minZoom: 0.7,
      maxZoom: 2,
    },
  },
};

/**
 * Fall-back title for the Data Model README popup
 */
export const defaultReadMeTitle = "Understanding the Data Model";
