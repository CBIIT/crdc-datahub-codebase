import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import ChatMessageItem, { formatMessageTime } from "./ChatMessageItem";

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
  it("should have no accessibility violations with bot message", async () => {
    const message = createMockMessage();
    const { container } = render(<ChatMessageItem message={message} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations with user message", async () => {
    const message = createMockMessage({ sender: "user", senderName: "You" });
    const { container } = render(<ChatMessageItem message={message} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations with error variant", async () => {
    const message = createMockMessage({ variant: "error" });
    const { container } = render(<ChatMessageItem message={message} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const message = createMockMessage();
    expect(() => render(<ChatMessageItem message={message} />)).not.toThrow();
  });

  it("should render bot message text", () => {
    const message = createMockMessage({ text: "Hello from bot" });
    const { getByText } = render(<ChatMessageItem message={message} />);

    expect(getByText("Hello from bot")).toBeInTheDocument();
  });

  it("should render user message text", () => {
    const message = createMockMessage({ sender: "user", text: "Hello from user" });
    const { getByText } = render(<ChatMessageItem message={message} />);

    expect(getByText("Hello from user")).toBeInTheDocument();
  });

  it("should display sender name for bot messages", () => {
    const message = createMockMessage({ senderName: "Support Bot" });
    const { getByText } = render(<ChatMessageItem message={message} />);

    expect(getByText("Support Bot")).toBeInTheDocument();
  });

  it("should not display sender name for user messages", () => {
    const message = createMockMessage({ sender: "user", senderName: "You" });
    const { queryByText } = render(<ChatMessageItem message={message} />);

    expect(queryByText("You")).not.toBeInTheDocument();
  });

  it("should display formatted timestamp", () => {
    const timestamp = new Date("2024-01-15T14:30:00");
    const message = createMockMessage({ timestamp });
    const { getByText } = render(<ChatMessageItem message={message} />);

    const formattedTime = formatMessageTime(timestamp);
    expect(getByText(formattedTime)).toBeInTheDocument();
  });

  it("should apply correct data attribute for bot messages", () => {
    const message = createMockMessage({ sender: "bot" });
    const { container } = render(<ChatMessageItem message={message} />);

    const messageRow = container.querySelector('[data-is-user="false"]');
    expect(messageRow).toBeInTheDocument();
  });

  it("should apply correct data attribute for user messages", () => {
    const message = createMockMessage({ sender: "user" });
    const { container } = render(<ChatMessageItem message={message} />);

    const messageRow = container.querySelector('[data-is-user="true"]');
    expect(messageRow).toBeInTheDocument();
  });

  it("should render with default variant when not specified", () => {
    const message = createMockMessage({ variant: undefined });
    const { getByText } = render(<ChatMessageItem message={message} />);

    expect(getByText("Test message")).toBeInTheDocument();
  });

  it("should render with info variant", () => {
    const message = createMockMessage({ variant: "info", text: "Info message" });
    const { getByText } = render(<ChatMessageItem message={message} />);

    expect(getByText("Info message")).toBeInTheDocument();
  });

  it("should render with error variant", () => {
    const message = createMockMessage({ variant: "error", text: "Error message" });
    const { getByText } = render(<ChatMessageItem message={message} />);

    expect(getByText("Error message")).toBeInTheDocument();
  });

  it("should handle multi-line text", () => {
    const message = createMockMessage({ text: "Line 1\nLine 2\nLine 3" });
    const { getByText } = render(<ChatMessageItem message={message} />);

    expect(
      getByText((content, element) => element?.textContent === "Line 1\nLine 2\nLine 3")
    ).toBeInTheDocument();
  });

  it("should handle empty text", () => {
    const message = createMockMessage({ text: "" });
    const { container } = render(<ChatMessageItem message={message} />);

    expect(container.querySelector('[data-is-user="false"]')).toBeInTheDocument();
  });

  it("should return null when message is null", () => {
    const { container } = render(<ChatMessageItem message={null} />);

    expect(container.firstChild).toBeNull();
  });

  it("should return null when message is undefined", () => {
    const { container } = render(<ChatMessageItem message={undefined} />);

    expect(container.firstChild).toBeNull();
  });

  it("should update when message prop changes", () => {
    const message1 = createMockMessage({ text: "First message" });
    const message2 = createMockMessage({ text: "Second message" });
    const { rerender, getByText, queryByText } = render(<ChatMessageItem message={message1} />);

    expect(getByText("First message")).toBeInTheDocument();

    rerender(<ChatMessageItem message={message2} />);

    expect(getByText("Second message")).toBeInTheDocument();
    expect(queryByText("First message")).not.toBeInTheDocument();
  });

  it("should format time correctly for AM hours", () => {
    const timestamp = new Date("2024-01-15T09:15:00");
    const formatted = formatMessageTime(timestamp);

    expect(formatted).toMatch(/09:15 AM/);
  });

  it("should format time correctly for PM hours", () => {
    const timestamp = new Date("2024-01-15T15:45:00");
    const formatted = formatMessageTime(timestamp);

    expect(formatted).toMatch(/03:45 PM/);
  });

  it("should handle midnight time", () => {
    const timestamp = new Date("2024-01-15T00:00:00");
    const formatted = formatMessageTime(timestamp);

    expect(formatted).toMatch(/12:00 AM/);
  });

  it("should handle noon time", () => {
    const timestamp = new Date("2024-01-15T12:00:00");
    const formatted = formatMessageTime(timestamp);

    expect(formatted).toMatch(/12:00 PM/);
  });
});
