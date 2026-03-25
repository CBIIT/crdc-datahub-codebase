import { Mock } from "vitest";

import { MODEL_FILE_REPO } from "@/config/DataCommons";
import { dataCommonFactory } from "@/factories/data-common/DataCommonFactory";
import { manifestAssetsFactory } from "@/factories/data-common/ManifestAssetsFactory";
import { modelNavigatorConfigFactory } from "@/factories/data-common/ModelNavigatorConfigFactory";
import { modelDefinitionFactory } from "@/factories/mdf/ModelDefinitionFactory";
import { modelDefinitionNodeFactory } from "@/factories/mdf/ModelDefinitionNodeFactory";
import { modelDefinitionNodePropertyFactory } from "@/factories/mdf/ModelDefinitionNodePropertyFactory";
import { RetrievePVsByPropertyNameResponse } from "@/graphql";

import * as utils from "./dataModelUtils";

global.fetch = vi.fn();

vi.mock(import("../env"), async (importOriginal) => {
  const mod = await importOriginal();

  return {
    default: {
      ...mod.default,
      VITE_DEV_TIER: undefined,
    },
  };
});

describe("fetchManifest cases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  it("should return manifest from sessionStorage if it exists", async () => {
    const fakeManifest: DataModelManifest = {
      CDS: {
        "model-files": ["cds-model.yaml", "cds-model-props.yaml"],
        "readme-file": "cds-model-readme.md",
        "loading-file": "cds-loading.zip",
        "current-version": "1.0",
        "release-notes": "release-notes.md",
        "model-navigator-config": null,
        versions: [],
      },
    };
    sessionStorage.setItem("manifest", JSON.stringify(fakeManifest));

    const manifest = await utils.fetchManifest();

    expect(manifest).toEqual(fakeManifest);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should fetch manifest from server if it does not exist in sessionStorage", async () => {
    const fakeManifest: DataModelManifest = {
      CDS: {
        "model-files": ["cds-model.yaml", "cds-model-props.yaml"],
        "readme-file": "cds-model-readme.md",
        "loading-file": "cds-loading.zip",
        "current-version": "1.0",
        "release-notes": "release-notes.md",
        "model-navigator-config": null,
        versions: [],
      },
    };

    (fetch as Mock).mockImplementationOnce(() =>
      Promise.resolve({ json: () => Promise.resolve(fakeManifest) })
    );

    const manifest = await utils.fetchManifest();

    expect(manifest).toEqual(fakeManifest);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should cache manifest in sessionStorage after fetching", async () => {
    const fakeManifest: DataModelManifest = {
      CDS: {
        "model-files": ["cds-model.yaml", "cds-model-props.yaml"],
        "readme-file": "cds-model-readme.md",
        "loading-file": "cds-loading.zip",
        "current-version": "1.0",
        "release-notes": "release-notes.md",
        "model-navigator-config": null,
        versions: [],
      },
    };

    (fetch as Mock).mockImplementationOnce(() =>
      Promise.resolve({ json: () => Promise.resolve(fakeManifest) })
    );

    expect(sessionStorage.getItem("manifest")).toBeNull();

    await utils.fetchManifest();

    const cachedManifest = JSON.parse(sessionStorage.getItem("manifest"));
    expect(cachedManifest).toEqual(fakeManifest);
  });

  it("should throw an error if fetch fails", async () => {
    (fetch as Mock).mockImplementationOnce(() => Promise.reject(new Error("fetch error")));

    await expect(utils.fetchManifest()).rejects.toThrow("Unable to fetch or parse manifest");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // NOTE: We're asserting that JSON.parse does not throw an error here
  it("should throw a controlled error if fetch returns invalid JSON", async () => {
    (fetch as Mock).mockImplementationOnce(() =>
      Promise.resolve({ json: () => Promise.reject(new Error("JSON error")) })
    );

    await expect(utils.fetchManifest()).rejects.toThrow("Unable to fetch or parse manifest");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should fall back to prod tier if VITE_DEV_TIER is not defined", async () => {
    const fakeManifest = { key: "value" };

    (fetch as Mock).mockImplementationOnce(() =>
      Promise.resolve({ json: () => Promise.resolve(fakeManifest) })
    );

    await utils.fetchManifest();

    expect(fetch).toHaveBeenCalledWith(`${MODEL_FILE_REPO}prod/cache/content.json`);
  });
});

describe("listAvailableModelVersions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  it("should return available model versions", async () => {
    const fakeManifest: DataModelManifest = {
      CDS: manifestAssetsFactory.build({
        versions: ["XXX", "1.0", "2.0", "3.0"],
      }),
    };
    sessionStorage.setItem("manifest", JSON.stringify(fakeManifest));

    const versions = await utils.listAvailableModelVersions("CDS");

    expect(versions).toEqual(["XXX", "1.0", "2.0", "3.0"]);
  });

  it("should catch fetchManifest exception and return empty array", async () => {
    (fetch as Mock).mockImplementationOnce(() => Promise.reject(new Error("fetch error")));

    const versions = await utils.listAvailableModelVersions("CDS");

    expect(versions).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should return an empty array if the model is not found in the manifest", async () => {
    const fakeManifest: DataModelManifest = {
      CDS: manifestAssetsFactory.build({
        versions: ["mock-version"],
      }),
    };
    sessionStorage.setItem("manifest", JSON.stringify(fakeManifest));

    const versions = await utils.listAvailableModelVersions("this-model-does-not-exist");

    expect(versions).toEqual([]);
  });

  it("should return an empty array if no versions are found (empty)", async () => {
    const fakeManifest: DataModelManifest = {
      CDS: manifestAssetsFactory.build({
        versions: [],
      }),
    };
    sessionStorage.setItem("manifest", JSON.stringify(fakeManifest));

    const versions = await utils.listAvailableModelVersions("CDS");

    expect(versions).toEqual([]);
  });

  it("should return an empty array if no versions are found (non-array)", async () => {
    const fakeManifest: DataModelManifest = {
      CDS: manifestAssetsFactory.build({
        versions: null,
      }),
    };
    sessionStorage.setItem("manifest", JSON.stringify(fakeManifest));

    const versions = await utils.listAvailableModelVersions("CDS");

    expect(versions).toEqual([]);
  });
});

describe("buildAssetUrls cases", () => {
  it("should build asset URLs using prod tier when VITE_DEV_TIER is not defined", () => {
    const dc: DataCommon = dataCommonFactory.build({
      name: "test-name",
      assets: manifestAssetsFactory.build({
        "current-version": "1.0",
        "model-files": ["model-file", "prop-file"],
        "readme-file": "readme-file",
        "loading-file": "loading-file-zip-name",
        "release-notes": "release-notes.md",
      }),
      displayName: null,
    });

    const result = utils.buildAssetUrls(dc, "latest");

    expect(result).toEqual({
      model_files: [
        `${MODEL_FILE_REPO}prod/cache/test-name/1.0/model-file`,
        `${MODEL_FILE_REPO}prod/cache/test-name/1.0/prop-file`,
      ],
      readme: `${MODEL_FILE_REPO}prod/cache/test-name/1.0/readme-file`,
      loading_file: `${MODEL_FILE_REPO}prod/cache/test-name/1.0/loading-file-zip-name`,
      navigator_icon: expect.any(String),
      changelog: `${MODEL_FILE_REPO}prod/cache/test-name/1.0/release-notes.md`,
    });
  });

  it("should include every model file in the model_files array", () => {
    const dc: DataCommon = dataCommonFactory.build({
      name: "test-name",
      assets: manifestAssetsFactory.build({
        "current-version": "1.0",
        "model-files": ["model-file", "prop-file", "other-file", "fourth-file"],
        "readme-file": "readme-file",
        "loading-file": "loading-file-zip-name",
      }),
    });

    const result = utils.buildAssetUrls(dc, "latest");

    expect(result.model_files).toEqual([
      `${MODEL_FILE_REPO}prod/cache/test-name/1.0/model-file`,
      `${MODEL_FILE_REPO}prod/cache/test-name/1.0/prop-file`,
      `${MODEL_FILE_REPO}prod/cache/test-name/1.0/other-file`,
      `${MODEL_FILE_REPO}prod/cache/test-name/1.0/fourth-file`,
    ]);
  });

  it("should handle empty model-files array", () => {
    const dc: DataCommon = dataCommonFactory.build({
      name: "test-name",
      assets: manifestAssetsFactory.build({
        "current-version": "1.0",
        "model-files": [],
        "readme-file": "readme-file",
        "loading-file": "loading-file-zip-name",
      }),
    });

    const result = utils.buildAssetUrls(dc, "latest");

    expect(result.model_files).toEqual([]);
  });

  const readMeValues = ["", null, undefined, false];
  it.each(readMeValues)("should not include a README URL if the filename is %s", (readme) => {
    const dc: DataCommon = dataCommonFactory.build({
      name: "test-name",
      assets: manifestAssetsFactory.build({
        "current-version": "1.0",
        "model-files": ["model-file", "prop-file"],
        "readme-file": readme as unknown as string,
      }),
    });

    const result = utils.buildAssetUrls(dc, "latest");

    expect(result.readme).toEqual(null);
  });

  it("should use an empty string if model-navigator-logo is not defined", () => {
    const dc: DataCommon = dataCommonFactory.build({
      name: "test-name",
      assets: manifestAssetsFactory.build({
        "current-version": "1.0",
        "model-files": ["model-file", "prop-file"],
        "readme-file": "readme-file",
        "loading-file": "loading-file-zip-name",
        // "model-navigator-logo" - not defined, aka no logo
        "model-navigator-logo": undefined,
      }),
    });

    const result = utils.buildAssetUrls(dc, "latest");

    expect(result.navigator_icon).toEqual("");
  });

  it("should use an empty string if the model-navigator-logo is an empty string", () => {
    const dc: DataCommon = dataCommonFactory.build({
      name: "test-name",
      assets: manifestAssetsFactory.build({
        "current-version": "1.0",
        "model-files": ["model-file", "prop-file"],
        "readme-file": "readme-file",
        "loading-file": "loading-file-zip-name",
        "model-navigator-logo": "", // empty string - aka no logo
      }),
    });

    const result = utils.buildAssetUrls(dc, "latest");

    expect(result.navigator_icon).toEqual("");
  });

  it("should use model-navigator-logo if provided in the content manifest", () => {
    const dc: DataCommon = dataCommonFactory.build({
      name: "test-name",
      assets: manifestAssetsFactory.build({
        "current-version": "1.0",
        "model-files": ["model-file", "prop-file"],
        "readme-file": "readme-file",
        "loading-file": "loading-file-zip-name",
        "model-navigator-logo": "custom-logo.png", // defined - must exist
      }),
    });

    const result = utils.buildAssetUrls(dc, "latest");

    expect(result.navigator_icon).toEqual(
      `${MODEL_FILE_REPO}prod/cache/test-name/1.0/custom-logo.png`
    );
  });

  it("should not throw an exception if dealing with invalid data", () => {
    expect(() => utils.buildAssetUrls(null, "latest")).not.toThrow();
    expect(() => utils.buildAssetUrls({} as DataCommon, "latest")).not.toThrow();
    expect(() => utils.buildAssetUrls(undefined, "latest")).not.toThrow();
  });

  it("should not throw an exception if `model_files` is not defined", () => {
    const dc: DataCommon = dataCommonFactory.build({
      name: "test-name",
      assets: manifestAssetsFactory.build({
        "current-version": "1.0",
        "readme-file": "readme-file",
        "loading-file": "loading-file-zip-name",
      }),
    });

    expect(() => utils.buildAssetUrls(dc, "latest")).not.toThrow();
    expect(utils.buildAssetUrls(dc, "latest")).toEqual(
      expect.objectContaining({ model_files: [] })
    );
  });

  it("should use the provided modelVersion if it is not 'latest'", () => {
    const dc: DataCommon = dataCommonFactory.build({
      name: "test-name",
      assets: manifestAssetsFactory.build({
        "current-version": "1.0",
        "model-files": ["model-file", "prop-file"],
        "readme-file": "readme-file",
        "loading-file": "loading-file-zip-name",
      }),
    });

    const result = utils.buildAssetUrls(dc, "2.1");
    expect(result.model_files).toEqual([
      `${MODEL_FILE_REPO}prod/cache/test-name/2.1/model-file`,
      `${MODEL_FILE_REPO}prod/cache/test-name/2.1/prop-file`,
    ]);

    const result2 = utils.buildAssetUrls(dc, "1.0");
    expect(result2.model_files).toEqual([
      `${MODEL_FILE_REPO}prod/cache/test-name/1.0/model-file`,
      `${MODEL_FILE_REPO}prod/cache/test-name/1.0/prop-file`,
    ]);

    const result3 = utils.buildAssetUrls(dc, "latest");
    expect(result3.model_files).toEqual([
      `${MODEL_FILE_REPO}prod/cache/test-name/1.0/model-file`,
      `${MODEL_FILE_REPO}prod/cache/test-name/1.0/prop-file`,
    ]);
  });

  it("should use the changelog fallback 'version-history.md' if release-notes is not defined", () => {
    const dc: DataCommon = dataCommonFactory.build({
      name: "test-name",
      assets: manifestAssetsFactory.build({}),
    });

    const result = utils.buildAssetUrls(dc, "1.0.0");
    expect(result.changelog).toEqual(
      `${MODEL_FILE_REPO}prod/cache/test-name/1.0.0/version-history.md`
    );
  });

  it("should use the changelog filename provided if release-notes is defined", () => {
    const dc: DataCommon = dataCommonFactory.build({
      name: "test-name",
      assets: manifestAssetsFactory.build({
        "release-notes": "custom-release-notes.md",
      }),
    });

    const result = utils.buildAssetUrls(dc, "1.0.1");
    expect(result.changelog).toEqual(
      `${MODEL_FILE_REPO}prod/cache/test-name/1.0.1/custom-release-notes.md`
    );
  });
});

describe("buildBaseFilterContainers tests", () => {
  it("should return an empty object if dc is null or undefined", () => {
    const result = utils.buildBaseFilterContainers(null);
    expect(result).toEqual({});

    const result2 = utils.buildBaseFilterContainers(undefined);
    expect(result2).toEqual({});
  });

  it("should return an empty object if facetFilterSearchData is not an array or is an empty array", () => {
    const dc: ModelNavigatorConfig = modelNavigatorConfigFactory.build({
      facetFilterSearchData: null,
    });

    const result = utils.buildBaseFilterContainers(dc);
    expect(result).toEqual({});

    const dc2: ModelNavigatorConfig = modelNavigatorConfigFactory.build({
      facetFilterSearchData: [],
    });

    const result2 = utils.buildBaseFilterContainers(dc2);
    expect(result2).toEqual({});
  });

  it("should build filter containers correctly", () => {
    const dc: ModelNavigatorConfig = modelNavigatorConfigFactory.build({
      facetFilterSearchData: [
        { datafield: "field1" },
        { datafield: "field2" },
        { datafield: null },
      ] as FacetSearchData[],
    });

    const result = utils.buildBaseFilterContainers(dc);
    expect(result).toEqual({
      field1: [],
      field2: [],
      base: [],
    });
  });
});

describe("buildFilterOptionsList tests", () => {
  it("should return an empty array if dc is null or undefined", () => {
    const result = utils.buildFilterOptionsList(null);
    expect(result).toEqual([]);

    const result2 = utils.buildFilterOptionsList(undefined);
    expect(result2).toEqual([]);
  });

  it("should return an empty array if facetFilterSearchData is not an array or is an empty array", () => {
    const dc: ModelNavigatorConfig = modelNavigatorConfigFactory.build({
      facetFilterSearchData: null,
    });

    const result = utils.buildFilterOptionsList(dc);
    expect(result).toEqual([]);

    const dc2: ModelNavigatorConfig = modelNavigatorConfigFactory.build({
      facetFilterSearchData: [],
    });

    const result2 = utils.buildFilterOptionsList(dc2);
    expect(result2).toEqual([]);
  });

  it("should build filter options list correctly", () => {
    const dc: ModelNavigatorConfig = modelNavigatorConfigFactory.build({
      facetFilterSearchData: [
        { checkboxItems: [{ name: "Item 1" }, { name: "Item 2" }] },
        { checkboxItems: [{ name: "Item 3" }, { name: "Item 4" }] },
        { checkboxItems: null },
      ] as FacetSearchData[],
    });

    const result = utils.buildFilterOptionsList(dc);
    expect(result).toEqual(["item 1", "item 2", "item 3", "item 4"]);
  });
});

describe("extractModelProperties tests", () => {
  it.each<unknown>([null, undefined, {}])("should handle invalid input '%s' safely", (input) => {
    expect(() => utils.extractModelProperties(input as MDFDictionary)).not.toThrow();
    expect(utils.extractModelProperties(input as MDFDictionary)).toEqual([]);
  });

  it("should extract and deduplicate property names across all nodes", () => {
    const dictionary = modelDefinitionFactory.build({
      node1: modelDefinitionNodeFactory.build({
        properties: {
          property1: modelDefinitionNodePropertyFactory.build(),
          property2: modelDefinitionNodePropertyFactory.build(),
        },
      }),
      node2: modelDefinitionNodeFactory.build({
        properties: {
          property2: modelDefinitionNodePropertyFactory.build(),
          property3: modelDefinitionNodePropertyFactory.build(),
        },
      }),
    });

    const result = utils.extractModelProperties(dictionary);
    expect(result).toEqual(["property1", "property2", "property3"]);
  });

  it("should safely handle nodes without properties", () => {
    const dictionary = modelDefinitionFactory.build({
      node1: modelDefinitionNodeFactory.build({ properties: null }),
      node2: modelDefinitionNodeFactory.build({ properties: undefined }),
    });

    const result = utils.extractModelProperties(dictionary);
    expect(result).toEqual([]);
  });
});

describe("populatePermissibleValues tests", () => {
  const fallbackMessage =
    "Permissible values are currently not available. Please contact the CRDC Submission Portal HelpDesk at NCICRDCHelpDesk@mail.nih.gov";

  it.each<unknown>([null, undefined, {}])(
    "should handle invalid dictionary input '%s' safely",
    (input) => {
      expect(() =>
        utils.populatePermissibleValues(
          input as MDFDictionary,
          ["property1"],
          [] as RetrievePVsByPropertyNameResponse["retrievePVsByPropertyName"]
        )
      ).not.toThrow();
    }
  );

  it("should populate enums for matching properties", () => {
    const dictionary = modelDefinitionFactory.build({
      node1: modelDefinitionNodeFactory.build({
        properties: {
          property1: modelDefinitionNodePropertyFactory.build({ enum: ["old"] }),
          property2: modelDefinitionNodePropertyFactory.build({ enum: ["old2"] }),
        },
      }),
    });

    const apiData: RetrievePVsByPropertyNameResponse["retrievePVsByPropertyName"] = [
      { property: "property1", permissibleValues: ["new1", "new2"] },
      { property: "property2", permissibleValues: ["new3"] },
    ];

    utils.populatePermissibleValues(dictionary, ["property1", "property2"], apiData);

    expect(dictionary.node1.properties.property1.enum).toEqual(["new1", "new2"]);
    expect(dictionary.node1.properties.property2.enum).toEqual(["new3"]);
  });

  it("should convert enum property to string when permissible values are empty", () => {
    const dictionary = modelDefinitionFactory.build({
      node1: modelDefinitionNodeFactory.build({
        properties: {
          property1: modelDefinitionNodePropertyFactory.build({
            type: "enum",
            enum: ["old"],
          }),
        },
      }),
    });

    const apiData: RetrievePVsByPropertyNameResponse["retrievePVsByPropertyName"] = [
      { property: "property1", permissibleValues: [] },
    ];

    utils.populatePermissibleValues(dictionary, ["property1"], apiData);

    expect(dictionary.node1.properties.property1.enum).toBeUndefined();
    expect(dictionary.node1.properties.property1.type).toBe("string");
  });

  it("should set fallback enum and log error when no data is found for a property with an enum", () => {
    const loggerSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const dictionary = modelDefinitionFactory.build({
      node1: modelDefinitionNodeFactory.build({
        properties: {
          property1: modelDefinitionNodePropertyFactory.build({ enum: ["old"] }),
        },
      }),
    });

    utils.populatePermissibleValues(
      dictionary,
      ["property1"],
      [] as RetrievePVsByPropertyNameResponse["retrievePVsByPropertyName"]
    );

    expect(dictionary.node1.properties.property1.enum).toEqual([fallbackMessage]);
    expect(loggerSpy).not.toHaveBeenCalled();

    loggerSpy.mockRestore();
  });

  it("should leave properties without enums unchanged when no data is found", () => {
    const dictionary = modelDefinitionFactory.build({
      node1: modelDefinitionNodeFactory.build({
        properties: {
          property1: modelDefinitionNodePropertyFactory.build({
            type: "list",
            enum: undefined,
          }),
        },
      }),
    });

    utils.populatePermissibleValues(
      dictionary,
      ["property1"],
      [] as RetrievePVsByPropertyNameResponse["retrievePVsByPropertyName"]
    );

    expect(dictionary.node1.properties.property1.enum).toBeUndefined();
    expect(dictionary.node1.properties.property1.type).toBe("list");
  });

  it("should apply the same permissible values to matching property names across multiple nodes", () => {
    const dictionary = modelDefinitionFactory.build({
      node1: modelDefinitionNodeFactory.build({
        properties: {
          sharedProperty: modelDefinitionNodePropertyFactory.build({ enum: ["old"] }),
        },
      }),
      node2: modelDefinitionNodeFactory.build({
        properties: {
          sharedProperty: modelDefinitionNodePropertyFactory.build({ enum: ["old2"] }),
        },
      }),
    });

    const apiData: RetrievePVsByPropertyNameResponse["retrievePVsByPropertyName"] = [
      { property: "sharedProperty", permissibleValues: ["p1", "p2"] },
    ];

    utils.populatePermissibleValues(dictionary, ["sharedProperty"], apiData);

    expect(dictionary.node1.properties.sharedProperty.enum).toEqual(["p1", "p2"]);
    expect(dictionary.node2.properties.sharedProperty.enum).toEqual(["p1", "p2"]);
  });
});
