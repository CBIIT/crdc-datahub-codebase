import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import * as FloatingWindowModule from "@/components/FloatingWindow";
import { render } from "@/test-utils";

import EndConversationConfirm from "./EndConversationConfirm";

vi.mock("@/components/FloatingWindow", () => ({
  useFloatingWindowContext: vi.fn(),
}));

const mockUseFloatingWindowContext = vi.mocked(FloatingWindowModule.useFloatingWindowContext);

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
    const { container } = render(<EndConversationConfirm />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should render the confirmation dialog", () => {
    const { getByRole, getByText } = render(<EndConversationConfirm />);

    expect(getByRole("alertdialog", { name: "End Conversation" })).toBeInTheDocument();
    expect(getByText("End Conversation")).toBeInTheDocument();
  });

  it("should call onConfirmClose when Yes is clicked", async () => {
    const { getByRole } = render(<EndConversationConfirm />);

    userEvent.click(getByRole("button", { name: "Yes" }));

    expect(mockOnConfirmClose).toHaveBeenCalledTimes(1);
    expect(mockOnCancelClose).not.toHaveBeenCalled();
  });

  it("should call onCancelClose when No is clicked", async () => {
    const { getByRole } = render(<EndConversationConfirm />);

    userEvent.click(getByRole("button", { name: "No" }));

    expect(mockOnCancelClose).toHaveBeenCalledTimes(1);
    expect(mockOnConfirmClose).not.toHaveBeenCalled();
  });

  it.each([
    { isExpanded: true, isFullscreen: false },
    { isExpanded: false, isFullscreen: true },
  ])(
    "should reflect the window state in data attributes (expanded: $isExpanded, fullscreen: $isFullscreen)",
    ({ isExpanded, isFullscreen }) => {
      mockUseFloatingWindowContext.mockReturnValue({
        ...defaultContext,
        isExpanded,
        isFullscreen,
      });

      const { getByRole } = render(<EndConversationConfirm />);

      const dialog = getByRole("alertdialog");
      expect(dialog).toHaveAttribute("data-expanded", String(isExpanded));
      expect(dialog).toHaveAttribute("data-fullscreen", String(isFullscreen));
    }
  );
});
