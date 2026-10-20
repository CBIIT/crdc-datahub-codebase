import React from "react";
import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import ChatBotView from "./ChatBotView";

vi.mock("./FloatingChatButton", () => ({
  default: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" data-testid="floating-chat-button" onClick={onClick}>
      {label}
    </button>
  ),
}));

const mockUseChatBotContext = vi.fn();
const mockUseFloatingWindowContext = vi.fn();

vi.mock("@/components/FloatingWindow", () => ({
  FloatingWindow: ({ id, children }: { id: string; children: React.ReactNode }) => (
    <div data-testid={id}>{children}</div>
  ),
  useFloatingWindowContext: () => mockUseFloatingWindowContext(),
}));

vi.mock("./ChatPanel", () => ({
  default: () => <div data-testid="chat-panel">Chat Panel</div>,
}));

vi.mock("./EndConversationConfirm", () => ({
  default: () => <div data-testid="end-conversation-confirm" />,
}));

vi.mock("./context/ChatBotContext", () => ({
  useChatBotContext: () => mockUseChatBotContext(),
}));

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatBotContext.mockReturnValue({
      label: "Chat",
      knowledgeBaseUrl: "https://example.com",
    });
  });

  it("should have no accessibility violations when drawer is closed", async () => {
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: false,
      isMinimized: false,
      openWindow: vi.fn(),
    });

    const { container } = render(<ChatBotView />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations when drawer is open", async () => {
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: true,
      isMinimized: false,
      openWindow: vi.fn(),
    });

    const { container } = render(<ChatBotView />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatBotContext.mockReturnValue({
      label: "Chat",
      knowledgeBaseUrl: "https://example.com",
    });
  });

  it("should render without crashing", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: false,
      isMinimized: false,
      openWindow: vi.fn(),
    });

    expect(() => render(<ChatBotView />)).not.toThrow();
  });

  it("should render FloatingChatButton when drawer is closed", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: false,
      isMinimized: false,
      openWindow: vi.fn(),
    });

    const { getByTestId } = render(<ChatBotView />);

    expect(getByTestId("floating-chat-button")).toBeInTheDocument();
  });

  it("should not render the chat window when drawer is closed", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: false,
      isMinimized: false,
      openWindow: vi.fn(),
    });

    const { queryByTestId } = render(<ChatBotView />);

    expect(queryByTestId("chat-drawer")).not.toBeInTheDocument();
  });

  it("should render the chat window when drawer is open", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: true,
      isMinimized: false,
      openWindow: vi.fn(),
    });

    const { getByTestId } = render(<ChatBotView />);

    expect(getByTestId("chat-drawer")).toBeInTheDocument();
  });

  it("should render ChatPanel inside the chat window when open", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: true,
      isMinimized: false,
      openWindow: vi.fn(),
    });

    const { getByTestId } = render(<ChatBotView />);

    expect(getByTestId("chat-drawer")).toContainElement(getByTestId("chat-panel"));
  });

  it("should not render FloatingChatButton when drawer is open", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: true,
      isMinimized: false,
      openWindow: vi.fn(),
    });

    const { queryByTestId } = render(<ChatBotView />);

    expect(queryByTestId("floating-chat-button")).not.toBeInTheDocument();
  });

  it("should pass label from context to FloatingChatButton", () => {
    mockUseChatBotContext.mockReturnValue({
      label: "Help Me",
      knowledgeBaseUrl: "https://example.com",
    });
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: false,
      openWindow: vi.fn(),
    });

    const { getByText } = render(<ChatBotView />);

    expect(getByText("Help Me")).toBeInTheDocument();
  });

  it("should call openWindow when FloatingChatButton is clicked", () => {
    const openWindow = vi.fn();
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: false,
      isMinimized: false,
      openWindow,
    });

    const { getByTestId } = render(<ChatBotView />);

    const button = getByTestId("floating-chat-button");
    button.click();

    expect(openWindow).toHaveBeenCalledTimes(1);
  });

  it("should render both FloatingChatButton and the chat window when minimized", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: true,
      isMinimized: true,
      openWindow: vi.fn(),
    });

    const { getByTestId } = render(<ChatBotView />);

    expect(getByTestId("floating-chat-button")).toBeInTheDocument();
    expect(getByTestId("chat-drawer")).toBeInTheDocument();
  });
});
