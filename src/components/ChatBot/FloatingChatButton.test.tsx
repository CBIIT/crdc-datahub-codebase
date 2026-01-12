import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import FloatingChatButton from "./FloatingChatButton";

const defaultProps = {
  label: "Chat",
  onClick: vi.fn(),
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have no accessibility violations", async () => {
    const { container } = render(<FloatingChatButton {...defaultProps} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render without crashing", () => {
    expect(() => render(<FloatingChatButton {...defaultProps} />)).not.toThrow();
  });

  it("should display the label text", () => {
    const { getByText } = render(<FloatingChatButton {...defaultProps} label="Help" />);

    expect(getByText("Help")).toBeInTheDocument();
  });

  it("should render the chat icon", () => {
    const { container } = render(<FloatingChatButton {...defaultProps} />);

    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  it("should call onClick when button is clicked", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<FloatingChatButton {...defaultProps} onClick={onClick} />);

    const button = getByRole("button");
    button.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should call onClick with event when clicked", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<FloatingChatButton {...defaultProps} onClick={onClick} />);

    const button = getByRole("button");
    button.click();

    expect(onClick).toHaveBeenCalledWith(expect.any(Object));
  });

  it("should not call onClick when not clicked", () => {
    const onClick = vi.fn();
    render(<FloatingChatButton {...defaultProps} onClick={onClick} />);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("should handle multiple clicks", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<FloatingChatButton {...defaultProps} onClick={onClick} />);

    const button = getByRole("button");
    button.click();
    button.click();
    button.click();

    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("should update label when prop changes", () => {
    const { rerender, getByText, queryByText } = render(
      <FloatingChatButton {...defaultProps} label="Chat" />
    );

    expect(getByText("Chat")).toBeInTheDocument();

    rerender(<FloatingChatButton {...defaultProps} label="Help" />);

    expect(getByText("Help")).toBeInTheDocument();
    expect(queryByText("Chat")).not.toBeInTheDocument();
  });

  it("should render with different label values", () => {
    const { getByText } = render(<FloatingChatButton {...defaultProps} label="Ask a Question" />);

    expect(getByText("Ask a Question")).toBeInTheDocument();
  });

  it("should handle empty string label", () => {
    const { getByRole } = render(<FloatingChatButton {...defaultProps} label="" />);

    expect(getByRole("button")).toBeInTheDocument();
  });

  it("should handle long label text", () => {
    const longLabel = "This is a very long label that might need to wrap";
    const { getByText } = render(<FloatingChatButton {...defaultProps} label={longLabel} />);

    expect(getByText(longLabel)).toBeInTheDocument();
  });

  it("should be a button element", () => {
    const { getByRole } = render(<FloatingChatButton {...defaultProps} />);

    const button = getByRole("button");
    expect(button.tagName).toBe("BUTTON");
  });

  it("should render label and icon together", () => {
    const { getByText, container } = render(
      <FloatingChatButton {...defaultProps} label="Support" />
    );

    expect(getByText("Support")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
