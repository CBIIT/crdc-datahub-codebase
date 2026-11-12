import { Factory } from "../Factory";

import { manifestAssetsFactory } from "./ManifestAssetsFactory";

/**
 * Base Data Common object
 */
export const baseDataCommon: DataCommon = {
  name: "",
  displayName: "",
  isHidden: false,
  assets: manifestAssetsFactory.build(),
};

/**
 * Data Common factory for creating Data Common instances
 */
export const dataCommonFactory = new Factory<DataCommon>((overrides) => ({
  ...baseDataCommon,
  ...overrides,
}));
