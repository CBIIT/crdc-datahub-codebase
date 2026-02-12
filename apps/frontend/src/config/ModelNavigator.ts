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
