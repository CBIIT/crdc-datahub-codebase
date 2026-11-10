import { createStore } from "redux";

import { DataModelsContext, DataModelsStatus } from "@/components/Contexts/DataModelsContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { dataCommonFactory } from "@/factories/data-common/DataCommonFactory";
import { dataModelsCtxStateFactory } from "@/factories/data-common/DataModelsCtxStateFactory";
import { ReduxStoreResult } from "@/hooks/useBuildReduxStore";
import { render } from "@/test-utils";

import NavigatorView from "./NavigatorView";

vi.mock("data-model-navigator", () => ({
  ReduxDataDictionary: () => <div>MODEL NAVIGATOR</div>,
}));

const mockPopulate = vi.fn();
const mockUseBuildReduxStore = vi.fn<() => ReduxStoreResult>();
vi.mock("@/hooks/useBuildReduxStore", () => ({
  default: () => mockUseBuildReduxStore(),
}));

const visibleModel = dataCommonFactory.build({ name: "CDS", displayName: "GC" });
const hiddenModel = dataCommonFactory.build({
  name: "CCDI",
  displayName: "CCDI",
  isHidden: true,
});
const store = createStore(() => ({}));

const renderNavigator = (
  model: string,
  status: DataModelsStatus = "LOADED",
  models: DataCommon[] = [visibleModel, hiddenModel]
) =>
  render(
    <DataModelsContext.Provider value={dataModelsCtxStateFactory.build({ status, models })}>
      <ErrorBoundary>
        <NavigatorView model={model} version="1.0.0" />
      </ErrorBoundary>
    </DataModelsContext.Provider>
  );

describe("Basic Functionality", () => {
  beforeEach(() => {
    mockPopulate.mockClear();
    mockUseBuildReduxStore.mockReturnValue([{ status: "waiting", store }, mockPopulate]);
  });

  it("should populate the store with the model matching the display name and version", () => {
    const { getByRole } = renderNavigator("GC");

    expect(mockPopulate).toHaveBeenCalledWith(visibleModel, "1.0.0");
    expect(getByRole("progressbar")).toBeInTheDocument();
  });

  it("should wait for the manifest before populating the store", () => {
    const { getByRole } = renderNavigator("GC", "LOADING");

    expect(getByRole("progressbar")).toBeInTheDocument();
    expect(mockPopulate).not.toHaveBeenCalled();
  });

  it.each(["CDS", "unknown", "CCDI", "", null, undefined])(
    "should reject the unsupported or hidden model %p",
    (model) => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const { getByTestId } = renderNavigator(model);

        expect(getByTestId("error-boundary-alert")).toBeInTheDocument();
        expect(mockPopulate).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
    }
  );

  it("should show an error when no Data Models are available", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { getByTestId } = renderNavigator("GC", "LOADED", []);

      expect(getByTestId("error-boundary-alert")).toBeInTheDocument();
      expect(mockPopulate).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("should show a loader while the store is being built", () => {
    mockUseBuildReduxStore.mockReturnValue([{ status: "loading", store }, mockPopulate]);
    const { getByRole } = renderNavigator("GC");

    expect(getByRole("progressbar")).toBeInTheDocument();
    expect(mockPopulate).not.toHaveBeenCalled();
  });

  it("should render the navigator once the store has been built", () => {
    mockUseBuildReduxStore.mockReturnValue([{ status: "success", store }, mockPopulate]);
    const { getByText } = renderNavigator("GC");

    expect(getByText("MODEL NAVIGATOR")).toBeInTheDocument();
    expect(mockPopulate).not.toHaveBeenCalled();
  });

  it("should show an error when the store cannot be built", () => {
    mockUseBuildReduxStore.mockReturnValue([{ status: "error", store }, mockPopulate]);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { getByTestId } = renderNavigator("GC");

      expect(getByTestId("error-boundary-alert")).toBeInTheDocument();
      expect(mockPopulate).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
