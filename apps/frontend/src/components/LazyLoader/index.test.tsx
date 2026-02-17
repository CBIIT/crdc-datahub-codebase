import { FC, lazy } from "react";

import { render } from "../../test-utils";

import LazyLoader from "./index";

const MockComponent: FC = () => <div>Mock Component</div>;
const LazyMockComponent = lazy(() => Promise.resolve({ default: MockComponent }));

describe("Basic Functionality", () => {
  it("should render with the suspense fallback initially", async () => {
    const MockSuspenseLoader = () => <div data-testid="suspense-loader" />;
    const WrappedComponent = LazyLoader(LazyMockComponent, MockSuspenseLoader);

    const { findByTestId } = render(<WrappedComponent />);

    expect(await findByTestId("suspense-loader")).toBeInTheDocument();
  });

  it("should render the lazy-loaded component after loading", async () => {
    const WrappedComponent = LazyLoader(LazyMockComponent);

    const { findByText } = render(<WrappedComponent />);

    expect(await findByText("Mock Component")).toBeInTheDocument();
  });
});
