import { render } from "../../test-utils";

import ErrorBoundary from "./index";

const ThrowError = () => {
  throw new Error("Test Error");
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // The error is propagated to the console by default
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("should catch errors in its children and display a fallback UI", () => {
    const { getByTestId } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(getByTestId("error-boundary-alert")).toBeInTheDocument();
    expect(getByTestId("error-boundary-alert")).toHaveTextContent("Error loading component.");
  });

  it("should display the custom error message if provided", () => {
    const { getByTestId } = render(
      <ErrorBoundary errorMessage="Mock Error Message">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(getByTestId("error-boundary-alert")).toBeInTheDocument();
    expect(getByTestId("error-boundary-alert")).toHaveTextContent("Mock Error Message");
  });

  it("should render the children if no error occurs", () => {
    const { queryByTestId, getByTestId } = render(
      <ErrorBoundary>
        <div data-testid="child" />
      </ErrorBoundary>
    );

    expect(queryByTestId("error-boundary-alert")).not.toBeInTheDocument();
    expect(getByTestId("child")).toBeInTheDocument();
  });
});
