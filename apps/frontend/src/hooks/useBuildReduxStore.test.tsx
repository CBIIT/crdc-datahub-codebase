import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as dmn from "data-model-navigator";
import { vi } from "vitest";

import { RETRIEVE_CDEs, RetrieveCDEsInput, RetrieveCDEsResp } from "@/graphql";
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
    extractSupportedCDEs: vi.fn(),
    populateCDEData: vi.fn(),
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
    vi.mocked(utils.extractSupportedCDEs).mockReturnValue([]);
    vi.mocked(utils.populateCDEData).mockImplementation(() => {});
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
    const mockVersion = "1.0.0";
    const mockChangelog = "# Changelog\n\n- Feature 1";

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(mockChangelog);

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
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
  });

  it("should dispatch RECEIVE_CHANGELOG_INFO when changelog is successfully retrieved", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = "1.0.0";
    const mockChangelog = "# Changelog\n\n- Feature 1";

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(mockChangelog);

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
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
    const mockVersion = "1.0.0";

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(null);

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
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

  it("should retrieve and populate CDEs when supported CDEs are found", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = "1.0.0";
    const mockCDEs: CDEInfo[] = [
      { CDECode: "CDE001", CDEVersion: "1.0", CDEOrigin: "caDSR" },
      { CDECode: "CDE002", CDEVersion: "2.0", CDEOrigin: "caDSR" },
    ];

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(null);
    vi.mocked(utils.extractSupportedCDEs).mockReturnValue(mockCDEs);

    const mockCDEResponse: MockedResponse<RetrieveCDEsResp, RetrieveCDEsInput> = {
      request: {
        query: RETRIEVE_CDEs,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrieveCDEs: [
            {
              CDEFullName: "CDE 001 Full Name",
              CDECode: "CDE001",
              CDEVersion: "1.0",
              PermissibleValues: ["value1", "value2"],
            },
            {
              CDEFullName: "CDE 002 Full Name",
              CDECode: "CDE002",
              CDEVersion: "2.0",
              PermissibleValues: ["value3", "value4"],
            },
          ],
        },
      },
    };

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[mockCDEResponse]} addTypename={false}>
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

    expect(vi.mocked(utils.extractSupportedCDEs)).toHaveBeenCalledWith(mockDictionary);
    expect(vi.mocked(utils.populateCDEData)).toHaveBeenCalledWith(mockDictionary, [
      {
        CDEFullName: "CDE 001 Full Name",
        CDECode: "CDE001",
        CDEVersion: "1.0",
        PermissibleValues: ["value1", "value2"],
      },
      {
        CDEFullName: "CDE 002 Full Name",
        CDECode: "CDE002",
        CDEVersion: "2.0",
        PermissibleValues: ["value3", "value4"],
      },
    ]);
  });

  it("should handle CDE retrieval errors gracefully", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = "1.0.0";
    const mockCDEs: CDEInfo[] = [{ CDECode: "CDE001", CDEVersion: "1.0", CDEOrigin: "caDSR" }];

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(null);
    vi.mocked(utils.extractSupportedCDEs).mockReturnValue(mockCDEs);

    const mockCDEResponse: MockedResponse<RetrieveCDEsResp, RetrieveCDEsInput> = {
      request: {
        query: RETRIEVE_CDEs,
      },
      variableMatcher: () => true,
      error: new Error("CDE retrieval failed"),
    };

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[mockCDEResponse]} addTypename={false}>
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

    expect(vi.mocked(utils.populateCDEData)).toHaveBeenCalledWith(mockDictionary, []);
  });

  it("should not attempt CDE retrieval when no supported CDEs are found", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = "1.0.0";

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(null);
    vi.mocked(utils.extractSupportedCDEs).mockReturnValue([]);

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
    });

    const [, populateStore] = result.current;

    await act(async () => {
      populateStore(mockDataCommon, "1.0.0");
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe("success");
    });

    expect(vi.mocked(utils.extractSupportedCDEs)).toHaveBeenCalledWith(mockDictionary);
    expect(vi.mocked(utils.populateCDEData)).not.toHaveBeenCalled();
  });

  it("should dispatch all required actions when both changelog and model data succeed", async () => {
    const mockDictionary = { nodes: [], edges: [] };
    const mockVersion = "1.0.0";
    const mockChangelog = "# Changelog";

    vi.mocked(dmn.getModelExploreData).mockResolvedValue({
      data: mockDictionary,
      version: mockVersion,
    });
    vi.mocked(dmn.getChangelog).mockResolvedValue(mockChangelog);

    const { result } = renderHook(() => useBuildReduxStore(), {
      wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
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
