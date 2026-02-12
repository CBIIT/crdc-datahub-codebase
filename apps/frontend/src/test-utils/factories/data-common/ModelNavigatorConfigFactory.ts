import { Factory } from "../Factory";

/**
 * Base Model Navigator Config object
 */
export const baseModelNavigatorConfig: ModelNavigatorConfig = {
  pageTitle: "",
  readMeTitle: "",
  pdfConfig: {
    downloadPrefix: "",
    fileTransferManifestName: "",
    footnote: "",
    landscape: false,
  },
  iconMap: {},
  facetFilterSearchData: [],
  facetFilterSectionVariables: {},
};

/**
 * Model Navigator Config factory for creating Model Navigator Config instances
 */
export const modelNavigatorConfigFactory = new Factory<ModelNavigatorConfig>((overrides) => ({
  ...baseModelNavigatorConfig,
  ...overrides,
}));
