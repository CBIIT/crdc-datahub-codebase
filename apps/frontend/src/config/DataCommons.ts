import { getFilteredDataCommons } from "../utils/envUtils";

/**
 * The URL of the Data Commons Model Repo
 *
 * Model Data:
 * - `[dev_tier]/cache/[model_name]/[model_version]/`
 *
 * Content Manifest:
 * - `[dev_tier]/cache/content.json`
 */
export const MODEL_FILE_REPO = "https://raw.githubusercontent.com/CBIIT/crdc-datahub-models/";

/**
 * A collection of site-wide supported Data Commons.
 */
const DataCommons: DataCommon[] = [
  {
    name: "CDS",
    displayName: "GC",
    assets: null,
  },
  {
    name: "CCDI",
    displayName: "CCDI",
    assets: null,
  },
  {
    name: "CTDC",
    displayName: "CTDC",
    assets: null,
  },
  {
    name: "ICDC",
    displayName: "ICDC",
    assets: null,
  },
  {
    name: "PSDC",
    displayName: "PSDC",
    assets: null,
  },
  {
    name: "Test MDF",
    displayName: "Test MDF",
    assets: null,
  },
  {
    name: "Hidden Model",
    displayName: "Hidden Model",
    assets: null,
  },
];

// TODO: This is a TEMPORARY implementation to hide Data Commons from the UI
// for 3.1.0 only. This will be refactored in 3.2.0
const HiddenModels = getFilteredDataCommons();
const FilteredDataCommons = DataCommons.filter((dc) => !HiddenModels.includes(dc.name));
export { FilteredDataCommons as DataCommons };
