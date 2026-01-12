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
    const { container } = render(<ChatMessageItem message={message} />);

    const allDivs = container.querySelectorAll('div[data-is-user="false"]');
    const messageBubble = allDivs[allDivs.length - 1];
    const paragraph = messageBubble?.querySelector("p");
    expect(paragraph?.textContent).toContain("Line 1");
    expect(paragraph?.textContent).toContain("Line 2");
    expect(paragraph?.textContent).toContain("Line 3");
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

describe("Markdown Formatting", () => {
  it("should render markdown bold text for bot messages", () => {
    const message = createMockMessage({ text: "This is **bold** text", sender: "bot" });
    const { container } = render(<ChatMessageItem message={message} />);

    const strongElement = container.querySelector("strong");
    expect(strongElement).toBeInTheDocument();
    expect(strongElement?.textContent).toBe("bold");
  });

  it("should render markdown italic text for bot messages", () => {
    const message = createMockMessage({ text: "This is *italic* text", sender: "bot" });
    const { container } = render(<ChatMessageItem message={message} />);

    const emElement = container.querySelector("em");
    expect(emElement).toBeInTheDocument();
    expect(emElement?.textContent).toBe("italic");
  });

  it("should render markdown links for bot messages", () => {
    const message = createMockMessage({
      text: "Check [this link](https://example.com)",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const linkElement = container.querySelector("a");
    expect(linkElement).toBeInTheDocument();
    expect(linkElement?.textContent).toBe("this link");
    expect(linkElement?.getAttribute("href")).toBe("https://example.com");
  });

  it("should render markdown lists for bot messages", () => {
    const message = createMockMessage({
      text: "Items:\n- Item 1\n- Item 2\n- Item 3",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const listItems = container.querySelectorAll("li");
    expect(listItems).toHaveLength(3);
    expect(listItems[0].textContent).toBe("Item 1");
    expect(listItems[1].textContent).toBe("Item 2");
    expect(listItems[2].textContent).toBe("Item 3");
  });

  it("should render markdown code blocks for bot messages", () => {
    const message = createMockMessage({
      text: "Here is code: `const x = 5;`",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const codeElement = container.querySelector("code");
    expect(codeElement).toBeInTheDocument();
    expect(codeElement?.textContent).toBe("const x = 5;");
  });

  it("should render markdown headings for bot messages", () => {
    const message = createMockMessage({ text: "## Heading 2", sender: "bot" });
    const { container } = render(<ChatMessageItem message={message} />);

    const headingElement = container.querySelector("h2");
    expect(headingElement).toBeInTheDocument();
    expect(headingElement?.textContent).toBe("Heading 2");
  });

  it("should NOT render markdown for user messages", () => {
    const message = createMockMessage({ text: "This is **bold** text", sender: "user" });
    const { container, getByText } = render(<ChatMessageItem message={message} />);

    const strongElement = container.querySelector("strong");
    expect(strongElement).not.toBeInTheDocument();

    expect(getByText("This is **bold** text")).toBeInTheDocument();
  });

  it("should NOT render markdown links for user messages", () => {
    const message = createMockMessage({
      text: "Check [this link](https://example.com)",
      sender: "user",
    });
    const { container, getByText } = render(<ChatMessageItem message={message} />);

    const linkElement = container.querySelector("a");
    expect(linkElement).not.toBeInTheDocument();

    expect(getByText("Check [this link](https://example.com)")).toBeInTheDocument();
  });

  it("should render multiple markdown elements together for bot messages", () => {
    const message = createMockMessage({
      text: "**Bold** and *italic* with [link](https://example.com)",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    expect(container.querySelector("strong")).toBeInTheDocument();
    expect(container.querySelector("em")).toBeInTheDocument();
    expect(container.querySelector("a")).toBeInTheDocument();
  });

  it("should render markdown paragraphs for bot messages", () => {
    const message = createMockMessage({
      text: "Paragraph 1\n\nParagraph 2",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
  });

  it("should render markdown tables for bot messages", () => {
    const message = createMockMessage({
      text: "| Column 1 | Column 2 |\n|----------|----------|\n| Data 1   | Data 2   |",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();

    const headers = container.querySelectorAll("th");
    expect(headers.length).toBeGreaterThanOrEqual(2);

    const cells = container.querySelectorAll("td");
    expect(cells.length).toBeGreaterThanOrEqual(2);
  });

  it("should render markdown images for bot messages", () => {
    const message = createMockMessage({
      text: "![Alt text](https://example.com/image.jpg)",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute("src")).toBe("https://example.com/image.jpg");
    expect(img?.getAttribute("alt")).toBe("Alt text");
  });

  it("should render markdown horizontal rules for bot messages", () => {
    const message = createMockMessage({
      text: "Before\n\n---\n\nAfter",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const hr = container.querySelector("hr");
    expect(hr).toBeInTheDocument();
  });

  it("should render markdown strikethrough for bot messages", () => {
    const message = createMockMessage({
      text: "This is ~~deleted~~ text",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const del = container.querySelector("del");
    expect(del).toBeInTheDocument();
    expect(del?.textContent).toBe("deleted");
  });

  it("should render markdown blockquotes for bot messages", () => {
    const message = createMockMessage({
      text: "> This is a quote",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const blockquote = container.querySelector("blockquote");
    expect(blockquote).toBeInTheDocument();
  });

  it("should render code blocks with pre tags for bot messages", () => {
    const message = createMockMessage({
      text: "```\nconst x = 5;\nconst y = 10;\n```",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();

    const code = pre?.querySelector("code");
    expect(code).toBeInTheDocument();
  });

  it("should render ordered lists for bot messages", () => {
    const message = createMockMessage({
      text: "Steps:\n1. First step\n2. Second step\n3. Third step",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const ol = container.querySelector("ol");
    expect(ol).toBeInTheDocument();

    const listItems = ol?.querySelectorAll("li");
    expect(listItems?.length).toBe(3);
  });

  it("should render task lists with checkboxes for bot messages", () => {
    const message = createMockMessage({
      text: "Tasks:\n- [ ] Unchecked task\n- [x] Completed task\n- [ ] Another task",
      sender: "bot",
    });
    const { container } = render(<ChatMessageItem message={message} />);

    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    expect(checkboxes.length).toBe(3);

    expect(checkboxes[1]).toBeChecked();
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
  });
});
