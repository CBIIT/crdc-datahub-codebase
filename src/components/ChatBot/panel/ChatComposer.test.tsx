import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { fireEvent, render, waitFor } from "@/test-utils";

import * as ChatDrawerContextModule from "../context/ChatDrawerContext";

import ChatComposer from "./ChatComposer";

vi.mock("../context/ChatDrawerContext", () => ({
  useChatDrawerContext: vi.fn(),
}));

const mockUseChatDrawerContext = vi.mocked(ChatDrawerContextModule.useChatDrawerContext);

const defaultContext = {
  isFullscreen: false,
  drawerRef: { current: null },
  heightPx: 600,
  widthPx: 384,
  x: 0,
  y: 0,
  isExpanded: true,
  isMinimized: false,
  isOpen: true,
  onDragStop: vi.fn(),
  onResizeStop: vi.fn(),
  onToggleExpand: vi.fn(),
  onToggleFullscreen: vi.fn(),
  onMinimize: vi.fn(),
  openDrawer: vi.fn(),
  isConfirmingEndConversation: false,
  onRequestEndConversation: vi.fn(),
  onConfirmEndConversation: vi.fn(),
  onCancelEndConversation: vi.fn(),
};

const defaultProps = {
  value: "",
  onChange: vi.fn(),
  onSend: vi.fn(),
  onKeyDown: vi.fn(),
  isSendDisabled: false,
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatDrawerContext.mockReturnValue(defaultContext);
  });

  it("should have no accessibility violations", async () => {
    const { container } = render(<ChatComposer {...defaultProps} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatDrawerContext.mockReturnValue(defaultContext);
  });

  it("should render without crashing", () => {
    expect(() => render(<ChatComposer {...defaultProps} />)).not.toThrow();
  });

  it("should render input field with placeholder", () => {
    const { getByPlaceholderText } = render(<ChatComposer {...defaultProps} />);

    expect(getByPlaceholderText("Type your message...")).toBeInTheDocument();
  });

  it("should render send button", () => {
    const { getByRole } = render(<ChatComposer {...defaultProps} />);

    expect(getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });

  it("should display the provided value in the input", () => {
    const { getByDisplayValue } = render(<ChatComposer {...defaultProps} value="Test message" />);

    expect(getByDisplayValue("Test message")).toBeInTheDocument();
  });

  it("should call onChange when user types in the input", async () => {
    const onChange = vi.fn();
    const { getByPlaceholderText } = render(<ChatComposer {...defaultProps} onChange={onChange} />);

    const input = getByPlaceholderText("Type your message...");
    userEvent.type(input, "Hello");

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith("H");
    });
  });

  it("should call onSend when send button is clicked", async () => {
    const onSend = vi.fn();
    const { getByRole } = render(<ChatComposer {...defaultProps} onSend={onSend} />);

    const sendButton = getByRole("button", { name: /send message/i });
    userEvent.click(sendButton);

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("should call onKeyDown when user presses a key", async () => {
    const onKeyDown = vi.fn();
    const { getByPlaceholderText } = render(
      <ChatComposer {...defaultProps} onKeyDown={onKeyDown} />
    );

    const input = getByPlaceholderText("Type your message...");
    userEvent.type(input, "{Enter}");

    expect(onKeyDown).toHaveBeenCalled();
  });

  it("should disable send button when isSendDisabled is true", () => {
    const { getByRole } = render(<ChatComposer {...defaultProps} isSendDisabled />);

    const sendButton = getByRole("button", { name: /send message/i });
    expect(sendButton).toBeDisabled();
  });

  it("should enable send button when isSendDisabled is false", () => {
    const { getByRole } = render(<ChatComposer {...defaultProps} isSendDisabled={false} />);

    const sendButton = getByRole("button", { name: /send message/i });
    expect(sendButton).toBeEnabled();
  });

  it("should not call onSend when button is disabled", () => {
    const onSend = vi.fn();
    const { getByRole } = render(<ChatComposer {...defaultProps} onSend={onSend} isSendDisabled />);

    const sendButton = getByRole("button", { name: /send message/i });
    fireEvent.click(sendButton);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("should update displayed value when value prop changes", () => {
    const { rerender, getByDisplayValue, queryByDisplayValue } = render(
      <ChatComposer {...defaultProps} value="Initial" />
    );

    expect(getByDisplayValue("Initial")).toBeInTheDocument();

    rerender(<ChatComposer {...defaultProps} value="Updated" />);

    expect(getByDisplayValue("Updated")).toBeInTheDocument();
    expect(queryByDisplayValue("Initial")).not.toBeInTheDocument();
  });

  it("should handle empty value prop", () => {
    const { getByPlaceholderText } = render(<ChatComposer {...defaultProps} value="" />);

    const input = getByPlaceholderText("Type your message...");
    expect(input).toHaveValue("");
  });
});
