import { axe } from "vitest-axe";

import * as FloatingWindowModule from "@/components/FloatingWindow";
import { render } from "@/test-utils";

import MessageItem from "./MessageItem";

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

const message = {
  id: "msg-1",
  text: "Hello **there**",
  timestamp: new Date("2024-01-15T14:30:00"),
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it.each([true, false])("should have no accessibility violations (isUser: %p)", async (isUser) => {
    const { container } = render(<MessageItem message={message} isUser={isUser} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should render own messages as plain text aligned as the user", () => {
    const { container, getByText } = render(<MessageItem message={message} isUser />);

    expect(getByText("Hello **there**")).toBeInTheDocument();
    expect(container.querySelector("strong")).not.toBeInTheDocument();
    expect(container.querySelector('[data-is-user="true"]')).toBeInTheDocument();
  });

  it("should render other participants' messages as markdown", () => {
    const { container } = render(<MessageItem message={message} isUser={false} />);

    expect(container.querySelector("strong")).toHaveTextContent("there");
    expect(container.querySelector('[data-is-user="false"]')).toBeInTheDocument();
  });

  it("should render children only for other participants' messages", () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <MessageItem message={message} isUser={false}>
        <span data-testid="extra" />
      </MessageItem>
    );

    expect(getByTestId("extra")).toBeInTheDocument();

    rerender(
      <MessageItem message={message} isUser>
        <span data-testid="extra" />
      </MessageItem>
    );

    expect(queryByTestId("extra")).not.toBeInTheDocument();
  });

  it("should show the full date only on the first message", () => {
    const { getByText, queryByText, rerender } = render(
      <MessageItem message={message} isUser={false} isFirstMessage />
    );

    expect(getByText("January 15, 2024")).toBeInTheDocument();
    expect(getByText("02:30 PM")).toBeInTheDocument();

    rerender(<MessageItem message={message} isUser={false} />);

    expect(queryByText("January 15, 2024")).not.toBeInTheDocument();
    expect(getByText("02:30 PM")).toBeInTheDocument();
  });

  it("should render nothing when the message is missing", () => {
    const { container } = render(<MessageItem message={null} isUser={false} />);

    expect(container.firstChild).toBeNull();
  });
});
