import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test-utils";

import { FloatingWindowProvider, useFloatingWindowContext } from "./FloatingWindowContext";
import * as useFloatingWindowModule from "./useFloatingWindow";

vi.mock("./useFloatingWindow", () => ({
  useFloatingWindow: vi.fn(),
}));

const mockUseFloatingWindow = vi.mocked(useFloatingWindowModule.useFloatingWindow);

const MOCK_CONFIG = {
  height: { collapsed: 368, min: 368 },
  width: { default: 400, min: 400, expanded: 420 },
};

const mockOnClose = vi.fn();

type TestParentProps = {
  onRender?: (context: ReturnType<typeof useFloatingWindowContext>) => void;
  children?: React.ReactNode;
};

const TestParent = ({ onRender, children }: TestParentProps) => {
  const context = useFloatingWindowContext();

  if (onRender) {
    onRender(context);
  }

  return (
    <div>
      <div data-testid="is-open">{context.isOpen.toString()}</div>
      <div data-testid="is-expanded">{context.isExpanded.toString()}</div>
      <div data-testid="height-px">{context.heightPx}</div>
      <div data-testid="is-minimized">{context.isMinimized.toString()}</div>
      <div data-testid="is-fullscreen">{context.isFullscreen.toString()}</div>
      <div data-testid="is-confirming">{context.isConfirmingClose.toString()}</div>
      <button type="button" data-testid="open-window" onClick={context.openWindow}>
        Open
      </button>
      <button type="button" data-testid="minimize" onClick={context.onMinimize}>
        Minimize
      </button>
      <button type="button" data-testid="toggle-fullscreen" onClick={context.onToggleFullscreen}>
        Toggle Fullscreen
      </button>
      <button type="button" data-testid="toggle-expand" onClick={context.onToggleExpand}>
        Toggle Expand
      </button>
      <button type="button" data-testid="request-close" onClick={context.onRequestClose}>
        Request Close
      </button>
      <button type="button" data-testid="confirm-close" onClick={context.onConfirmClose}>
        Confirm Close
      </button>
      <button type="button" data-testid="cancel-close" onClick={context.onCancelClose}>
        Cancel Close
      </button>
      {children}
    </div>
  );
};

const defaultHookResult = {
  drawerRef: { current: null },
  isOpen: false,
  isExpanded: true,
  drawerHeightPx: 600,
  drawerWidthPx: 384,
  drawerX: 0,
  drawerY: 0,
  openDrawer: vi.fn(),
  closeDrawer: vi.fn(),
  handleDragStop: vi.fn(),
  handleResizeStop: vi.fn(),
  toggleExpand: vi.fn(),
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <FloatingWindowProvider config={MOCK_CONFIG} confirmBeforeClose onClose={mockOnClose}>
    {children}
  </FloatingWindowProvider>
);

const NoConfirmWrapper = ({ children }: { children: React.ReactNode }) => (
  <FloatingWindowProvider config={MOCK_CONFIG} onClose={mockOnClose}>
    {children}
  </FloatingWindowProvider>
);

describe("FloatingWindowContext > FloatingWindowProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindow.mockReturnValue(defaultHookResult);
  });

  it("should render children without crashing", () => {
    const { getByText } = render(
      <Wrapper>
        <div>Test Child</div>
      </Wrapper>
    );

    expect(getByText("Test Child")).toBeInTheDocument();
  });

  it("should pass the config to useFloatingWindow", () => {
    render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    expect(mockUseFloatingWindow).toHaveBeenCalledWith(MOCK_CONFIG);
  });

  it("should provide default values from hooks", () => {
    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    expect(getByTestId("is-open")).toHaveTextContent("false");
    expect(getByTestId("is-expanded")).toHaveTextContent("true");
    expect(getByTestId("height-px")).toHaveTextContent("600");
    expect(getByTestId("is-minimized")).toHaveTextContent("false");
    expect(getByTestId("is-fullscreen")).toHaveTextContent("false");
    expect(getByTestId("is-confirming")).toHaveTextContent("false");
  });

  it("should provide window state from useFloatingWindow hook", () => {
    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      isOpen: true,
      isExpanded: false,
      drawerHeightPx: 800,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    expect(getByTestId("is-open")).toHaveTextContent("true");
    expect(getByTestId("is-expanded")).toHaveTextContent("false");
    expect(getByTestId("height-px")).toHaveTextContent("800");
  });

  it("should call openDrawer from hook when openWindow is called", () => {
    const openDrawer = vi.fn();
    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      isOpen: false,
      openDrawer,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("open-window"));

    expect(openDrawer).toHaveBeenCalled();
  });

  it("should not call openDrawer when already open", () => {
    const openDrawer = vi.fn();
    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      isOpen: true,
      openDrawer,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("open-window"));

    expect(openDrawer).not.toHaveBeenCalled();
  });

  it("should reset minimized and confirming state when opening window", async () => {
    const openDrawer = vi.fn();
    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      isOpen: true,
      openDrawer,
    });

    const { getByTestId, rerender } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("minimize"));
    userEvent.click(getByTestId("request-close"));

    await waitFor(() => {
      expect(getByTestId("is-minimized")).toHaveTextContent("true");
      expect(getByTestId("is-confirming")).toHaveTextContent("true");
    });

    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      isOpen: false,
      openDrawer,
    });

    rerender(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("open-window"));

    await waitFor(() => {
      expect(getByTestId("is-minimized")).toHaveTextContent("false");
      expect(getByTestId("is-confirming")).toHaveTextContent("false");
    });
  });

  it("should set isMinimized to true when onMinimize is called", async () => {
    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      isOpen: true,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    expect(getByTestId("is-minimized")).toHaveTextContent("false");

    userEvent.click(getByTestId("minimize"));

    await waitFor(() => {
      expect(getByTestId("is-minimized")).toHaveTextContent("true");
    });
  });

  it("should not minimize when window is not open", () => {
    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      isOpen: false,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("minimize"));

    expect(getByTestId("is-minimized")).toHaveTextContent("false");
  });

  it("should toggle fullscreen state", async () => {
    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    expect(getByTestId("is-fullscreen")).toHaveTextContent("false");

    const button = getByTestId("toggle-fullscreen");
    userEvent.click(button);

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("true");
    });

    userEvent.click(button);

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("false");
    });
  });

  it("should hide page scrollbar when fullscreen is enabled", async () => {
    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    expect(document.body.style.overflow).toBe("");

    const button = getByTestId("toggle-fullscreen");
    userEvent.click(button);

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("true");
      expect(document.body.style.overflow).toBe("hidden");
    });

    userEvent.click(button);

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("false");
      expect(document.body.style.overflow).toBe("");
    });
  });

  it("should restore page scrollbar when the window closes", async () => {
    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("toggle-fullscreen"));

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("true");
      expect(document.body.style.overflow).toBe("hidden");
    });

    userEvent.click(getByTestId("request-close"));
    userEvent.click(getByTestId("confirm-close"));

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("false");
      expect(document.body.style.overflow).toBe("");
    });
  });

  it("should hide page scrollbar when fullscreen enabled and restore when unmounted", async () => {
    const { getByTestId, unmount } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("toggle-fullscreen"));

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    unmount();

    expect(document.body.style.overflow).toBe("");
  });

  it("should set isConfirmingClose to true when onRequestClose is called", async () => {
    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    expect(getByTestId("is-confirming")).toHaveTextContent("false");

    userEvent.click(getByTestId("request-close"));

    await waitFor(() => {
      expect(getByTestId("is-confirming")).toHaveTextContent("true");
    });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("should set isConfirmingClose to false when onCancelClose is called", async () => {
    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("request-close"));

    await waitFor(() => {
      expect(getByTestId("is-confirming")).toHaveTextContent("true");
    });

    userEvent.click(getByTestId("cancel-close"));

    await waitFor(() => {
      expect(getByTestId("is-confirming")).toHaveTextContent("false");
    });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("should call onClose and reset all state when onConfirmClose is called", async () => {
    const closeDrawer = vi.fn();

    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      closeDrawer,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("toggle-fullscreen"));
    userEvent.click(getByTestId("request-close"));

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("true");
      expect(getByTestId("is-confirming")).toHaveTextContent("true");
    });

    userEvent.click(getByTestId("confirm-close"));

    await waitFor(() => {
      expect(closeDrawer).toHaveBeenCalled();
      expect(getByTestId("is-confirming")).toHaveTextContent("false");
      expect(getByTestId("is-minimized")).toHaveTextContent("false");
      expect(getByTestId("is-fullscreen")).toHaveTextContent("false");
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should close immediately when confirmBeforeClose is false", async () => {
    const closeDrawer = vi.fn();

    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      closeDrawer,
    });

    const { getByTestId } = render(
      <NoConfirmWrapper>
        <TestParent />
      </NoConfirmWrapper>
    );

    userEvent.click(getByTestId("request-close"));

    await waitFor(() => {
      expect(closeDrawer).toHaveBeenCalled();
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(getByTestId("is-confirming")).toHaveTextContent("false");
  });

  it("should not throw when onClose is not provided", async () => {
    const closeDrawer = vi.fn();

    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      closeDrawer,
    });

    const { getByTestId } = render(
      <FloatingWindowProvider config={MOCK_CONFIG}>
        <TestParent />
      </FloatingWindowProvider>
    );

    userEvent.click(getByTestId("request-close"));

    await waitFor(() => {
      expect(closeDrawer).toHaveBeenCalled();
    });
  });

  it("should call toggleExpand when onToggleExpand is called", () => {
    const toggleExpand = vi.fn();
    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      toggleExpand,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("toggle-expand"));

    expect(toggleExpand).toHaveBeenCalled();
  });

  it("should exit fullscreen when toggle expand is called while fullscreen and expanded", async () => {
    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      isOpen: true,
      isExpanded: true,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("toggle-fullscreen"));

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("true");
    });

    userEvent.click(getByTestId("toggle-expand"));

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("false");
    });
  });

  it("should exit fullscreen and toggle expand when toggle expand is called while fullscreen but not expanded", async () => {
    const toggleExpand = vi.fn();
    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      isOpen: true,
      isExpanded: false,
      toggleExpand,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    userEvent.click(getByTestId("toggle-fullscreen"));

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("true");
    });

    userEvent.click(getByTestId("toggle-expand"));

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("false");
    });
    expect(toggleExpand).toHaveBeenCalled();
  });

  it("should provide windowRef from hook", () => {
    const mockRef = { current: document.createElement("div") };
    let capturedRef: React.RefObject<HTMLElement> | null = null;

    mockUseFloatingWindow.mockReturnValue({
      ...defaultHookResult,
      drawerRef: mockRef,
    });

    render(
      <Wrapper>
        <TestParent
          onRender={(context) => {
            capturedRef = context.windowRef;
          }}
        />
      </Wrapper>
    );

    expect(capturedRef).toBe(mockRef);
  });
});

describe("FloatingWindowContext > useFloatingWindowContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindow.mockReturnValue(defaultHookResult);
  });

  it("should throw error when used outside provider", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestParent />);
    }).toThrow("useFloatingWindowContext must be used within FloatingWindowProvider");

    consoleErrorSpy.mockRestore();
  });

  it("should return context value when used inside provider", () => {
    let capturedContext: ReturnType<typeof useFloatingWindowContext> | null = null;

    render(
      <Wrapper>
        <TestParent
          onRender={(context) => {
            capturedContext = context;
          }}
        />
      </Wrapper>
    );

    expect(capturedContext).toBeDefined();
    expect(capturedContext).toHaveProperty("config", MOCK_CONFIG);
    expect(capturedContext).toHaveProperty("isOpen");
    expect(capturedContext).toHaveProperty("openWindow");
    expect(capturedContext).toHaveProperty("windowRef");
    expect(capturedContext).toHaveProperty("heightPx");
    expect(capturedContext).toHaveProperty("isExpanded");
    expect(capturedContext).toHaveProperty("isMinimized");
    expect(capturedContext).toHaveProperty("isFullscreen");
    expect(capturedContext).toHaveProperty("onDragStop");
    expect(capturedContext).toHaveProperty("onResizeStop");
    expect(capturedContext).toHaveProperty("onToggleExpand");
    expect(capturedContext).toHaveProperty("onToggleFullscreen");
    expect(capturedContext).toHaveProperty("onMinimize");
    expect(capturedContext).toHaveProperty("isConfirmingClose");
    expect(capturedContext).toHaveProperty("onRequestClose");
    expect(capturedContext).toHaveProperty("onConfirmClose");
    expect(capturedContext).toHaveProperty("onCancelClose");
  });
});
