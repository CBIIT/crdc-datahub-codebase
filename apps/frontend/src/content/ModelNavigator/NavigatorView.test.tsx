import { FC } from "react";
import { createStore } from "redux";

import { DataModelsContext, DataModelsCtxState } from "@/components/Contexts/DataModelsContext";
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

type ParentProps = {
  dataModelsCtxState?: Partial<DataModelsCtxState>;
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ dataModelsCtxState = {}, children }: ParentProps) => (
  <DataModelsContext.Provider
    value={dataModelsCtxStateFactory.build({
      models: [visibleModel, hiddenModel],
      ...dataModelsCtxState,
    })}
  >
    <ErrorBoundary>{children}</ErrorBoundary>
  </DataModelsContext.Provider>
);

describe("Basic Functionality", () => {
  beforeEach(() => {
    mockPopulate.mockClear();
    mockUseBuildReduxStore.mockReturnValue([{ status: "waiting", store }, mockPopulate]);
  });

  it("should populate the store with the model matching the display name and version", () => {
    const { getByRole } = render(<NavigatorView model="GC" version="1.0.0" />, {
      wrapper: TestParent,
    });

    expect(mockPopulate).toHaveBeenCalledWith(visibleModel, "1.0.0");
    expect(getByRole("progressbar")).toBeInTheDocument();
  });

  it("should wait for the manifest before populating the store", () => {
    const { getByRole } = render(<NavigatorView model="GC" version="1.0.0" />, {
      wrapper: ({ children }) => (
        <TestParent dataModelsCtxState={{ status: "LOADING", isRefreshing: true, models: [] }}>
          {children}
        </TestParent>
      ),
    });

    expect(getByRole("progressbar")).toBeInTheDocument();
    expect(mockPopulate).not.toHaveBeenCalled();
  });

  it("should populate the store from the refreshed manifest instead of the cached one", () => {
    const refreshedModel = dataCommonFactory.build({ name: "CDS", displayName: "GC" });
    const { getByRole, rerender } = render(
      <TestParent dataModelsCtxState={{ isRefreshing: true }}>
        <NavigatorView model="GC" version="1.0.0" />
      </TestParent>
    );

    expect(getByRole("progressbar")).toBeInTheDocument();
    expect(mockPopulate).not.toHaveBeenCalled();

    rerender(
      <TestParent dataModelsCtxState={{ models: [refreshedModel] }}>
        <NavigatorView model="GC" version="1.0.0" />
      </TestParent>
    );

    expect(mockPopulate).toHaveBeenCalledOnce();
    expect(mockPopulate).toHaveBeenCalledWith(refreshedModel, "1.0.0");
  });

  it("should not reject a model missing from the cached manifest while it is refreshing", () => {
    const { getByRole, queryByTestId, rerender } = render(
      <TestParent dataModelsCtxState={{ isRefreshing: true, models: [hiddenModel] }}>
        <NavigatorView model="GC" version="1.0.0" />
      </TestParent>
    );

    expect(getByRole("progressbar")).toBeInTheDocument();
    expect(queryByTestId("error-boundary-alert")).not.toBeInTheDocument();

    rerender(
      <TestParent>
        <NavigatorView model="GC" version="1.0.0" />
      </TestParent>
    );

    expect(queryByTestId("error-boundary-alert")).not.toBeInTheDocument();
    expect(mockPopulate).toHaveBeenCalledWith(visibleModel, "1.0.0");
  });

  it.each(["CDS", "unknown", "CCDI", "", null, undefined])(
    "should reject the unsupported or hidden model %p",
    (model) => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const { getByTestId } = render(<NavigatorView model={model} version="1.0.0" />, {
          wrapper: TestParent,
        });

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
      const { getByTestId } = render(<NavigatorView model="GC" version="1.0.0" />, {
        wrapper: ({ children }) => (
          <TestParent dataModelsCtxState={{ models: [] }}>{children}</TestParent>
        ),
      });

      expect(getByTestId("error-boundary-alert")).toBeInTheDocument();
      expect(mockPopulate).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("should show a loader while the store is being built", () => {
    mockUseBuildReduxStore.mockReturnValue([{ status: "loading", store }, mockPopulate]);
    const { getByRole } = render(<NavigatorView model="GC" version="1.0.0" />, {
      wrapper: TestParent,
    });

    expect(getByRole("progressbar")).toBeInTheDocument();
    expect(mockPopulate).not.toHaveBeenCalled();
  });

  it("should render the navigator once the store has been built", () => {
    mockUseBuildReduxStore.mockReturnValue([{ status: "success", store }, mockPopulate]);
    const { getByText } = render(<NavigatorView model="GC" version="1.0.0" />, {
      wrapper: TestParent,
    });

    expect(getByText("MODEL NAVIGATOR")).toBeInTheDocument();
    expect(mockPopulate).not.toHaveBeenCalled();
  });

  it("should show an error when the store cannot be built", () => {
    mockUseBuildReduxStore.mockReturnValue([{ status: "error", store }, mockPopulate]);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { getByTestId } = render(<NavigatorView model="GC" version="1.0.0" />, {
        wrapper: TestParent,
      });

      expect(getByTestId("error-boundary-alert")).toBeInTheDocument();
      expect(mockPopulate).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
