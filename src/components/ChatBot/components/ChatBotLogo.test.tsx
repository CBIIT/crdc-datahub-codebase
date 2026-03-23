import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import ChatBotLogo from "./ChatBotLogo";

describe("Accessibility", () => {
  it("should have no accessibility violations with default props", async () => {
    const { container } = render(<ChatBotLogo ariaLabel="Chat assistant logo" />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations with floating variant", async () => {
    const { container } = render(
      <ChatBotLogo variant="floating" ariaLabel="Chat assistant logo" />
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations when clickable", async () => {
    const { container } = render(<ChatBotLogo onClick={vi.fn()} ariaLabel="Open chat assistant" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() => render(<ChatBotLogo />)).not.toThrow();
  });

  it("should render with square variant by default", () => {
    const { getByRole } = render(<ChatBotLogo ariaLabel="Logo" />);

    const button = getByRole("button", { name: "Logo" });
    expect(button).toBeInTheDocument();
  });

  it("should render with floating variant", () => {
    const { getByRole } = render(<ChatBotLogo variant="floating" ariaLabel="Logo" />);

    const button = getByRole("button", { name: "Logo" });
    expect(button).toBeInTheDocument();
  });

  it("should be disabled when no onClick handler is provided", () => {
    const { getByRole } = render(<ChatBotLogo ariaLabel="Logo" />);

    const button = getByRole("button", { name: "Logo" });
    expect(button).toBeDisabled();
  });

  it("should be enabled when onClick handler is provided", () => {
    const { getByRole } = render(<ChatBotLogo onClick={vi.fn()} ariaLabel="Logo" />);

    const button = getByRole("button", { name: "Logo" });
    expect(button).not.toBeDisabled();
  });

  it("should call onClick when clicked", async () => {
    const handleClick = vi.fn();
    const { getByRole } = render(<ChatBotLogo onClick={handleClick} ariaLabel="Logo" />);

    const button = getByRole("button", { name: "Logo" });
    userEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should apply aria-label correctly", () => {
    const { getByRole } = render(<ChatBotLogo ariaLabel="Test Label" />);

    expect(getByRole("button", { name: "Test Label" })).toBeInTheDocument();
  });

  it("should render without animation by default", () => {
    const { container } = render(<ChatBotLogo ariaLabel="Logo" />);

    const button = container.querySelector("button");
    expect(button).toBeInTheDocument();
  });

  it("should render with animation when animated prop is true", () => {
    const { container } = render(<ChatBotLogo animated ariaLabel="Logo" />);

    const button = container.querySelector("button");
    expect(button).toBeInTheDocument();
  });

  it("should accept animated prop without crashing", () => {
    expect(() => render(<ChatBotLogo animated />)).not.toThrow();
    expect(() => render(<ChatBotLogo animated={false} />)).not.toThrow();
  });
});
