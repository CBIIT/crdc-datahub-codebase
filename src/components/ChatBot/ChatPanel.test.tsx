import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import ChatPanel from "./ChatPanel";
import * as ChatConversationContextModule from "./context/ChatConversationContext";
import * as ChatDrawerContextModule from "./context/ChatDrawerContext";

vi.mock("./context/ChatDrawerContext", () => ({
  useChatDrawerContext: vi.fn(),
}));

vi.mock("./context/ChatConversationContext", () => ({
  useChatConversationContext: vi.fn(),
}));

const mockUseChatDrawerContext = vi.mocked(ChatDrawerContextModule.useChatDrawerContext);
const mockUseChatConversationContext = vi.mocked(
  ChatConversationContextModule.useChatConversationContext
);

const defaultChatDrawerContext = {
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

const defaultConversationState = {
  greetingTimestamp: new Date("2024-01-15T09:00:00"),
  messages: [],
  inputValue: "",
  isBotTyping: false,
  setInputValue: vi.fn(),
  sendMessage: vi.fn(),
  handleKeyDown: vi.fn(),
  endConversation: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseChatDrawerContext.mockReturnValue(defaultChatDrawerContext);
  mockUseChatConversationContext.mockReturnValue(defaultConversationState);
});

vi.mock("./panel/MessageList", () => ({
  default: ({ messages, isBotTyping }: { messages: ChatMessage[]; isBotTyping: boolean }) => (
    <div data-testid="message-list">
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

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<ChatPanel />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations with messages", async () => {
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      messages: [createMockMessage()],
    });

    const { container } = render(<ChatPanel />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
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

  it("should pass messages to MessageList", () => {
    const messages = [createMockMessage({ id: "msg-1" }), createMockMessage({ id: "msg-2" })];
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      messages,
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("messages-count")).toHaveTextContent("2");
  });

  it("should pass isBotTyping to MessageList", () => {
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      isBotTyping: true,
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("bot-typing")).toHaveTextContent("true");
  });

  it("should pass input value to ChatComposer", () => {
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      inputValue: "Hello world",
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-input")).toHaveValue("Hello world");
  });

  it("should call setInputValue when composer input changes", async () => {
    const setInputValue = vi.fn();
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      setInputValue,
    });

    const { getByTestId } = render(<ChatPanel />);

    const input = getByTestId("composer-input") as HTMLInputElement;
    userEvent.clear(input);
    userEvent.type(input, "New text");

    expect(setInputValue).toHaveBeenCalled();
  });

  it("should call sendMessage when send button is clicked", () => {
    const sendMessage = vi.fn();
    mockUseChatConversationContext.mockReturnValue({
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
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      inputValue: "",
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-send")).toBeDisabled();
  });

  it("should disable send button when input is only whitespace", () => {
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      inputValue: "   ",
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-send")).toBeDisabled();
  });

  it("should enable send button when input has text", () => {
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      inputValue: "Hello",
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-send")).not.toBeDisabled();
  });

  it("should disable send button when bot is typing", () => {
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      inputValue: "Hello",
      isBotTyping: true,
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-send")).toBeDisabled();
  });

  it("should pass handleKeyDown to ChatComposer", () => {
    const handleKeyDown = vi.fn();
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      handleKeyDown,
    });

    const { getByTestId } = render(<ChatPanel />);

    const keyDownInput = getByTestId("composer-keydown");
    keyDownInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(handleKeyDown).toHaveBeenCalled();
  });

  it("should update when conversation state changes", () => {
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      inputValue: "First",
    });

    const { getByTestId, unmount } = render(<ChatPanel />);

    expect(getByTestId("composer-input")).toHaveValue("First");

    unmount();

    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      inputValue: "Second",
    });

    const { getByTestId: getByTestId2 } = render(<ChatPanel />);

    expect(getByTestId2("composer-input")).toHaveValue("Second");
  });

  it("should render correctly with multiple messages of different types", () => {
    const messages = [
      createMockMessage({ id: "msg-1", sender: "user", text: "User message" }),
      createMockMessage({ id: "msg-2", sender: "bot", text: "Bot response" }),
      createMockMessage({ id: "msg-3", sender: "user", text: "Another user message" }),
    ];
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      messages,
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("messages-count")).toHaveTextContent("3");
  });

  it("should handle long messages correctly", () => {
    const longMessage = "a".repeat(1000);
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      inputValue: longMessage,
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("composer-input")).toHaveValue(longMessage);
    expect(getByTestId("composer-send")).not.toBeDisabled();
  });

  it("should render with empty messages list", () => {
    mockUseChatConversationContext.mockReturnValue({
      ...defaultConversationState,
      messages: [],
    });

    const { getByTestId } = render(<ChatPanel />);

    expect(getByTestId("messages-count")).toHaveTextContent("0");
  });

  it("should render drag handles when collapsed (not expanded and not fullscreen)", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isExpanded: false,
      isFullscreen: false,
    });

    const { container } = render(<ChatPanel />);

    expect(container.querySelector('[aria-label="Resize handle"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-label="Drag to move"]')).toHaveLength(4);
  });

  it("should not render drag handles when expanded", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isExpanded: true,
      isFullscreen: false,
    });

    const { container } = render(<ChatPanel />);

    expect(container.querySelector('[aria-label="Resize handle"]')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-label="Drag to move"]')).not.toBeInTheDocument();
  });

  it("should not render drag handles when in fullscreen", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isExpanded: false,
      isFullscreen: true,
    });

    const { container } = render(<ChatPanel />);

    expect(container.querySelector('[aria-label="Resize handle"]')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-label="Drag to move"]')).not.toBeInTheDocument();
  });

  it("should call onBeginResize when drag handle is pressed", () => {
    const onBeginResize = vi.fn();
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isExpanded: false,
      isFullscreen: false,
      onBeginResize,
    });

    const { container } = render(<ChatPanel />);

    const resizeHandle = container.querySelector('[aria-label="Resize handle"]')?.parentElement;
    expect(resizeHandle).toBeInTheDocument();
    fireEvent.pointerDown(resizeHandle as Element);

    expect(onBeginResize).toHaveBeenCalled();
  });

  it("should call onBeginMove when draggable border is pressed", () => {
    const onBeginMove = vi.fn();
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isExpanded: false,
      isFullscreen: false,
      onBeginMove,
    });

    const { container } = render(<ChatPanel />);

    const draggableBorder = container.querySelector('[aria-label="Drag to move"]');
    expect(draggableBorder).toBeInTheDocument();
    fireEvent.pointerDown(draggableBorder as Element);

    expect(onBeginMove).toHaveBeenCalled();
  });

  it("should render content inside fullscreen container when in fullscreen mode", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultChatDrawerContext,
      isExpanded: true,
      isFullscreen: true,
    });

    const { getByTestId, container } = render(<ChatPanel />);

    expect(getByTestId("message-list")).toBeInTheDocument();
    expect(getByTestId("chat-composer")).toBeInTheDocument();
    expect(container.querySelector(".MuiContainer-root")).toBeInTheDocument();
  });
});
