/**
 * This is a loosely defined type for the Data Model Navigator configuration.
 *
 * Only the options that are explicitly used by CRDC Hub are defined here.
 */
type ModelNavigatorConfig = {
  /**
   * The title of the Data Model Navigator page
   *
   * e.g. "CRDC Data Model Navigator"
   */
  pageTitle: string;
  /**
   * Provides a title to the README modal popup
   *
   * @default "Understanding the Data Model"
   */
  readMeTitle?: string;
  pdfConfig?: {
    [key: string]: unknown;
    /**
     * Override ALL download file names with this prefix.
     */
    downloadPrefix?: string;
    /**
     * The default name for a Node file download
     *
     * Falls back to the `downloadPrefix` if not provided.
     */
    fileTransferManifestName?: string;
    /**
     * Override default ICDC URL in PDF footers
     */
    footnote: string;
    /**
     * Whether to render the PDF in landscape mode
     *
     * @note The portrait mode is broken ATM.
     */
    landscape?: boolean;
  };
  /**
   * A map of MDF category names to icon names.
   *
   * @example
   * {
   *   "mock-category": "case",
   * }
   */
  iconMap?: {
    [category: string]: string;
  };
  facetFilterSearchData: FacetSearchData[];
  facetFilterSectionVariables: {
    [key: string]: unknown;
  };
};

/**
 * This is an object that contains the fully qualified URLs for the Data Model assets.
 *
 * @note This is just an internal concept, it's not used outside of the UI or within dependencies.
 */
type ModelAssetUrls = {
  /**
   * An array of fully-qualified URLs to the Data Model files.
   * Arbitrary length, but must have at least one item.
   */
  model_files: string[];
  /**
   * The URL to the Data Model README file
   * If this is null, the README button will not be displayed
   */
  readme: string;
  /**
   * The URL for the Data Model Loading files zip
   */
  loading_file: string;
  /**
   * The URL for the Data Model Navigator logo
   * If this is empty, Model Navigator will utilize a fallback
   *
   * @see Related to {@link ManifestAssets} "model-navigator-logo"
   * @since 3.1.0
   */
  navigator_icon: string;
  /**
   * the URL to the Data Model Release Notes file
   * If this is null, the Release Notes tab will not be displayed
   */
  changelog?: string;
};

type FacetSearchData = {
  [key: string]: unknown;
  datafield: string;
  checkboxItems: {
    [key: string]: unknown;
    name: string;
  }[];
};

/**
 * An elementary definition for the Data Model Navigator internal dictionary
 * data structure.
 */
type MDFDictionary = {
  /**
   * A MDF node name, e.g. "study"
   */
  [nodeName: string]: {
    /**
     * Unknown or irrelevant attributes of the node
     */
    [key: string]: unknown;
    /**
     * A map of node properties and their definitions
     */
    properties: {
      [propertyName: string]: {
        /**
         * Unknown or irrelevant attributes of the property
         */
        [key: string]: unknown;
        /**
         * An array of permissible values, if applicable, for the property
         */
        enum: Array<unknown> | undefined;
        /**
         * An array of CDE Terms tied to the property
         */
        Term: Array<{
          /**
           * The CDE Code
           */
          Code: string;
          /**
           * The CDE Origin
           *
           * @example "caDSR"
           */
          Origin: string;
          /**
           * The CDE Display Name
           */
          Value: string;
          /**
           * The CDE Version number
           *
           * @example "1.0.0"
           */
          Version: string;
        }>;
      };
    };
  };
};
