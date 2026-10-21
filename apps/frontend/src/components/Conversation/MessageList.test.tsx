import { axe } from "vitest-axe";

import * as FloatingWindowModule from "@/components/FloatingWindow";
import { render } from "@/test-utils";

import MessageList from "./MessageList";

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

describe("Accessibility", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should have no accessibility violations", async () => {
    const { container } = render(
      <MessageList scrollDependencies={[]}>
        <p>Message</p>
      </MessageList>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should render its children", () => {
    const { getByText } = render(
      <MessageList scrollDependencies={[]}>
        <p>Message</p>
      </MessageList>
    );

    expect(getByText("Message")).toBeInTheDocument();
  });

  it("should smooth scroll to the bottom when a scroll dependency changes", () => {
    const { rerender } = render(<MessageList scrollDependencies={["a"]} />);
    vi.mocked(Element.prototype.scrollTo).mockClear();

    rerender(<MessageList scrollDependencies={["b"]} />);

    expect(Element.prototype.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" })
    );
  });

  it("should not scroll when scroll dependencies are unchanged", () => {
    const { rerender } = render(<MessageList scrollDependencies={["a"]} />);
    vi.mocked(Element.prototype.scrollTo).mockClear();

    rerender(<MessageList scrollDependencies={["a"]} />);

    expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
  });

  it("should scroll the grandparent element in fullscreen", () => {
    mockUseFloatingWindowContext.mockReturnValue({ ...defaultContext, isFullscreen: true });

    const { getByTestId } = render(
      <div data-testid="scroll-root">
        <div>
          <MessageList scrollDependencies={[]} />
        </div>
      </div>
    );

    expect(Element.prototype.scrollTo).toHaveBeenCalled();
    expect(vi.mocked(Element.prototype.scrollTo).mock.contexts).toContain(
      getByTestId("scroll-root")
    );
  });
});
