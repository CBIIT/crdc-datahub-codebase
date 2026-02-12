import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import ClearButton from "./index";

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<ClearButton onClick={vi.fn()} aria-label="Clear selection" />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { container } = render(<ClearButton onClick={vi.fn()} aria-label="Clear" />);

    expect(container).toBeInTheDocument();
  });

  it("should render the clear button", () => {
    const { getByRole } = render(<ClearButton onClick={vi.fn()} aria-label="Clear" />);

    expect(getByRole("button")).toBeInTheDocument();
  });

  it("should call onClick handler when clicked", async () => {
    const handleClick = vi.fn();
    const { getByRole } = render(<ClearButton onClick={handleClick} aria-label="Clear" />);

    const button = getByRole("button");
    userEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should prevent default behavior on click", async () => {
    const handleClick = vi.fn();
    const { getByRole } = render(<ClearButton onClick={handleClick} aria-label="Clear" />);

    const button = getByRole("button");
    userEvent.click(button);

    expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
    const event = handleClick.mock.calls[0][0];
    expect(event.defaultPrevented).toBe(true);
  });

  it("should render with custom props", () => {
    const { getByRole } = render(<ClearButton onClick={vi.fn()} disabled aria-label="Clear" />);

    const button = getByRole("button");
    expect(button).toBeDisabled();
  });
});
