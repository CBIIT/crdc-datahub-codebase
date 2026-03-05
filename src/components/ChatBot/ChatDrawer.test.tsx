import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import ChatDrawer from "./ChatDrawer";
import * as ChatBotContextModule from "./context/ChatBotContext";
import * as ChatDrawerContextModule from "./context/ChatDrawerContext";

vi.mock("./context/ChatBotContext", () => ({
  useChatBotContext: vi.fn(),
}));

vi.mock("./context/ChatDrawerContext", () => ({
  useChatDrawerContext: vi.fn(),
}));

const mockUseChatBotContext = vi.mocked(ChatBotContextModule.useChatBotContext);

const mockUseChatDrawerContext = vi.mocked(ChatDrawerContextModule.useChatDrawerContext);

const defaultChatBotContext = {
  title: "Test Chat",
  label: "Chat",
  knowledgeBaseUrl: "http://test.com",
  metadata: {},
};

const defaultChatDrawerContext = {
  drawerRef: { current: null },
  heightPx: 600,
  widthPx: 384,
  positionX: 0,
  positionY: 0,
  isDragging: false,
  isExpanded: true,
  isMinimized: false,
  isFullscreen: false,
  isOpen: true,
  onBeginResize: vi.fn(),
  onBeginMove: vi.fn(),
  onToggleExpand: vi.fn(),
  onToggleFullscreen: vi.fn(),
  onMinimize: vi.fn(),
  openDrawer: vi.fn(),
  isConfirmingEndConversation: false,
  onRequestEndConversation: vi.fn(),
  onConfirmEndConversation: vi.fn(),
  onCancelEndConversation: vi.fn(),
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatBotContext.mockReturnValue(defaultChatBotContext);
    mockUseChatDrawerContext.mockReturnValue(defaultChatDrawerContext);
  });

  it("should have no accessibility violations", async () => {
    mockUseChatBotContext.mockReturnValue(defaultChatBotContext);
    mockUseChatDrawerContext.mockReturnValue(defaultChatDrawerContext);

    const { container } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations when minimized", async () => {
    mockUseChatBotContext.mockReturnValue(defaultChatBotContext);
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isMinimized: true,
    });

    const { container } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations in fullscreen", async () => {
    mockUseChatBotContext.mockReturnValue(defaultChatBotContext);
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isFullscreen: true,
    });

    const { container } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations with confirmation dialog", async () => {
    mockUseChatBotContext.mockReturnValue(defaultChatBotContext);
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isConfirmingEndConversation: true,
    });

    const { container } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatBotContext.mockReturnValue(defaultChatBotContext);
    mockUseChatDrawerContext.mockReturnValue(defaultChatDrawerContext);
  });

  it("should render without crashing", () => {
    const { container } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(container).toBeTruthy();
  });

  it("should render children content", () => {
    const { getByText } = render(
      <ChatDrawer>
        <div>Custom child content</div>
      </ChatDrawer>
    );

    expect(getByText("Custom child content")).toBeInTheDocument();
  });

  it("should show expand icon when collapsed", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isExpanded: false,
    });

    const { getByLabelText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(getByLabelText("Expand chat drawer")).toBeInTheDocument();
  });

  it("should show collapse icon when expanded", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isExpanded: true,
    });

    const { getByLabelText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(getByLabelText("Collapse chat drawer")).toBeInTheDocument();
  });

  it("should call onToggleExpand when expand button is clicked", () => {
    const onToggleExpand = vi.fn();
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      onToggleExpand,
    });

    const { getByLabelText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    getByLabelText("Collapse chat drawer").click();

    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("should show expand button even in fullscreen", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isFullscreen: true,
      isExpanded: true,
    });

    const { getByLabelText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(getByLabelText("Collapse chat drawer")).toBeInTheDocument();
  });

  it("should show fullscreen icon when not in fullscreen", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isFullscreen: false,
    });

    const { getByLabelText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(getByLabelText("Enter full screen")).toBeInTheDocument();
  });

  it("should show exit fullscreen icon when in fullscreen", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isFullscreen: true,
    });

    const { getByLabelText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(getByLabelText("Exit full screen")).toBeInTheDocument();
  });

  it("should call onToggleFullscreen when fullscreen button is clicked", () => {
    const onToggleFullscreen = vi.fn();
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      onToggleFullscreen,
    });

    const { getByLabelText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    getByLabelText("Enter full screen").click();

    expect(onToggleFullscreen).toHaveBeenCalled();
  });

  it("should call onMinimize when minimize button is clicked", () => {
    const onMinimize = vi.fn();
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      onMinimize,
    });

    const { getByLabelText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    getByLabelText("Minimize chat").click();

    expect(onMinimize).toHaveBeenCalled();
  });

  it("should call onRequestEndConversation when close button is clicked", () => {
    const onRequestEndConversation = vi.fn();
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      onRequestEndConversation,
    });

    const { getByLabelText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    getByLabelText("End conversation").click();

    expect(onRequestEndConversation).toHaveBeenCalled();
  });

  it("should show confirmation dialog when isConfirmingEndConversation is true", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isConfirmingEndConversation: true,
    });

    const { getByRole, getByText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(getByRole("alertdialog")).toBeInTheDocument();
    expect(getByText("End Conversation")).toBeInTheDocument();
  });

  it("should hide confirmation dialog when isConfirmingEndConversation is false", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isConfirmingEndConversation: false,
    });

    const { queryByRole } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    expect(queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("should call onConfirmEndConversation when Yes button is clicked", () => {
    const onConfirmEndConversation = vi.fn();
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isConfirmingEndConversation: true,
      onConfirmEndConversation,
    });

    const { getByLabelText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    getByLabelText("Yes").click();

    expect(onConfirmEndConversation).toHaveBeenCalled();
  });

  it("should call onCancelEndConversation when No button is clicked", () => {
    const onCancelEndConversation = vi.fn();
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isConfirmingEndConversation: true,
      onCancelEndConversation,
    });

    const { getByLabelText } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    getByLabelText("No").click();

    expect(onCancelEndConversation).toHaveBeenCalled();
  });

  it("should set aria-hidden to true when minimized", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isMinimized: true,
    });

    const { container } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    const drawer = container.querySelector('[aria-hidden="true"]');
    expect(drawer).toBeInTheDocument();
  });

  it("should set aria-hidden to false when not minimized", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isMinimized: false,
    });

    const { container } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    const drawer = container.querySelector('[aria-hidden="false"]');
    expect(drawer).toBeInTheDocument();
  });

  it("should apply data-minimized attribute when minimized", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isMinimized: true,
    });

    const { container } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    const drawer = container.querySelector('[data-minimized="true"]');
    expect(drawer).toBeInTheDocument();
  });

  it("should apply data-fullscreen attribute when in fullscreen", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isFullscreen: true,
    });

    const { container } = render(
      <ChatDrawer>
        <div>Test content</div>
      </ChatDrawer>
    );

    const drawer = container.querySelector('[data-fullscreen="true"]');
    expect(drawer).toBeInTheDocument();
  });
});
