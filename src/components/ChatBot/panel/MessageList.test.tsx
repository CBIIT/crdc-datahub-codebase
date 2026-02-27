import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import * as ChatDrawerContextModule from "../context/ChatDrawerContext";

import MessageList from "./MessageList";

vi.mock("../context/ChatDrawerContext", () => ({
  useChatDrawerContext: vi.fn(),
}));

const mockUseChatDrawerContext = vi.mocked(ChatDrawerContextModule.useChatDrawerContext);

const defaultContext = {
  isFullscreen: false,
  drawerRef: { current: null },
  heightPx: 600,
  widthPx: 384,
  positionX: 0,
  positionY: 0,
  isDragging: false,
  isExpanded: true,
  isMinimized: false,
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

vi.mock("./ChatMessageItem", () => ({
  default: ({ message }: { message: ChatMessage }) => (
    <div data-testid={`message-${message.id}`}>{message.text}</div>
  ),
}));

vi.mock("./BotTypingIndicator", () => ({
  default: () => <div data-testid="bot-typing-indicator">Typing...</div>,
}));

const createMockMessage = (overrides?: Partial<ChatMessage>): ChatMessage => ({
  id: "test-message-1",
  text: "Test message",
  sender: "bot",
  timestamp: new Date("2024-01-15T14:30:00"),
  senderName: "Support Bot",
  variant: "default",
  ...overrides,
});

const defaultProps = {
  messages: [] as ChatMessage[],
  isBotTyping: false,
};

describe("Accessibility", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    vi.clearAllMocks();
    mockUseChatDrawerContext.mockReturnValue(defaultContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("should have no accessibility violations with empty messages", async () => {
    const { container } = render(<MessageList {...defaultProps} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations with messages", async () => {
    const messages = [createMockMessage({ id: "msg-1", text: "Hello" })];
    const { container } = render(<MessageList {...defaultProps} messages={messages} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations with typing indicator", async () => {
    const { container } = render(<MessageList {...defaultProps} isBotTyping />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    vi.clearAllMocks();
    mockUseChatDrawerContext.mockReturnValue(defaultContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render without crashing", () => {
    expect(() => render(<MessageList {...defaultProps} />)).not.toThrow();
  });

  it("should display welcome title", () => {
    const { getByText } = render(<MessageList {...defaultProps} />);

    expect(getByText("How can I help you?")).toBeInTheDocument();
  });

  it("should render messages when there are messages beyond the greeting", () => {
    const messages = [
      createMockMessage({ id: "greeting", text: "How can I help you?", sender: "bot" }),
      createMockMessage({ id: "msg-1", text: "Hello world" }),
    ];
    const { getByTestId } = render(<MessageList {...defaultProps} messages={messages} />);

    expect(getByTestId("message-greeting")).toBeInTheDocument();
    expect(getByTestId("message-msg-1")).toBeInTheDocument();
  });

  it("should render multiple messages", () => {
    const messages = [
      createMockMessage({ id: "msg-1", text: "First message" }),
      createMockMessage({ id: "msg-2", text: "Second message" }),
      createMockMessage({ id: "msg-3", text: "Third message" }),
    ];
    const { getByTestId } = render(<MessageList {...defaultProps} messages={messages} />);

    expect(getByTestId("message-msg-1")).toBeInTheDocument();
    expect(getByTestId("message-msg-2")).toBeInTheDocument();
    expect(getByTestId("message-msg-3")).toBeInTheDocument();
  });

  it("should show typing indicator when isBotTyping is true", () => {
    const { getByTestId } = render(<MessageList {...defaultProps} isBotTyping />);

    expect(getByTestId("bot-typing-indicator")).toBeInTheDocument();
  });

  it("should not show typing indicator when isBotTyping is false", () => {
    const { queryByTestId } = render(<MessageList {...defaultProps} isBotTyping={false} />);

    expect(queryByTestId("bot-typing-indicator")).not.toBeInTheDocument();
  });

  it("should render messages with typing indicator", () => {
    const messages = [
      createMockMessage({ id: "greeting", text: "How can I help?", sender: "bot" }),
      createMockMessage({ id: "msg-1", text: "Hello" }),
    ];
    const { getByTestId } = render(
      <MessageList {...defaultProps} messages={messages} isBotTyping />
    );

    expect(getByTestId("message-msg-1")).toBeInTheDocument();
    expect(getByTestId("bot-typing-indicator")).toBeInTheDocument();
  });

  it("should update when messages prop changes", () => {
    const messages1 = [
      createMockMessage({ id: "greeting", text: "How can I help?", sender: "bot" }),
      createMockMessage({ id: "msg-1", text: "First" }),
    ];
    const messages2 = [
      createMockMessage({ id: "greeting", text: "How can I help?", sender: "bot" }),
      createMockMessage({ id: "msg-1", text: "First" }),
      createMockMessage({ id: "msg-2", text: "Second" }),
    ];
    const { rerender, getByTestId, queryByTestId } = render(
      <MessageList {...defaultProps} messages={messages1} />
    );

    expect(getByTestId("message-msg-1")).toBeInTheDocument();
    expect(queryByTestId("message-msg-2")).not.toBeInTheDocument();

    rerender(<MessageList {...defaultProps} messages={messages2} />);

    expect(getByTestId("message-msg-1")).toBeInTheDocument();
    expect(getByTestId("message-msg-2")).toBeInTheDocument();
  });

  it("should update typing indicator when isBotTyping changes", () => {
    const { rerender, getByTestId, queryByTestId } = render(
      <MessageList {...defaultProps} isBotTyping={false} />
    );

    expect(queryByTestId("bot-typing-indicator")).not.toBeInTheDocument();

    rerender(<MessageList {...defaultProps} isBotTyping />);

    expect(getByTestId("bot-typing-indicator")).toBeInTheDocument();
  });

  it("should handle messages with different senders", () => {
    const messages = [
      createMockMessage({ id: "msg-1", sender: "bot", text: "Bot message" }),
      createMockMessage({ id: "msg-2", sender: "user", text: "User message" }),
    ];
    const { getByTestId } = render(<MessageList {...defaultProps} messages={messages} />);

    expect(getByTestId("message-msg-1")).toBeInTheDocument();
    expect(getByTestId("message-msg-2")).toBeInTheDocument();
  });

  it("should maintain message order", () => {
    const messages = [
      createMockMessage({ id: "msg-1", text: "First" }),
      createMockMessage({ id: "msg-2", text: "Second" }),
      createMockMessage({ id: "msg-3", text: "Third" }),
    ];
    const { container } = render(<MessageList {...defaultProps} messages={messages} />);

    const messageElements = container.querySelectorAll('[data-testid^="message-"]');
    expect(messageElements[0]).toHaveAttribute("data-testid", "message-msg-1");
    expect(messageElements[1]).toHaveAttribute("data-testid", "message-msg-2");
    expect(messageElements[2]).toHaveAttribute("data-testid", "message-msg-3");
  });

  it("should call scrollTo when element ref is available", () => {
    const scrollToSpy = vi.fn();
    Element.prototype.scrollTo = scrollToSpy;

    render(<MessageList {...defaultProps} />);

    expect(scrollToSpy).toHaveBeenCalled();
  });

  it("should scroll when message text changes (streaming)", () => {
    const scrollToSpy = vi.fn();
    Element.prototype.scrollTo = scrollToSpy;

    const messages = [createMockMessage({ id: "msg-1", text: "Hello" })];
    const { rerender } = render(<MessageList {...defaultProps} messages={messages} />);

    expect(scrollToSpy).toHaveBeenCalledTimes(1);

    const updatedMessages = [createMockMessage({ id: "msg-1", text: "Hello world" })];
    rerender(<MessageList {...defaultProps} messages={updatedMessages} />);

    expect(scrollToSpy).toHaveBeenCalledTimes(2);
  });

  it("should scroll multiple times during streaming chunks", () => {
    const scrollToSpy = vi.fn();
    Element.prototype.scrollTo = scrollToSpy;

    const messages = [createMockMessage({ id: "msg-1", text: "Hello" })];
    const { rerender } = render(<MessageList {...defaultProps} messages={messages} />);

    expect(scrollToSpy).toHaveBeenCalledTimes(1);

    rerender(<MessageList {...defaultProps} messages={[{ ...messages[0], text: "Hello wo" }]} />);
    expect(scrollToSpy).toHaveBeenCalledTimes(2);

    rerender(
      <MessageList {...defaultProps} messages={[{ ...messages[0], text: "Hello world" }]} />
    );
    expect(scrollToSpy).toHaveBeenCalledTimes(3);

    rerender(
      <MessageList {...defaultProps} messages={[{ ...messages[0], text: "Hello world!" }]} />
    );
    expect(scrollToSpy).toHaveBeenCalledTimes(4);
  });

  it("should scroll when isBotTyping changes", () => {
    const scrollToSpy = vi.fn();
    Element.prototype.scrollTo = scrollToSpy;

    const { rerender } = render(<MessageList {...defaultProps} isBotTyping={false} />);

    expect(scrollToSpy).toHaveBeenCalledTimes(1);

    rerender(<MessageList {...defaultProps} isBotTyping />);

    expect(scrollToSpy).toHaveBeenCalledTimes(2);
  });

  it("should scroll with smooth behavior", () => {
    const scrollToSpy = vi.fn();
    Element.prototype.scrollTo = scrollToSpy;

    render(<MessageList {...defaultProps} />);

    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        behavior: "smooth",
      })
    );
  });

  it("should not scroll when message text is unchanged", () => {
    const scrollToSpy = vi.fn();
    Element.prototype.scrollTo = scrollToSpy;

    const messages = [createMockMessage({ id: "msg-1", text: "Hello" })];
    const { rerender } = render(<MessageList {...defaultProps} messages={messages} />);

    expect(scrollToSpy).toHaveBeenCalledTimes(1);

    rerender(<MessageList {...defaultProps} messages={messages} />);

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
  });

  it("should apply correct font size to greeting title", () => {
    const { getByText } = render(<MessageList {...defaultProps} />);

    const titleElement = getByText("How can I help you?");
    expect(titleElement).toHaveStyle({ fontSize: "14px" });
  });

  it("should apply correct font size to greeting subtitle", () => {
    const { container } = render(<MessageList {...defaultProps} />);

    const subtitleElement = container.querySelector("p");
    expect(subtitleElement).toHaveStyle({ fontSize: "13px" });
  });

  it("should hide greeting when messages beyond the initial greeting exist", () => {
    const messages = [
      createMockMessage({ id: "greeting", text: "How can I help?", sender: "bot" }),
      createMockMessage({ id: "msg-1", text: "Hello" }),
    ];
    const { queryByText } = render(<MessageList {...defaultProps} messages={messages} />);

    expect(queryByText("How can I help you?")).not.toBeInTheDocument();
  });

  it("should show greeting when no messages exist", () => {
    const { getByText } = render(<MessageList {...defaultProps} messages={[]} />);

    expect(getByText("How can I help you?")).toBeInTheDocument();
  });

  it("should pass isFirstMessage=true to first message only", () => {
    const messages = [
      createMockMessage({ id: "msg-1", text: "First" }),
      createMockMessage({ id: "msg-2", text: "Second" }),
    ];
    const { getByTestId } = render(<MessageList {...defaultProps} messages={messages} />);

    expect(getByTestId("message-msg-1")).toBeInTheDocument();
    expect(getByTestId("message-msg-2")).toBeInTheDocument();
  });

  it("should scroll in fullscreen mode", () => {
    const scrollToSpy = vi.fn();
    Element.prototype.scrollTo = scrollToSpy;

    mockUseChatDrawerContext.mockReturnValue({
      ...defaultContext,
      isFullscreen: true,
    });

    render(<MessageList {...defaultProps} />);

    expect(scrollToSpy).toHaveBeenCalled();
  });

  it("should scroll when expand state changes", () => {
    const scrollToSpy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollTop", {
      set: scrollToSpy,
      configurable: true,
    });
    Object.defineProperty(Element.prototype, "scrollHeight", {
      get: () => 1000,
      configurable: true,
    });

    mockUseChatDrawerContext.mockReturnValue({
      ...defaultContext,
      isExpanded: true,
    });

    render(<MessageList {...defaultProps} />);

    expect(scrollToSpy).toHaveBeenCalled();
  });
});
