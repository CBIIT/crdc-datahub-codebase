import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import CopyTextButton from "./index";

const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe("Accessibility", () => {
  it("should not have any violations (with title)", async () => {
    const { container } = render(<CopyTextButton title="Copy me" copyText="hello world" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have any violations (no title)", async () => {
    const { container } = render(<CopyTextButton copyText="hello world" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the copy button with correct aria-label", () => {
    const { getByTestId } = render(
      <CopyTextButton title="Copy me" copyText="foo" aria-label="Copy-text-aria-label" />
    );
    const btn = getByTestId("copy-text-button");
    expect(btn).toBeInTheDocument();
    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute("aria-label", "Copy-text-aria-label");
  });

  it("should copy the text to clipboard and call onCopy when clicked", async () => {
    const onCopy = vi.fn();
    const { getByTestId } = render(
      <CopyTextButton title="Copy me" copyText="12345" onCopy={onCopy} />
    );

    userEvent.click(getByTestId("copy-text-button"));
    expect(mockWriteText).toHaveBeenCalledWith("12345");
    expect(onCopy).toHaveBeenCalledWith("12345");
  });

  it("should not copy or call onCopy when copyText is empty or whitespace", async () => {
    const onCopy = vi.fn();
    const { getByTestId } = render(
      <CopyTextButton title="Copy me" copyText="   " onCopy={onCopy} />
    );

    userEvent.click(getByTestId("copy-text-button"));
    expect(mockWriteText).not.toHaveBeenCalled();
    expect(onCopy).not.toHaveBeenCalled();
  });

  it("should disable the button when disabled prop is true", () => {
    const onCopy = vi.fn();
    const { getByTestId } = render(
      <CopyTextButton title="Copy me" copyText="foo" disabled onCopy={onCopy} />
    );

    const btn = getByTestId("copy-text-button");
    expect(btn).toBeDisabled();
  });

  it("should not copy or call onCopy when disabled", async () => {
    const onCopy = vi.fn();
    const { getByTestId } = render(<CopyTextButton copyText="abc" disabled onCopy={onCopy} />);

    expect(getByTestId("copy-text-button")).toBeDisabled();
    expect(mockWriteText).not.toHaveBeenCalled();
    expect(onCopy).not.toHaveBeenCalled();
  });
});
