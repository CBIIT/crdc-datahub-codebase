import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import ToolbarButton from "./ToolbarButton";

const MockIcon = () => <svg data-testid="mock-icon" />;

const defaultProps = {
  label: "Bold",
  tooltip: "Bold (Ctrl+B)",
  icon: MockIcon,
  onMouseDown: vi.fn(),
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should not have any accessibility violations", async () => {
    const { container } = render(<ToolbarButton {...defaultProps} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have any accessibility violations when disabled", async () => {
    const { container } = render(<ToolbarButton {...defaultProps} disabled />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", () => {
    const { getByRole } = render(<ToolbarButton {...defaultProps} />);

    expect(getByRole("button", { name: "Bold" })).toBeInTheDocument();
  });

  it("should render the provided icon", () => {
    const { getByTestId } = render(<ToolbarButton {...defaultProps} />);

    expect(getByTestId("mock-icon")).toBeInTheDocument();
  });

  it("should display the tooltip on hover", async () => {
    const { getByRole, findByRole } = render(<ToolbarButton {...defaultProps} />);

    userEvent.hover(getByRole("button", { name: "Bold" }));

    expect(await findByRole("tooltip")).toHaveTextContent("Bold (Ctrl+B)");
  });

  it("should call onMouseDown when clicked", async () => {
    const { getByRole } = render(<ToolbarButton {...defaultProps} />);

    userEvent.click(getByRole("button", { name: "Bold" }));

    expect(defaultProps.onMouseDown).toHaveBeenCalledTimes(1);
  });

  it("should not call onMouseDown when disabled", () => {
    const { getByRole } = render(<ToolbarButton {...defaultProps} disabled />);

    expect(getByRole("button", { name: "Bold" })).toBeDisabled();
    expect(defaultProps.onMouseDown).not.toHaveBeenCalled();
  });

  it("should set aria-pressed when pressed is true", () => {
    const { getByRole } = render(<ToolbarButton {...defaultProps} pressed />);

    expect(getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");
  });

  it("should set aria-pressed to false when pressed is false", () => {
    const { getByRole } = render(<ToolbarButton {...defaultProps} pressed={false} />);

    expect(getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "false");
  });
});
