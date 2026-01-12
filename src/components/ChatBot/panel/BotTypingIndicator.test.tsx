import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import BotTypingIndicator from "./BotTypingIndicator";

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<BotTypingIndicator />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
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
});
