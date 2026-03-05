import { describe, expect, it } from "vitest";
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

  it("should render a status container with correct aria-label", () => {
    const { container } = render(<BotTypingIndicator />);

    const statusContainer = container.querySelector('[aria-label="Assistant is typing"]');
    expect(statusContainer).toBeInTheDocument();
    expect(statusContainer).toHaveAttribute("role", "status");
  });

  it("should render the ChatBotLogo", () => {
    const { container } = render(<BotTypingIndicator />);

    const logo = container.querySelector("button");
    expect(logo).toBeInTheDocument();
  });

  it("should render a loading spinner", () => {
    const { container } = render(<BotTypingIndicator />);

    const spinner = container.querySelector('[role="progressbar"]');
    expect(spinner).toBeInTheDocument();
  });
});
