import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import * as ChatDrawerContextModule from "../context/ChatDrawerContext";

import BotTypingIndicator from "./BotTypingIndicator";

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

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatDrawerContext.mockReturnValue(defaultContext);
  });

  it("should have no accessibility violations", async () => {
    const { container } = render(<BotTypingIndicator />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatDrawerContext.mockReturnValue(defaultContext);
  });
  it("should render without crashing", () => {
    expect(() => render(<BotTypingIndicator />)).not.toThrow();
  });

  it("should display default sender name", () => {
    const { getByText } = render(<BotTypingIndicator />);

    expect(getByText("Support Bot")).toBeInTheDocument();
  });

  it("should display custom sender name when provided", () => {
    const { getByText } = render(<BotTypingIndicator senderName="Custom Bot" />);

    expect(getByText("Custom Bot")).toBeInTheDocument();
  });

  it("should render three typing dots", () => {
    const { container } = render(<BotTypingIndicator />);

    const typingDots = container.querySelectorAll("span");
    expect(typingDots).toHaveLength(3);
  });

  it("should render with correct structure", () => {
    const { container } = render(<BotTypingIndicator />);

    const typingBubble = container.querySelector('[aria-label="Support Bot is typing"]');
    expect(typingBubble).toBeInTheDocument();
    expect(typingBubble?.querySelectorAll("span")).toHaveLength(3);
  });

  it("should update sender name when prop changes", () => {
    const { rerender, getByText, queryByText } = render(
      <BotTypingIndicator senderName="Bot One" />
    );

    expect(getByText("Bot One")).toBeInTheDocument();

    rerender(<BotTypingIndicator senderName="Bot Two" />);

    expect(getByText("Bot Two")).toBeInTheDocument();
    expect(queryByText("Bot One")).not.toBeInTheDocument();
  });

  it("should maintain structure with empty string sender name", () => {
    const { container } = render(<BotTypingIndicator senderName="" />);

    const typingBubble = container.querySelector('[aria-label=" is typing"]');
    expect(typingBubble).toBeInTheDocument();
  });

  it("should apply fullscreen scaling when isFullscreen is true", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultContext,
      isFullscreen: true,
    });

    const { getByText } = render(<BotTypingIndicator senderName="Test Bot" />);
    const sender = getByText("Test Bot");

    expect(sender).toHaveStyle({ fontSize: "16px" });
  });

  it("should apply normal scaling when isFullscreen is false", () => {
    mockUseChatDrawerContext.mockReturnValue({
      ...defaultContext,
      isFullscreen: false,
    });

    const { getByText } = render(<BotTypingIndicator senderName="Test Bot" />);
    const sender = getByText("Test Bot");

    expect(sender).toHaveStyle({ fontSize: "12px" });
  });
});
