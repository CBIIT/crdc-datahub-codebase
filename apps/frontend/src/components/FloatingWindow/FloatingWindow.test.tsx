import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import FloatingWindow from "./FloatingWindow";
import * as FloatingWindowContextModule from "./FloatingWindowContext";

vi.mock("./FloatingWindowContext", () => ({
  useFloatingWindowContext: vi.fn(),
}));

const mockUseFloatingWindowContext = vi.mocked(
  FloatingWindowContextModule.useFloatingWindowContext
);

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
  isExpanded: true,
  isMinimized: false,
  isFullscreen: false,
  isOpen: true,
  onDragStop: vi.fn(),
  onResizeStop: vi.fn(),
  onToggleExpand: vi.fn(),
  onToggleFullscreen: vi.fn(),
  onMinimize: vi.fn(),
  openWindow: vi.fn(),
  isConfirmingClose: false,
  onRequestClose: vi.fn(),
  onConfirmClose: vi.fn(),
  onCancelClose: vi.fn(),
};

const confirmContent = (
  <div role="alertdialog" aria-label="Confirm close">
    Are you sure?
  </div>
);

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should have no accessibility violations", async () => {
    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations when minimized", async () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isMinimized: true,
    });

    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations in fullscreen", async () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isFullscreen: true,
    });

    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations with confirmation content", async () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isConfirmingClose: true,
    });

    const { container } = render(
      <FloatingWindow id="test-window" confirmCloseContent={confirmContent}>
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should render without crashing", () => {
    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(container).toBeTruthy();
  });

  it("should render children content", () => {
    const { getByText } = render(
      <FloatingWindow id="test-window">
        <div>Custom child content</div>
      </FloatingWindow>
    );

    expect(getByText("Custom child content")).toBeInTheDocument();
  });

  it("should apply the id to the window and derive the body id", () => {
    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(container.querySelector("#test-window")).toBeInTheDocument();
    expect(container.querySelector("#test-window-body")).toBeInTheDocument();
  });

  it("should show expand icon when collapsed", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isExpanded: false,
    });

    const { getByLabelText } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(getByLabelText("Expand window")).toBeInTheDocument();
  });

  it("should show collapse icon when expanded", () => {
    const { getByLabelText } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(getByLabelText("Collapse window")).toBeInTheDocument();
  });

  it("should use custom labels when provided", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isExpanded: false,
    });

    const { getByLabelText } = render(
      <FloatingWindow
        id="test-window"
        labels={{
          expand: "Expand chat drawer",
          minimize: "Minimize chat",
          close: "End conversation",
        }}
      >
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(getByLabelText("Expand chat drawer")).toBeInTheDocument();
    expect(getByLabelText("Minimize chat")).toBeInTheDocument();
    expect(getByLabelText("End conversation")).toBeInTheDocument();
    expect(getByLabelText("Enter full screen")).toBeInTheDocument();
  });

  it("should call onToggleExpand when expand button is clicked", () => {
    const onToggleExpand = vi.fn();
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      onToggleExpand,
    });

    const { getByLabelText } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    getByLabelText("Collapse window").click();

    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("should show expand button even in fullscreen", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isFullscreen: true,
      isExpanded: true,
    });

    const { getByLabelText } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(getByLabelText("Collapse window")).toBeInTheDocument();
  });

  it("should show fullscreen icon when not in fullscreen", () => {
    const { getByLabelText } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(getByLabelText("Enter full screen")).toBeInTheDocument();
  });

  it("should show exit fullscreen icon when in fullscreen", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isFullscreen: true,
    });

    const { getByLabelText } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(getByLabelText("Exit full screen")).toBeInTheDocument();
  });

  it("should call onToggleFullscreen when fullscreen button is clicked", () => {
    const onToggleFullscreen = vi.fn();
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      onToggleFullscreen,
    });

    const { getByLabelText } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    getByLabelText("Enter full screen").click();

    expect(onToggleFullscreen).toHaveBeenCalled();
  });

  it("should call onMinimize when minimize button is clicked", () => {
    const onMinimize = vi.fn();
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      onMinimize,
    });

    const { getByLabelText } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    getByLabelText("Minimize window").click();

    expect(onMinimize).toHaveBeenCalled();
  });

  it("should call onRequestClose when close button is clicked", () => {
    const onRequestClose = vi.fn();
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      onRequestClose,
    });

    const { getByLabelText } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    getByLabelText("Close window").click();

    expect(onRequestClose).toHaveBeenCalled();
  });

  it("should render confirmCloseContent when isConfirmingClose is true", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isConfirmingClose: true,
    });

    const { getByRole } = render(
      <FloatingWindow id="test-window" confirmCloseContent={confirmContent}>
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(getByRole("alertdialog", { name: "Confirm close" })).toBeInTheDocument();
  });

  it("should not render confirmCloseContent when isConfirmingClose is false", () => {
    const { queryByRole } = render(
      <FloatingWindow id="test-window" confirmCloseContent={confirmContent}>
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("should set aria-hidden to true when minimized", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isMinimized: true,
    });

    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("should set aria-hidden to false when not minimized", () => {
    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(container.querySelector('[aria-hidden="false"]')).toBeInTheDocument();
  });

  it("should apply data-minimized attribute when minimized", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isMinimized: true,
    });

    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(container.querySelector('[data-minimized="true"]')).toBeInTheDocument();
  });

  it("should apply data-fullscreen attribute when in fullscreen", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isFullscreen: true,
    });

    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(container.querySelector('[data-fullscreen="true"]')).toBeInTheDocument();
  });

  it("should render drag borders when collapsed", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isExpanded: false,
      isFullscreen: false,
      isMinimized: false,
    });

    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(container.querySelectorAll('[aria-label="Drag to move"]')).toHaveLength(4);
  });

  it("should not render drag borders when expanded", () => {
    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(container.querySelector('[aria-label="Drag to move"]')).not.toBeInTheDocument();
  });

  it("should not render drag borders when in fullscreen", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      ...defaultContext,
      isExpanded: false,
      isFullscreen: true,
      isMinimized: false,
    });

    const { container } = render(
      <FloatingWindow id="test-window">
        <div>Test content</div>
      </FloatingWindow>
    );

    expect(container.querySelector('[aria-label="Drag to move"]')).not.toBeInTheDocument();
  });
});
