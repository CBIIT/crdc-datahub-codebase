import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import * as FloatingWindowModule from "@/components/FloatingWindow";
import { render } from "@/test-utils";

import MessageComposer from "./MessageComposer";

vi.mock("@/components/FloatingWindow", () => ({
  useFloatingWindowContext: vi.fn(),
}));

const mockUseFloatingWindowContext = vi.mocked(FloatingWindowModule.useFloatingWindowContext);

const defaultContext = {
  config: {
    height: { collapsed: 368, min: 368 },
    width: { default: 400, min: 400, expanded: 420 },
  },
  isFullscreen: false,
  windowRef: { current: null },
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
  openWindow: vi.fn(),
  isConfirmingClose: false,
  onRequestClose: vi.fn(),
  onConfirmClose: vi.fn(),
  onCancelClose: vi.fn(),
};

const defaultProps = {
  value: "",
  onChange: vi.fn(),
  onSend: vi.fn(),
  onKeyDown: vi.fn(),
  isSendDisabled: false,
  maxLength: 5,
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should have no accessibility violations", async () => {
    const { container } = render(<MessageComposer {...defaultProps} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should use the default placeholder as the input label", () => {
    const { getByRole } = render(<MessageComposer {...defaultProps} />);

    expect(getByRole("textbox", { name: "Type your message..." })).toHaveAttribute(
      "placeholder",
      "Type your message..."
    );
  });

  it("should use a custom placeholder as the input label", () => {
    const { getByRole } = render(
      <MessageComposer {...defaultProps} placeholder="Message CRDC staff" />
    );

    expect(getByRole("textbox", { name: "Message CRDC staff" })).toBeInTheDocument();
  });

  it("should display the provided value in the input", () => {
    const { getByRole } = render(<MessageComposer {...defaultProps} value="Hello" />);

    expect(getByRole("textbox")).toHaveValue("Hello");
  });

  it("should call onKeyDown when a key is pressed in the input", async () => {
    const { getByRole } = render(<MessageComposer {...defaultProps} />);

    await userEvent.type(getByRole("textbox"), "{Enter}");

    expect(defaultProps.onKeyDown).toHaveBeenCalled();
  });

  it("should call onChange for input within maxLength", () => {
    const { getByRole } = render(<MessageComposer {...defaultProps} />);

    fireEvent.change(getByRole("textbox"), { target: { value: "12345" } });

    expect(defaultProps.onChange).toHaveBeenCalledWith("12345");
  });

  it("should ignore input longer than maxLength", () => {
    const { getByRole } = render(<MessageComposer {...defaultProps} />);

    fireEvent.change(getByRole("textbox"), { target: { value: "123456" } });

    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  it("should call onSend when the send button is clicked", async () => {
    const { getByRole } = render(<MessageComposer {...defaultProps} />);

    await userEvent.click(getByRole("button", { name: "Send message" }));

    expect(defaultProps.onSend).toHaveBeenCalledTimes(1);
  });

  it("should disable the send button when isSendDisabled is true", () => {
    const { getByRole } = render(<MessageComposer {...defaultProps} isSendDisabled />);

    expect(getByRole("button", { name: "Send message" })).toBeDisabled();
  });
});
