import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import FloatingWindowConfirm from "./FloatingWindowConfirm";
import * as FloatingWindowContextModule from "./FloatingWindowContext";

vi.mock("./FloatingWindowContext", () => ({
  useFloatingWindowContext: vi.fn(),
}));

const mockUseFloatingWindowContext = vi.mocked(
  FloatingWindowContextModule.useFloatingWindowContext
);

const mockOnConfirmClose = vi.fn();
const mockOnCancelClose = vi.fn();

const defaultContext = {
  config: {
    height: { collapsed: 368, min: 368 },
    width: { default: 400, min: 400, expanded: 420 },
  },
  windowRef: { current: null },
  heightPx: 600,
  widthPx: 384,
  x: 0,
  y: 0,
  isExpanded: false,
  isMinimized: false,
  isFullscreen: false,
  isOpen: true,
  onDragStop: vi.fn(),
  onResizeStop: vi.fn(),
  onToggleExpand: vi.fn(),
  onToggleFullscreen: vi.fn(),
  onMinimize: vi.fn(),
  openWindow: vi.fn(),
  isConfirmingClose: true,
  onRequestClose: vi.fn(),
  onConfirmClose: mockOnConfirmClose,
  onCancelClose: mockOnCancelClose,
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should have no accessibility violations", async () => {
    const { container } = render(<FloatingWindowConfirm title="Discard draft?" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should use the title as the dialog name", () => {
    const { getByRole, getByText } = render(<FloatingWindowConfirm title="Discard draft?" />);

    expect(getByRole("alertdialog", { name: "Discard draft?" })).toBeInTheDocument();
    expect(getByText("Discard draft?")).toBeInTheDocument();
  });

  it("should render the icon when provided", () => {
    const { getByTestId } = render(
      <FloatingWindowConfirm title="Confirm" icon={<span data-testid="confirm-icon" />} />
    );

    expect(getByTestId("confirm-icon")).toBeInTheDocument();
  });

  it("should default the button labels to Yes and No", () => {
    const { getByRole } = render(<FloatingWindowConfirm title="Confirm" />);

    expect(getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("should call onConfirmClose when the confirm button is clicked", async () => {
    const { getByRole } = render(
      <FloatingWindowConfirm title="Confirm" confirmLabel="Discard" cancelLabel="Keep" />
    );

    await userEvent.click(getByRole("button", { name: "Discard" }));

    expect(mockOnConfirmClose).toHaveBeenCalledTimes(1);
    expect(mockOnCancelClose).not.toHaveBeenCalled();
  });

  it("should call onCancelClose when the cancel button is clicked", async () => {
    const { getByRole } = render(
      <FloatingWindowConfirm title="Confirm" confirmLabel="Discard" cancelLabel="Keep" />
    );

    await userEvent.click(getByRole("button", { name: "Keep" }));

    expect(mockOnCancelClose).toHaveBeenCalledTimes(1);
    expect(mockOnConfirmClose).not.toHaveBeenCalled();
  });

  it.each([
    { isExpanded: true, isFullscreen: false },
    { isExpanded: false, isFullscreen: true },
  ])(
    "should reflect the window state in data attributes (expanded: $isExpanded, fullscreen: $isFullscreen)",
    ({ isExpanded, isFullscreen }) => {
      mockUseFloatingWindowContext.mockReturnValue({ ...defaultContext, isExpanded, isFullscreen });

      const { getByRole } = render(<FloatingWindowConfirm title="Confirm" />);

      const dialog = getByRole("alertdialog");
      expect(dialog).toHaveAttribute("data-expanded", String(isExpanded));
      expect(dialog).toHaveAttribute("data-fullscreen", String(isFullscreen));
    }
  );
});
