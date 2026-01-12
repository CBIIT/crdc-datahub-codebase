import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import ChatPanel from "./ChatPanel";
import * as ChatDrawerContextModule from "./context/ChatDrawerContext";

vi.mock("./context/ChatDrawerContext", () => ({
  useChatDrawerContext: vi.fn(),
}));

const mockUseChatDrawerContext = vi.mocked(ChatDrawerContextModule.useChatDrawerContext);

const defaultChatDrawerContext = {
  isFullscreen: false,
  drawerRef: { current: null },
  heightPx: 600,
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

const mockUseChatConversation = vi.fn();

vi.mock("./hooks/useChatConversation", () => ({
  useChatConversation: () => mockUseChatConversation(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseChatDrawerContext.mockReturnValue(defaultChatDrawerContext);
});

vi.mock("./panel/MessageList", () => ({
  default: ({
    greetingTimestamp,
    messages,
    isBotTyping,
  }: {
    greetingTimestamp: Date;
    messages: ChatMessage[];
    isBotTyping: boolean;
  }) => (
    <div data-testid="message-list">
      <span data-testid="greeting-timestamp">{greetingTimestamp.toISOString()}</span>
      <span data-testid="messages-count">{messages.length}</span>
      <span data-testid="bot-typing">{isBotTyping.toString()}</span>
    </div>
  ),
}));

vi.mock("./panel/ChatComposer", () => ({
  default: ({
    value,
    onChange,
    onSend,
    onKeyDown,
    isSendDisabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
    isSendDisabled: boolean;
  }) => (
    <div data-testid="chat-composer">
      <input
        data-testid="composer-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Chat message input"
      />
      <button type="button" data-testid="composer-send" onClick={onSend} disabled={isSendDisabled}>
        Send
      </button>
      <button
        type="button"
        data-testid="composer-keydown"
        onKeyDown={onKeyDown as React.KeyboardEventHandler<HTMLButtonElement>}
      >
        KeyDown
      </button>
    </div>
  ),
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

const defaultConversationState = {
  greetingTimestamp: new Date("2024-01-15T09:00:00"),
  messages: [],
  inputValue: "",
  isBotTyping: false,
  setInputValue: vi.fn(),
  sendMessage: vi.fn(),
  handleKeyDown: vi.fn(),
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatConversation.mockReturnValue(defaultConversationState);
  });

  it("should have no accessibility violations", async () => {
    const { container } = render(<ChatPanel />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations with messages", async () => {
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      messages: [createMockMessage()],
    });

    const { container } = render(<ChatPanel />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatConversation.mockReturnValue(defaultConversationState);
  });

  it("should render without crashing", () => {
    expect(() => render(<ChatPanel />)).not.toThrow();
  });

  it("should render MessageList component", () => {
    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("message-list")).toBeInTheDocument();
  });

  it("should render ChatComposer component", () => {
    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("chat-composer")).toBeInTheDocument();
  });

  it("should pass greeting timestamp to MessageList", () => {
    const greetingTimestamp = new Date("2024-01-15T10:30:00");
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      greetingTimestamp,
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("greeting-timestamp")).toHaveTextContent(greetingTimestamp.toISOString());
  });

  it("should pass messages to MessageList", () => {
    const messages = [createMockMessage({ id: "msg-1" }), createMockMessage({ id: "msg-2" })];
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      messages,
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("messages-count")).toHaveTextContent("2");
  });

  it("should pass isBotTyping to MessageList", () => {
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      isBotTyping: true,
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("bot-typing")).toHaveTextContent("true");
  });

  it("should pass input value to ChatComposer", () => {
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      inputValue: "Hello world",
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-input")).toHaveValue("Hello world");
  });

  it("should call setInputValue when composer input changes", async () => {
    const setInputValue = vi.fn();
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      setInputValue,
    });

    const { getByTestId } = render(<ChatPanel />);

    const input = getByTestId("composer-input") as HTMLInputElement;
    userEvent.clear(input);
    userEvent.type(input, "New text");

    expect(setInputValue).toHaveBeenCalled();
    expect(setInputValue).toHaveBeenLastCalledWith("t");
  });

  it("should call sendMessage when send button is clicked", () => {
    const sendMessage = vi.fn();
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      inputValue: "Test message",
      sendMessage,
    });

    const { getByTestId } = render(<ChatPanel />);

    const sendButton = getByTestId("composer-send");
    sendButton.click();

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("should disable send button when input is empty", () => {
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      inputValue: "",
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-send")).toBeDisabled();
  });

  it("should disable send button when input is only whitespace", () => {
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      inputValue: "   ",
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-send")).toBeDisabled();
  });

  it("should enable send button when input has text", () => {
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      inputValue: "Hello",
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-send")).not.toBeDisabled();
  });

  it("should disable send button when bot is typing", () => {
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      inputValue: "Hello",
      isBotTyping: true,
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-send")).toBeDisabled();
  });

  it("should disable send button when bot is typing even with text input", () => {
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      inputValue: "Some text",
      isBotTyping: true,
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-send")).toBeDisabled();
  });

  it("should pass handleKeyDown to ChatComposer", () => {
    const handleKeyDown = vi.fn();
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      handleKeyDown,
    });

    const { getByTestId } = render(<ChatPanel />);

    const keyDownInput = getByTestId("composer-keydown");
    keyDownInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(handleKeyDown).toHaveBeenCalled();
  });

  it("should update when conversation state changes", () => {
    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      inputValue: "First",
    });

    const { getByTestId, unmount } = render(<ChatPanel />);

    expect(getByTestId("composer-input")).toHaveValue("First");

    unmount();

    mockUseChatConversation.mockReturnValue({
      ...defaultConversationState,
      inputValue: "Second",
    });

    const { getByTestId: getByTestId2 } = render(<ChatPanel />);

    expect(getByTestId2("composer-input")).toHaveValue("Second");
  });

  it("should apply larger font size to container when in fullscreen mode", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isFullscreen: true,
    });

    const { container } = render(<ChatPanel />);

    const stackElement = container.firstChild as HTMLElement;
    expect(stackElement).toHaveStyle({ fontSize: "18px" });
  });

  it("should not apply extra font size to container when not in fullscreen mode", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isFullscreen: false,
    });

    const { container } = render(<ChatPanel />);

    const stackElement = container.firstChild as HTMLElement;
    expect(stackElement).not.toHaveStyle({ fontSize: "18px" });
  });
});
