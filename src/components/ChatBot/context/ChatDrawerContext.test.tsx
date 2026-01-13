import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test-utils";

import * as useChatDrawerModule from "../hooks/useChatDrawer";

import { ChatConversationProvider } from "./ChatConversationContext";
import { ChatDrawerProvider, useChatDrawerContext } from "./ChatDrawerContext";

vi.mock("../hooks/useChatDrawer", () => ({
  useChatDrawer: vi.fn(),
}));

vi.mock("./ChatBotContext", () => ({
  useChatBotContext: vi.fn(() => ({
    isChatEnabled: true,
  })),
}));

const mockUseChatDrawer = vi.mocked(useChatDrawerModule.useChatDrawer);

type TestParentProps = {
  onRender?: (context: ReturnType<typeof useChatDrawerContext>) => void;
  children?: React.ReactNode;
};

const TestParent = ({ onRender, children }: TestParentProps) => {
  const context = useChatDrawerContext();

  if (onRender) {
    onRender(context);
  }

  return (
    <div>
      <div data-testid="is-open">{context.isOpen.toString()}</div>
      <div data-testid="is-dragging">{context.isDragging.toString()}</div>
      <div data-testid="is-expanded">{context.isExpanded.toString()}</div>
      <div data-testid="height-px">{context.heightPx}</div>
      <div data-testid="is-minimized">{context.isMinimized.toString()}</div>
      <div data-testid="is-fullscreen">{context.isFullscreen.toString()}</div>
      <div data-testid="is-confirming">{context.isConfirmingEndConversation.toString()}</div>
      <button type="button" data-testid="open-drawer" onClick={context.openDrawer}>
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
      <button type="button" data-testid="request-end" onClick={context.onRequestEndConversation}>
        Request End
      </button>
      <button type="button" data-testid="confirm-end" onClick={context.onConfirmEndConversation}>
        Confirm End
      </button>
      <button type="button" data-testid="cancel-end" onClick={context.onCancelEndConversation}>
        Cancel End
      </button>
      <button
        type="button"
        data-testid="begin-resize"
        onClick={(e) => context.onBeginResize(e as unknown as React.PointerEvent<HTMLDivElement>)}
      >
        Begin Resize
      </button>
      {children}
    </div>
  );
};

const defaultChatDrawerHook = {
  drawerRef: { current: null },
  isOpen: false,
  isDragging: false,
  isExpanded: true,
  drawerHeightPx: 600,
  drawerWidthPx: 384,
  openDrawer: vi.fn(),
  closeDrawer: vi.fn(),
  beginResize: vi.fn(),
  toggleExpand: vi.fn(),
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChatConversationProvider>
    <ChatDrawerProvider>{children}</ChatDrawerProvider>
  </ChatConversationProvider>
);

describe("ChatDrawerContext > ChatDrawerProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatDrawer.mockReturnValue(defaultChatDrawerHook);
  });
  it("should render children without crashing", () => {
    const { getByText } = render(
      <Wrapper>
        <div>Test Child</div>
      </Wrapper>
    );

    expect(getByText("Test Child")).toBeInTheDocument();
  });

  it("should provide default values from hooks", () => {
    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    expect(getByTestId("is-open")).toHaveTextContent("false");
    expect(getByTestId("is-dragging")).toHaveTextContent("false");
    expect(getByTestId("is-expanded")).toHaveTextContent("true");
    expect(getByTestId("height-px")).toHaveTextContent("600");
    expect(getByTestId("is-minimized")).toHaveTextContent("false");
    expect(getByTestId("is-fullscreen")).toHaveTextContent("false");
    expect(getByTestId("is-confirming")).toHaveTextContent("false");
  });

  it("should provide drawer state from useChatDrawer hook", () => {
    mockUseChatDrawer.mockReturnValue({
      ...defaultChatDrawerHook,
      isOpen: true,
      isDragging: true,
      isExpanded: false,
      drawerHeightPx: 800,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    expect(getByTestId("is-open")).toHaveTextContent("true");
    expect(getByTestId("is-dragging")).toHaveTextContent("true");
    expect(getByTestId("is-expanded")).toHaveTextContent("false");
    expect(getByTestId("height-px")).toHaveTextContent("800");
  });

  it("should call openDrawer from hook when handleOpenDrawer is called", () => {
    const openDrawer = vi.fn();
    mockUseChatDrawer.mockReturnValue({
      ...defaultChatDrawerHook,
      isOpen: false,
      openDrawer,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    const button = getByTestId("open-drawer");
    userEvent.click(button);

    expect(openDrawer).toHaveBeenCalled();
  });

  it("should not call openDrawer when already open", () => {
    const openDrawer = vi.fn();
    mockUseChatDrawer.mockReturnValue({
      ...defaultChatDrawerHook,
      isOpen: true,
      openDrawer,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    const button = getByTestId("open-drawer");
    userEvent.click(button);

    expect(openDrawer).not.toHaveBeenCalled();
  });

  it("should reset minimized and confirming state when opening drawer", async () => {
    const openDrawer = vi.fn();
    mockUseChatDrawer.mockReturnValue({
      ...defaultChatDrawerHook,
      isOpen: true,
      openDrawer,
    });

    const { getByTestId, rerender } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    const minimizeButton = getByTestId("minimize");
    const requestEndButton = getByTestId("request-end");

    userEvent.click(minimizeButton);
    userEvent.click(requestEndButton);

    await waitFor(() => {
      expect(getByTestId("is-minimized")).toHaveTextContent("true");
      expect(getByTestId("is-confirming")).toHaveTextContent("true");
    });

    mockUseChatDrawer.mockReturnValue({
      ...defaultChatDrawerHook,
      isOpen: false,
      openDrawer,
    });

    rerender(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    const openButton = getByTestId("open-drawer");
    userEvent.click(openButton);

    await waitFor(() => {
      expect(getByTestId("is-minimized")).toHaveTextContent("false");
      expect(getByTestId("is-confirming")).toHaveTextContent("false");
    });
  });

  it("should set isMinimized to true when onMinimize is called", async () => {
    mockUseChatDrawer.mockReturnValue({
      ...defaultChatDrawerHook,
      isOpen: true,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    expect(getByTestId("is-minimized")).toHaveTextContent("false");

    const button = getByTestId("minimize");
    userEvent.click(button);

    await waitFor(() => {
      expect(getByTestId("is-minimized")).toHaveTextContent("true");
    });
  });

  it("should not minimize when drawer is not open", () => {
    mockUseChatDrawer.mockReturnValue({
      ...defaultChatDrawerHook,
      isOpen: false,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    const button = getByTestId("minimize");
    userEvent.click(button);

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

  it("should restore page scrollbar when conversation ends", async () => {
    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    const toggleFullscreenButton = getByTestId("toggle-fullscreen");
    userEvent.click(toggleFullscreenButton);

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("true");
      expect(document.body.style.overflow).toBe("hidden");
    });

    const requestEndButton = getByTestId("request-end");
    userEvent.click(requestEndButton);

    const confirmEndButton = getByTestId("confirm-end");
    userEvent.click(confirmEndButton);

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

    const button = getByTestId("toggle-fullscreen");
    userEvent.click(button);

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    unmount();

    expect(document.body.style.overflow).toBe("");
  });

  it("should set isConfirmingEndConversation to true when onRequestEndConversation is called", async () => {
    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    expect(getByTestId("is-confirming")).toHaveTextContent("false");

    const button = getByTestId("request-end");
    userEvent.click(button);

    await waitFor(() => {
      expect(getByTestId("is-confirming")).toHaveTextContent("true");
    });
  });

  it("should set isConfirmingEndConversation to false when onCancelEndConversation is called", async () => {
    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    const requestButton = getByTestId("request-end");
    userEvent.click(requestButton);

    await waitFor(() => {
      expect(getByTestId("is-confirming")).toHaveTextContent("true");
    });

    const cancelButton = getByTestId("cancel-end");
    userEvent.click(cancelButton);

    await waitFor(() => {
      expect(getByTestId("is-confirming")).toHaveTextContent("false");
    });
  });

  it("should call endConversation and reset all state when onConfirmEndConversation is called", async () => {
    const closeDrawer = vi.fn();

    mockUseChatDrawer.mockReturnValue({
      ...defaultChatDrawerHook,
      closeDrawer,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    const toggleFullscreenButton = getByTestId("toggle-fullscreen");
    userEvent.click(toggleFullscreenButton);

    const requestEndButton = getByTestId("request-end");
    userEvent.click(requestEndButton);

    await waitFor(() => {
      expect(getByTestId("is-fullscreen")).toHaveTextContent("true");
      expect(getByTestId("is-confirming")).toHaveTextContent("true");
    });

    const confirmEndButton = getByTestId("confirm-end");
    userEvent.click(confirmEndButton);

    await waitFor(() => {
      expect(closeDrawer).toHaveBeenCalled();
      expect(getByTestId("is-confirming")).toHaveTextContent("false");
      expect(getByTestId("is-minimized")).toHaveTextContent("false");
      expect(getByTestId("is-fullscreen")).toHaveTextContent("false");
    });
  });

  it("should call beginResize when onBeginResize is called", () => {
    const beginResize = vi.fn();
    mockUseChatDrawer.mockReturnValue({
      ...defaultChatDrawerHook,
      beginResize,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    const button = getByTestId("begin-resize");
    userEvent.click(button);

    expect(beginResize).toHaveBeenCalled();
  });

  it("should call toggleExpand when onToggleExpand is called", () => {
    const toggleExpand = vi.fn();
    mockUseChatDrawer.mockReturnValue({
      ...defaultChatDrawerHook,
      toggleExpand,
    });

    const { getByTestId } = render(
      <Wrapper>
        <TestParent />
      </Wrapper>
    );

    const button = getByTestId("toggle-expand");
    userEvent.click(button);

    expect(toggleExpand).toHaveBeenCalled();
  });

  it("should provide drawerRef from hook", () => {
    const mockRef = { current: document.createElement("div") };
    let capturedRef: React.RefObject<HTMLElement> | null = null;

    mockUseChatDrawer.mockReturnValue({
      ...defaultChatDrawerHook,
      drawerRef: mockRef,
    });

    render(
      <Wrapper>
        <TestParent
          onRender={(context) => {
            capturedRef = context.drawerRef;
          }}
        />
      </Wrapper>
    );

    expect(capturedRef).toBe(mockRef);
  });
});

describe("ChatDrawerContext > useChatDrawerContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatDrawer.mockReturnValue(defaultChatDrawerHook);
  });
  it("should throw error when used outside provider", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestParent />);
    }).toThrow("useChatDrawerContext must be used within ChatDrawerProvider");

    consoleErrorSpy.mockRestore();
  });

  it("should return context value when used inside provider", () => {
    let capturedContext: ReturnType<typeof useChatDrawerContext> | null = null;

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
    expect(capturedContext).toHaveProperty("isOpen");
    expect(capturedContext).toHaveProperty("openDrawer");
    expect(capturedContext).toHaveProperty("drawerRef");
    expect(capturedContext).toHaveProperty("heightPx");
    expect(capturedContext).toHaveProperty("isDragging");
    expect(capturedContext).toHaveProperty("isExpanded");
    expect(capturedContext).toHaveProperty("isMinimized");
    expect(capturedContext).toHaveProperty("isFullscreen");
    expect(capturedContext).toHaveProperty("onBeginResize");
    expect(capturedContext).toHaveProperty("onToggleExpand");
    expect(capturedContext).toHaveProperty("onToggleFullscreen");
    expect(capturedContext).toHaveProperty("onMinimize");
    expect(capturedContext).toHaveProperty("isConfirmingEndConversation");
    expect(capturedContext).toHaveProperty("onRequestEndConversation");
    expect(capturedContext).toHaveProperty("onConfirmEndConversation");
    expect(capturedContext).toHaveProperty("onCancelEndConversation");
  });
});
