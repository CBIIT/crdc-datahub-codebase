import React from "react";
import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import ChatBotView from "./ChatBotView";

const mockUseFloatingWindowContext = vi.fn();
const mockUseLauncherItem = vi.fn();

vi.mock("@/components/FloatingWindow", () => ({
  FloatingWindow: ({
    id,
    confirmCloseContent,
    children,
  }: {
    id: string;
    confirmCloseContent?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid={id}>
      {confirmCloseContent}
      {children}
    </div>
  ),
  FloatingWindowConfirm: ({ title }: { title: string }) => (
    <div data-testid="floating-window-confirm">{title}</div>
  ),
  useFloatingWindowContext: () => mockUseFloatingWindowContext(),
}));

vi.mock("../Contexts/LauncherContext", () => ({
  useLauncherItem: (...args: unknown[]) => mockUseLauncherItem(...args),
}));

vi.mock("./ChatPanel", () => ({
  default: () => <div data-testid="chat-panel">Chat Panel</div>,
}));

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("should render without crashing", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: false,
      isMinimized: false,
      openWindow: vi.fn(),
    });

    expect(() => render(<ChatBotView />)).not.toThrow();
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

  it("should pass the End Conversation confirmation to the chat window", () => {
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: true,
      isMinimized: false,
      openWindow: vi.fn(),
    });

    const { getByTestId } = render(<ChatBotView />);

    expect(getByTestId("floating-window-confirm")).toHaveTextContent("End Conversation");
  });

  it("should register the chatbot in the launcher", () => {
    const openWindow = vi.fn();
    mockUseFloatingWindowContext.mockReturnValue({
      isOpen: false,
      isMinimized: false,
      openWindow,
    });

    render(<ChatBotView />);

    expect(mockUseLauncherItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "chatbot",
        label: "SI CRDC Assistant",
        order: 1,
        onClick: openWindow,
      })
    );
  });

  it.each([
    { isOpen: false, isMinimized: false, isActive: false },
    { isOpen: true, isMinimized: false, isActive: true },
    { isOpen: true, isMinimized: true, isActive: false },
  ])(
    "should set isActive to $isActive when isOpen is $isOpen and isMinimized is $isMinimized",
    ({ isOpen, isMinimized, isActive }) => {
      mockUseFloatingWindowContext.mockReturnValue({ isOpen, isMinimized, openWindow: vi.fn() });

      render(<ChatBotView />);

      expect(mockUseLauncherItem).toHaveBeenLastCalledWith(expect.objectContaining({ isActive }));
    }
  );
});
