import { Factory } from "../Factory";

import { modelNavigatorConfigFactory } from "./ModelNavigatorConfigFactory";

/**
 * Base Manifest Assets object
 */
export const baseManifestAssets: ManifestAssets = {
  "model-files": [],
  "readme-file": "",
  "release-notes": "",
  "model-navigator-config": modelNavigatorConfigFactory.build(),
  "loading-file": "",
  "current-version": "",
  versions: [],
};

/**
 * Manifest Assets factory for creating Manifest Assets instances
 */
export const manifestAssetsFactory = new Factory<ManifestAssets>((overrides) => ({
  ...baseManifestAssets,
  ...overrides,
}));
