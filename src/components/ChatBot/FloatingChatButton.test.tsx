import { act } from "@testing-library/react";
import { axe } from "vitest-axe";

import { render } from "@/test-utils";

import chatConfig from "./config/chatConfig";
import FloatingChatButton from "./FloatingChatButton";

const { initialDelayMs, showDurationMs, sessionKey } = chatConfig.floatingButton;

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

describe("Slide Animation Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("should expand after initial delay when not previously shown", async () => {
    const { getByText } = render(<FloatingChatButton {...defaultProps} />);

    expect(getByText("Chat")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(initialDelayMs);
    });

    expect(sessionStorage.getItem(sessionKey)).toBe("true");
  });

  it("should collapse after show duration", async () => {
    const { getByRole } = render(<FloatingChatButton {...defaultProps} />);

    await act(async () => {
      vi.advanceTimersByTime(initialDelayMs);
    });
    expect(sessionStorage.getItem(sessionKey)).toBe("true");

    await act(async () => {
      vi.advanceTimersByTime(showDurationMs);
    });

    const button = getByRole("button");
    expect(button).toHaveStyle({ maxWidth: "69px" });
  });

  it("should not expand if already shown in session", async () => {
    sessionStorage.setItem(sessionKey, "true");

    const { getByRole } = render(<FloatingChatButton {...defaultProps} />);

    await act(async () => {
      vi.advanceTimersByTime(initialDelayMs + showDurationMs);
    });

    const button = getByRole("button");
    expect(button).toHaveStyle({ maxWidth: "69px" });
  });

  it("should clean up timers on unmount", async () => {
    const { unmount } = render(<FloatingChatButton {...defaultProps} />);

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(initialDelayMs + showDurationMs);
    });
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
  });
});
