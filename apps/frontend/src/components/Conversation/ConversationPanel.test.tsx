import { axe } from "vitest-axe";

import * as FloatingWindowModule from "@/components/FloatingWindow";
import { render } from "@/test-utils";

import ConversationPanel from "./ConversationPanel";

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
  isExpanded: false,
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
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should have no accessibility violations", async () => {
    const { container } = render(
      <ConversationPanel>
        <p>Content</p>
      </ConversationPanel>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFloatingWindowContext.mockReturnValue(defaultContext);
  });

  it("should render children directly when not fullscreen", () => {
    const { container, getByText } = render(
      <ConversationPanel>
        <p>Content</p>
      </ConversationPanel>
    );

    expect(getByText("Content")).toBeInTheDocument();
    expect(container.querySelector(".MuiContainer-root")).not.toBeInTheDocument();
  });

  it("should wrap children in a centered container when fullscreen", () => {
    mockUseFloatingWindowContext.mockReturnValue({ ...defaultContext, isFullscreen: true });

    const { container, getByText } = render(
      <ConversationPanel>
        <p>Content</p>
      </ConversationPanel>
    );

    expect(container.querySelector(".MuiContainer-maxWidthMd")).toContainElement(
      getByText("Content")
    );
  });
});
