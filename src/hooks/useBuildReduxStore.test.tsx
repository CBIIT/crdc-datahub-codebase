import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as dmn from "data-model-navigator";
import { vi } from "vitest";

import {
  RETRIEVE_PVS_BY_PROPERTY_NAME,
  RetrievePVsByPropertyNameInput,
  RetrievePVsByPropertyNameResponse,
} from "@/graphql";
import * as utils from "@/utils";

import useBuildReduxStore from "./useBuildReduxStore";

// Mock the data-model-navigator module
vi.mock("data-model-navigator", () => ({
  ddgraph: (state = null) => state,
  moduleReducers: { submission: (state = null) => state },
  versionInfo: (state = null) => state,
  changelogInfo: (state = null) => state,
  iconMapInfo: (state = null) => state,
  getModelExploreData: vi.fn(),
  getChangelog: vi.fn(),
}));

// Mock the utils
vi.mock("@/utils", async () => {
  const actual = await vi.importActual<typeof import("@/utils")>("@/utils");
  return {
    ...actual,
    buildAssetUrls: vi.fn(),
    buildBaseFilterContainers: vi.fn(),
    buildFilterOptionsList: vi.fn(),
    extractModelProperties: vi.fn(),
    populatePermissibleValues: vi.fn(),
  };
});

const mockDataCommon = {
  name: "TestModel",
  displayName: "Test Model",
  assets: {
    "current-version": "1.0.0",
    "model-files": ["test.yaml"],
    "readme-file": "README.md",
    "release-notes": "version-history.md",
    "loading-file": "loading.txt",
    "model-navigator-logo": "logo.png",
    "model-navigator-config": {
      facetFilterSearchData: [],
      facetFilterSectionVariables: {},
      pdfConfig: {
        footnote: "Test Model",
      },
      pageTitle: "Test Model",
    },
  },
} as DataCommon;

describe("useBuildReduxStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(utils.buildAssetUrls).mockReturnValue({
      model_files: ["file1.yaml", "file2.yaml"],
      readme: "readme.md",
      loading_file: "loading.txt",
      navigator_icon: "icon.png",
      changelog: "version-history.md",
    });

    vi.mocked(utils.buildBaseFilterContainers).mockReturnValue({});
    vi.mocked(utils.buildFilterOptionsList).mockReturnValue([]);
    vi.mocked(utils.extractModelProperties).mockReturnValue([]);
    vi.mocked(utils.populatePermissibleValues).mockImplementation(() => {});
  });

  it("should initialize with status 'waiting'", () => {
    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
    });

    expect(result.current[0].status).toBe("waiting");
    expect(result.current[0].store).toBeDefined();
  });

  it("should set status to 'error' when datacommon is missing required fields", async () => {
    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
    });

    const [, populateStore] = result.current;

    const invalidDataCommon = {
      ...mockDataCommon,
      name: null,
    } as unknown as DataCommon;

    await act(async () => {
      populateStore(invalidDataCommon, "1.0.0");
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe("error");
    });
  });

  it("should set status to 'error' when getModelExploreData returns null", async () => {
    vi.mocked(dmn.getModelExploreData).mockResolvedValue(null);
    vi.mocked(dmn.getChangelog).mockResolvedValue("# Changelog");

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
    });

    const [, populateStore] = result.current;

    await act(async () => {
      populateStore(mockDataCommon, "1.0.0");
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe("error");
    });
  });

  it("should successfully populate store when all data is valid", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = { model: "1.0.0" };
    const mockChangelog = "# Changelog\n\n- Feature 1";
    const mockPVs = [
      { property: "property1", permissibleValues: ["value1", "value2"] },
      { property: "property2", permissibleValues: ["value3", "value4"] },
    ];

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(mockChangelog);
    vi.mocked(utils.extractModelProperties).mockReturnValue(["property1", "property2"]);

    const mockPVResponse: MockedResponse<
      RetrievePVsByPropertyNameResponse,
      RetrievePVsByPropertyNameInput
    > = {
      request: {
        query: RETRIEVE_PVS_BY_PROPERTY_NAME,
      },
      variableMatcher: (variables) => {
        expect(variables).toEqual({
          modelName: "TestModel",
          modelVersion: "1.0.0",
          propertyNames: ["property1", "property2"],
        });
        return true;
      },
      result: {
        data: {
          retrievePVsByPropertyName: mockPVs,
        },
      },
    };

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[mockPVResponse]} addTypename={false}>
          {children}
        </MockedProvider>
      ),
    });

    const [, populateStore] = result.current;

    await act(async () => {
      populateStore(mockDataCommon, "1.0.0");
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe("success");
    });

    expect(vi.mocked(dmn.getModelExploreData)).toHaveBeenCalled();
    expect(vi.mocked(dmn.getChangelog)).toHaveBeenCalled();
    expect(vi.mocked(utils.extractModelProperties)).toHaveBeenCalledWith(mockDictionary);
    expect(vi.mocked(utils.populatePermissibleValues)).toHaveBeenCalledWith(
      mockDictionary,
      ["property1", "property2"],
      mockPVs
    );
  });

  it("should dispatch RECEIVE_CHANGELOG_INFO when changelog is successfully retrieved", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = { model: "1.0.0" };
    const mockChangelog = "# Changelog\n\n- Feature 1";
    const mockPVResponse: MockedResponse<
      RetrievePVsByPropertyNameResponse,
      RetrievePVsByPropertyNameInput
    > = {
      request: {
        query: RETRIEVE_PVS_BY_PROPERTY_NAME,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrievePVsByPropertyName: [{ property: "property1", permissibleValues: ["value1"] }],
        },
      },
    };

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(mockChangelog);
    vi.mocked(utils.extractModelProperties).mockReturnValue(["property1"]);

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[mockPVResponse]} addTypename={false}>
          {children}
        </MockedProvider>
      ),
    });

    const [{ store }, populateStore] = result.current;
    const dispatchSpy = vi.spyOn(store, "dispatch");

    await act(async () => {
      populateStore(mockDataCommon, "1.0.0");
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe("success");
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RECEIVE_CHANGELOG_INFO",
        data: {
          changelogMD: mockChangelog,
          changelogTabName: "Version History",
        },
      })
    );
  });

  it("should not dispatch RECEIVE_CHANGELOG_INFO when changelog retrieval fails", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = { model: "1.0.0" };
    const mockPVResponse: MockedResponse<
      RetrievePVsByPropertyNameResponse,
      RetrievePVsByPropertyNameInput
    > = {
      request: {
        query: RETRIEVE_PVS_BY_PROPERTY_NAME,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrievePVsByPropertyName: [{ property: "property1", permissibleValues: ["value1"] }],
        },
      },
    };

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(null);
    vi.mocked(utils.extractModelProperties).mockReturnValue(["property1"]);

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[mockPVResponse]} addTypename={false}>
          {children}
        </MockedProvider>
      ),
    });

    const [{ store }, populateStore] = result.current;
    const dispatchSpy = vi.spyOn(store, "dispatch");

    await act(async () => {
      populateStore(mockDataCommon, "1.0.0");
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe("success");
    });

    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RECEIVE_CHANGELOG_INFO",
      })
    );
  });

  it("should retrieve and populate permissible values from the property query", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = { model: "1.0.0" };
    const mockProperties = ["property1", "property2"];
    const mockPVs = [
      { property: "property1", permissibleValues: ["value1", "value2"] },
      { property: "property2", permissibleValues: ["value3", "value4"] },
    ];

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(null);
    vi.mocked(utils.extractModelProperties).mockReturnValue(mockProperties);

    const mockPVResponse: MockedResponse<
      RetrievePVsByPropertyNameResponse,
      RetrievePVsByPropertyNameInput
    > = {
      request: {
        query: RETRIEVE_PVS_BY_PROPERTY_NAME,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrievePVsByPropertyName: mockPVs,
        },
      },
    };

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[mockPVResponse]} addTypename={false}>
          {children}
        </MockedProvider>
      ),
    });

    const [, populateStore] = result.current;

    await act(async () => {
      populateStore(mockDataCommon, "1.0.0");
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe("success");
    });

    expect(vi.mocked(utils.extractModelProperties)).toHaveBeenCalledWith(mockDictionary);
    expect(vi.mocked(utils.populatePermissibleValues)).toHaveBeenCalledWith(
      mockDictionary,
      mockProperties,
      mockPVs
    );
  });

  it("should handle permissible value retrieval errors gracefully", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = { model: "1.0.0" };
    const mockProperties = ["property1"];

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(null);
    vi.mocked(utils.extractModelProperties).mockReturnValue(mockProperties);

    const mockPVResponse: MockedResponse<
      RetrievePVsByPropertyNameResponse,
      RetrievePVsByPropertyNameInput
    > = {
      request: {
        query: RETRIEVE_PVS_BY_PROPERTY_NAME,
      },
      variableMatcher: () => true,
      error: new Error("PV retrieval failed"),
    };

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[mockPVResponse]} addTypename={false}>
          {children}
        </MockedProvider>
      ),
    });

    const [, populateStore] = result.current;

    await act(async () => {
      populateStore(mockDataCommon, "1.0.0");
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe("success");
    });

    expect(vi.mocked(utils.populatePermissibleValues)).toHaveBeenCalledWith(
      mockDictionary,
      mockProperties,
      []
    );
  });

  it("should fall back to empty permissible values when API returns no data", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = { model: "1.0.0" };
    const mockProperties = ["property1"];

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(null);
    vi.mocked(utils.extractModelProperties).mockReturnValue(mockProperties);

    const mockPVResponse: MockedResponse<
      RetrievePVsByPropertyNameResponse,
      RetrievePVsByPropertyNameInput
    > = {
      request: {
        query: RETRIEVE_PVS_BY_PROPERTY_NAME,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrievePVsByPropertyName: [],
        },
      },
    };

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[mockPVResponse]} addTypename={false}>
          {children}
        </MockedProvider>
      ),
    });

    const [, populateStore] = result.current;

    await act(async () => {
      populateStore(mockDataCommon, "1.0.0");
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe("success");
    });

    expect(vi.mocked(utils.extractModelProperties)).toHaveBeenCalledWith(mockDictionary);
    expect(vi.mocked(utils.populatePermissibleValues)).toHaveBeenCalledWith(
      mockDictionary,
      mockProperties,
      []
    );
  });

  it("should dispatch all required actions when both changelog and model data succeed", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = { model: "1.0.0" };
    const mockChangelog = "# Changelog";
    const mockPVResponse: MockedResponse<
      RetrievePVsByPropertyNameResponse,
      RetrievePVsByPropertyNameInput
    > = {
      request: {
        query: RETRIEVE_PVS_BY_PROPERTY_NAME,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrievePVsByPropertyName: [{ property: "property1", permissibleValues: ["value1"] }],
        },
      },
    };

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(mockChangelog);
    vi.mocked(utils.extractModelProperties).mockReturnValue(["property1"]);

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[mockPVResponse]} addTypename={false}>
          {children}
        </MockedProvider>
      ),
    });

    const [{ store }, populateStore] = result.current;
    const dispatchSpy = vi.spyOn(store, "dispatch");

    await act(async () => {
      populateStore(mockDataCommon, "1.0.0");
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe("success");
    });

    // Verify version info dispatch
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: "RECEIVE_VERSION_INFO",
      data: mockVersion,
    });

    // Verify dictionary dispatch
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RECEIVE_DICTIONARY",
      })
    );

    // Verify graph dictionary dispatch
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "REACT_FLOW_GRAPH_DICTIONARY",
      })
    );

    // Verify changelog dispatch
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RECEIVE_CHANGELOG_INFO",
      })
    );

    // Verify search clear history dispatch
    expect(dispatchSpy).toHaveBeenCalledWith({ type: "SEARCH_CLEAR_HISTORY" });
  });
});
