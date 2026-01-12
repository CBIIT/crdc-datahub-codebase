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

vi.mock("./ChatDrawer", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chat-drawer">{children}</div>
  ),
}));

vi.mock("./ChatPanel", () => ({
  default: () => <div data-testid="chat-panel">Chat Panel</div>,
}));

const mockUseChatBotContext = vi.fn();
const mockUseChatDrawerContext = vi.fn();

vi.mock("./context/ChatBotContext", () => ({
  useChatBotContext: () => mockUseChatBotContext(),
}));

vi.mock("./context/ChatDrawerContext", () => ({
  useChatDrawerContext: () => mockUseChatDrawerContext(),
}));

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatBotContext.mockReturnValue({
      label: "Chat",
      title: "Support",
      knowledgeBaseUrl: "https://example.com",
    });
  });

  it("should have no accessibility violations when drawer is closed", async () => {
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: false,
      openDrawer: vi.fn(),
    });

    const { container } = render(<ChatBotView />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations when drawer is open", async () => {
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: true,
      openDrawer: vi.fn(),
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
      title: "Support",
      knowledgeBaseUrl: "https://example.com",
    });
  });

  it("should render without crashing", () => {
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: false,
      openDrawer: vi.fn(),
    });

    expect(() => render(<ChatBotView />)).not.toThrow();
  });

  it("should render FloatingChatButton when drawer is closed", () => {
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: false,
      openDrawer: vi.fn(),
    });

    const { getByTestId } = render(<ChatBotView />);

    expect(getByTestId("floating-chat-button")).toBeInTheDocument();
  });

  it("should not render ChatDrawer when drawer is closed", () => {
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: false,
      openDrawer: vi.fn(),
    });

    const { queryByTestId } = render(<ChatBotView />);

    expect(queryByTestId("chat-drawer")).not.toBeInTheDocument();
  });

  it("should render ChatDrawer when drawer is open", () => {
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: true,
      openDrawer: vi.fn(),
    });

    const { getByTestId } = render(<ChatBotView />);

    expect(getByTestId("chat-drawer")).toBeInTheDocument();
  });

  it("should render ChatPanel inside ChatDrawer when open", () => {
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: true,
      openDrawer: vi.fn(),
    });

    const { getByTestId } = render(<ChatBotView />);

    expect(getByTestId("chat-panel")).toBeInTheDocument();
  });

  it("should not render FloatingChatButton when drawer is open", () => {
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: true,
      openDrawer: vi.fn(),
    });

    const { queryByTestId } = render(<ChatBotView />);

    expect(queryByTestId("floating-chat-button")).not.toBeInTheDocument();
  });

  it("should pass label from context to FloatingChatButton", () => {
    mockUseChatBotContext.mockReturnValue({
      label: "Help Me",
      title: "Support",
      knowledgeBaseUrl: "https://example.com",
    });
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: false,
      openDrawer: vi.fn(),
    });

    const { getByText } = render(<ChatBotView />);

    expect(getByText("Help Me")).toBeInTheDocument();
  });

  it("should call openDrawer when FloatingChatButton is clicked", () => {
    const openDrawer = vi.fn();
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: false,
      openDrawer,
    });

    const { getByTestId } = render(<ChatBotView />);

    const button = getByTestId("floating-chat-button");
    button.click();

    expect(openDrawer).toHaveBeenCalledTimes(1);
  });

  it("should toggle between closed and open states", () => {
    const openDrawer = vi.fn();
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: false,
      openDrawer,
    });

    const { getByTestId, queryByTestId, unmount } = render(<ChatBotView />);

    expect(getByTestId("floating-chat-button")).toBeInTheDocument();
    expect(queryByTestId("chat-drawer")).not.toBeInTheDocument();

    unmount();

    mockUseChatDrawerContext.mockReturnValue({
      isOpen: true,
      openDrawer,
    });
    const { queryByTestId: queryByTestId2, getByTestId: getByTestId2 } = render(<ChatBotView />);

    expect(queryByTestId2("floating-chat-button")).not.toBeInTheDocument();
    expect(getByTestId2("chat-drawer")).toBeInTheDocument();
  });

  it("should handle different label values", () => {
    mockUseChatBotContext.mockReturnValue({
      label: "Ask a Question",
      title: "Support",
      knowledgeBaseUrl: "https://example.com",
    });
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: false,
      openDrawer: vi.fn(),
    });

    const { getByText } = render(<ChatBotView />);

    expect(getByText("Ask a Question")).toBeInTheDocument();
  });

  it("should render FloatingChatButton when drawer is minimized", () => {
    mockUseChatDrawerContext.mockReturnValue({
      isOpen: true,
      isMinimized: true,
      openDrawer: vi.fn(),
    });

    const { getByTestId, queryByTestId } = render(<ChatBotView />);

    expect(getByTestId("floating-chat-button")).toBeInTheDocument();
    expect(queryByTestId("chat-drawer")).not.toBeInTheDocument();
  });
});
