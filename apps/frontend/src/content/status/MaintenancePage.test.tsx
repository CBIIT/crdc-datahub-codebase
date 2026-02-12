import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import MaintenancePage from "./MaintenancePage";

const mockUsePageTitle = vi.fn();
vi.mock("../../hooks/usePageTitle", () => ({
  __esModule: true,
  default: (...p) => mockUsePageTitle(...p),
}));

describe("Accessibility", () => {
  it("should not have any accessibility violations", async () => {
    const { container } = render(<MaintenancePage />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() => render(<MaintenancePage />)).not.toThrow();
  });
});

describe("Implementation Requirements", () => {
  it("should set the page title correctly", () => {
    render(<MaintenancePage />);
    expect(mockUsePageTitle).toHaveBeenCalledWith("Website Maintenance");
  });

  it("should display a user-friendly message", () => {
    const { getByText } = render(<MaintenancePage />);

    expect(getByText("Website Maintenance")).toBeInTheDocument();
    expect(
      getByText(
        "The CRDC Submission Portal site is currently undergoing scheduled maintenance. Please check back soon. We appreciate your patience."
      )
    ).toBeInTheDocument();
  });
});

describe("Snapshots", () => {
  it("should match the snapshot", () => {
    const { container } = render(<MaintenancePage />);

    expect(container).toMatchSnapshot();
  });
});
