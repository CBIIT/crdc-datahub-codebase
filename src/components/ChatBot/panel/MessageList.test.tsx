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
  isDragging: false,
  isExpanded: true,
  isMinimized: false,
  isOpen: true,
  onBeginResize: vi.fn(),
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
  greetingTimestamp: new Date("2024-01-15T09:00:00"),
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

    expect(getByText("Welcome to the CRDC Submission Portal Support")).toBeInTheDocument();
  });

  it("should display formatted greeting timestamp", () => {
    const greetingTimestamp = new Date("2024-01-15T14:30:00");
    const { getByText } = render(
      <MessageList {...defaultProps} greetingTimestamp={greetingTimestamp} />
    );

    expect(getByText(/January 15, 2024/i)).toBeInTheDocument();
  });

  it("should render empty messages array without errors", () => {
    const { container } = render(<MessageList {...defaultProps} messages={[]} />);

    expect(container.querySelector('[data-testid^="message-"]')).not.toBeInTheDocument();
  });

  it("should render single message", () => {
    const messages = [createMockMessage({ id: "msg-1", text: "Hello world" })];
    const { getByTestId } = render(<MessageList {...defaultProps} messages={messages} />);

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
    const messages = [createMockMessage({ id: "msg-1", text: "Hello" })];
    const { getByTestId } = render(
      <MessageList {...defaultProps} messages={messages} isBotTyping />
    );

    expect(getByTestId("message-msg-1")).toBeInTheDocument();
    expect(getByTestId("bot-typing-indicator")).toBeInTheDocument();
  });

  it("should update when messages prop changes", () => {
    const messages1 = [createMockMessage({ id: "msg-1", text: "First" })];
    const messages2 = [
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

  it("should render with different greeting timestamps", () => {
    const timestamp1 = new Date("2024-01-15T09:00:00");
    const timestamp2 = new Date("2024-01-16T15:30:00");
    const { rerender, getByText } = render(
      <MessageList {...defaultProps} greetingTimestamp={timestamp1} />
    );

    expect(getByText(/January 15, 2024/i)).toBeInTheDocument();

    rerender(<MessageList {...defaultProps} greetingTimestamp={timestamp2} />);

    expect(getByText(/January 16, 2024/i)).toBeInTheDocument();
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
  it("should apply larger font size to greeting title when in fullscreen mode", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultContext,
      isFullscreen: true,
    });

    const { getByText } = render(<MessageList {...defaultProps} />);

    const titleElement = getByText("Welcome to the CRDC Submission Portal Support");
    expect(titleElement).toHaveStyle({ fontSize: "24px" });
  });

  it("should apply default font size to greeting title when not in fullscreen mode", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultContext,
      isFullscreen: false,
    });

    const { getByText } = render(<MessageList {...defaultProps} />);

    const titleElement = getByText("Welcome to the CRDC Submission Portal Support");
    expect(titleElement).toHaveStyle({ fontSize: "20px" });
  });

  it("should apply larger font size to greeting subtitle when in fullscreen mode", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultContext,
      isFullscreen: true,
    });

    const { container } = render(<MessageList {...defaultProps} />);

    const subtitleElement = container.querySelector("p");
    expect(subtitleElement).toHaveStyle({ fontSize: "16px" });
  });

  it("should apply default font size to greeting subtitle when not in fullscreen mode", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultContext,
      isFullscreen: false,
    });

    const { container } = render(<MessageList {...defaultProps} />);

    const subtitleElement = container.querySelector("p");
    expect(subtitleElement).toHaveStyle({ fontSize: "12px" });
  });
});
