import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DraggableData } from "react-draggable";

import * as chatUtils from "../utils/chatUtils";

import type { useChatDrawerResult } from "./useChatDrawer";
import { useChatDrawer } from "./useChatDrawer";

vi.mock("../utils/chatUtils", () => ({
  getViewportHeightPx: vi.fn(),
}));

const mockGetViewportHeightPx = vi.mocked(chatUtils.getViewportHeightPx);

const mockDragData = (x: number, y: number): DraggableData => ({
  x,
  y,
  node: null,
  deltaX: 0,
  deltaY: 0,
  lastX: 0,
  lastY: 0,
});

type TestParentProps = {
  onRender?: (hook: useChatDrawerResult) => void;
};

const TestParent = ({ onRender }: TestParentProps) => {
  const hook = useChatDrawer();

  if (onRender) {
    onRender(hook);
  }

  return (
    <div>
      <div data-testid="is-open">{hook.isOpen.toString()}</div>
      <div data-testid="is-expanded">{hook.isExpanded.toString()}</div>
      <div data-testid="drawer-height-px">{String(hook.drawerHeightPx)}</div>
      <div data-testid="drawer-width-px">{String(hook.drawerWidthPx)}</div>
      <div data-testid="drawer-x">{String(hook.drawerX)}</div>
      <div data-testid="drawer-y">{String(hook.drawerY)}</div>
      <button type="button" data-testid="open-drawer" onClick={hook.openDrawer}>
        Open
      </button>
      <button type="button" data-testid="close-drawer" onClick={hook.closeDrawer}>
        Close
      </button>
      <button type="button" data-testid="toggle-expand" onClick={hook.toggleExpand}>
        Toggle
      </button>
    </div>
  );
};

describe("useChatDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetViewportHeightPx.mockReturnValue(800);

    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 768,
      configurable: true,
    });
  });

  describe("Initial State", () => {
    it("should initialize with drawer closed", () => {
      const { getByTestId } = render(<TestParent />);

      expect(getByTestId("is-open").textContent).toBe("false");
    });

    it("should have default dimensions", () => {
      const { getByTestId } = render(<TestParent />);

      expect(getByTestId("drawer-height-px").textContent).toBe("368");
      expect(getByTestId("drawer-width-px").textContent).toBe("400");
    });

    it("should have zero position when closed", () => {
      const { getByTestId } = render(<TestParent />);

      expect(getByTestId("drawer-x").textContent).toBe("0");
      expect(getByTestId("drawer-y").textContent).toBe("0");
    });

    it("should not be expanded", () => {
      const { getByTestId } = render(<TestParent />);

      expect(getByTestId("is-expanded").textContent).toBe("false");
    });

    it("should provide a drawerRef", () => {
      let hookResult: useChatDrawerResult | null = null;

      render(
        <TestParent
          onRender={(hook) => {
            hookResult = hook;
          }}
        />
      );

      expect(hookResult).not.toBeNull();
      expect(hookResult.drawerRef).toBeDefined();
    });
  });

  describe("openDrawer", () => {
    it("should open the drawer", async () => {
      const { getByTestId } = render(<TestParent />);

      userEvent.click(getByTestId("open-drawer"));

      expect(getByTestId("is-open").textContent).toBe("true");
    });

    it("should set default dimensions on open", async () => {
      const { getByTestId } = render(<TestParent />);

      userEvent.click(getByTestId("open-drawer"));

      expect(getByTestId("drawer-height-px").textContent).toBe("368");
      expect(getByTestId("drawer-width-px").textContent).toBe("400");
    });

    it("should compute correct bottom-right aligned position", async () => {
      const { getByTestId } = render(<TestParent />);

      userEvent.click(getByTestId("open-drawer"));

      // viewportHeight=800, viewportWidth=1024, drawerHeight=368, drawerWidth=400
      // floatingButtonCenterFromBottom = 800 * 0.35 = 280
      // bottomOffset = max(0, 280 - 368/2) = max(0, 96) = 96
      // x = 1024 - 400 = 624
      // y = 800 - 368 - 96 = 336
      expect(getByTestId("drawer-x").textContent).toBe("624");
      expect(getByTestId("drawer-y").textContent).toBe("336");
    });

    it("should not change state if already open", async () => {
      const { getByTestId } = render(<TestParent />);

      userEvent.click(getByTestId("open-drawer"));
      const xAfterFirst = getByTestId("drawer-x").textContent;
      const yAfterFirst = getByTestId("drawer-y").textContent;

      userEvent.click(getByTestId("open-drawer"));

      expect(getByTestId("is-open").textContent).toBe("true");
      expect(getByTestId("drawer-x").textContent).toBe(xAfterFirst);
      expect(getByTestId("drawer-y").textContent).toBe(yAfterFirst);
    });
  });

  describe("closeDrawer", () => {
    it("should close the drawer", async () => {
      const { getByTestId } = render(<TestParent />);

      userEvent.click(getByTestId("open-drawer"));
      userEvent.click(getByTestId("close-drawer"));

      expect(getByTestId("is-open").textContent).toBe("false");
    });

    it("should reset dimensions and position on close", async () => {
      const { getByTestId } = render(<TestParent />);

      userEvent.click(getByTestId("open-drawer"));
      userEvent.click(getByTestId("close-drawer"));

      expect(getByTestId("drawer-height-px").textContent).toBe("368");
      expect(getByTestId("drawer-width-px").textContent).toBe("400");
      expect(getByTestId("drawer-x").textContent).toBe("0");
      expect(getByTestId("drawer-y").textContent).toBe("0");
    });

    it("should reset expanded state on close", async () => {
      const { getByTestId } = render(<TestParent />);

      userEvent.click(getByTestId("open-drawer"));
      userEvent.click(getByTestId("toggle-expand"));
      userEvent.click(getByTestId("close-drawer"));

      expect(getByTestId("is-expanded").textContent).toBe("false");
    });

    it("should not change state if already closed", async () => {
      const { getByTestId } = render(<TestParent />);

      const xBefore = getByTestId("drawer-x").textContent;
      const yBefore = getByTestId("drawer-y").textContent;

      await act(async () => {
        getByTestId("close-drawer").click();
      });

      expect(getByTestId("is-open").textContent).toBe("false");
      expect(getByTestId("drawer-x").textContent).toBe(xBefore);
      expect(getByTestId("drawer-y").textContent).toBe(yBefore);
    });
  });

  describe("toggleExpand", () => {
    it("should expand the drawer", async () => {
      const { getByTestId } = render(<TestParent />);

      userEvent.click(getByTestId("open-drawer"));
      userEvent.click(getByTestId("toggle-expand"));

      expect(getByTestId("is-expanded").textContent).toBe("true");
    });

    it("should collapse back to default position", async () => {
      const { getByTestId } = render(<TestParent />);

      userEvent.click(getByTestId("open-drawer"));
      userEvent.click(getByTestId("toggle-expand"));
      userEvent.click(getByTestId("toggle-expand"));

      expect(getByTestId("is-expanded").textContent).toBe("false");
      expect(getByTestId("drawer-height-px").textContent).toBe("368");
      expect(getByTestId("drawer-width-px").textContent).toBe("400");
      expect(getByTestId("drawer-x").textContent).toBe("624");
      expect(getByTestId("drawer-y").textContent).toBe("336");
    });

    it("should not change state if drawer is closed", async () => {
      const { getByTestId } = render(<TestParent />);

      userEvent.click(getByTestId("toggle-expand"));

      expect(getByTestId("is-expanded").textContent).toBe("false");
    });

    it("should set position to right edge when expanding", async () => {
      const { getByTestId } = render(<TestParent />);

      userEvent.click(getByTestId("open-drawer"));
      userEvent.click(getByTestId("toggle-expand"));

      // viewportWidth=1024, expandedWidth=417 → x = 1024 - 417 = 607
      expect(getByTestId("drawer-x").textContent).toBe("607");
      expect(getByTestId("drawer-y").textContent).toBe("0");
    });
  });

  describe("handleDragStop", () => {
    it("should update position on drag stop", () => {
      let hookResult: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            hookResult = hook;
          }}
        />
      );

      act(() => {
        hookResult.openDrawer();
      });

      act(() => {
        hookResult.handleDragStop(null, mockDragData(100, 200));
      });

      expect(getByTestId("drawer-x").textContent).toBe("100");
      expect(getByTestId("drawer-y").textContent).toBe("200");
    });
  });

  describe("handleResizeStop", () => {
    it("should update position and dimensions on resize stop", () => {
      let hookResult: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            hookResult = hook;
          }}
        />
      );

      act(() => {
        hookResult.openDrawer();
      });

      const mockRef = { style: { width: "500px", height: "600px" } } as HTMLElement;

      act(() => {
        hookResult.handleResizeStop(null, null, mockRef, null, { x: 50, y: 100 });
      });

      expect(getByTestId("drawer-x").textContent).toBe("50");
      expect(getByTestId("drawer-y").textContent).toBe("100");
      expect(getByTestId("drawer-width-px").textContent).toBe("500");
      expect(getByTestId("drawer-height-px").textContent).toBe("600");
    });
  });

  describe("viewport resize", () => {
    it("should clamp position when viewport shrinks", () => {
      let hookResult: useChatDrawerResult | null = null;
      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            hookResult = hook;
          }}
        />
      );

      act(() => {
        hookResult.openDrawer();
      });
      act(() => {
        hookResult.handleDragStop(null, mockDragData(800, 500));
      });

      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 600,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 400,
        configurable: true,
      });
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      // maxX = 600 - 400 = 200, maxY = 400 - 368 = 32
      expect(getByTestId("drawer-x").textContent).toBe("200");
      expect(getByTestId("drawer-y").textContent).toBe("32");
    });

    it("should update expanded position on viewport resize", () => {
      let hookResult: useChatDrawerResult | null = null;
      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            hookResult = hook;
          }}
        />
      );

      act(() => {
        hookResult.openDrawer();
      });
      act(() => {
        hookResult.toggleExpand();
      });

      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 800,
        configurable: true,
      });
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      // x = 800 - 417 = 383
      expect(getByTestId("drawer-x").textContent).toBe("383");
      expect(getByTestId("drawer-y").textContent).toBe("0");
    });

    it("should not adjust position when already within bounds", () => {
      let hookResult: useChatDrawerResult | null = null;
      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            hookResult = hook;
          }}
        />
      );

      act(() => {
        hookResult.openDrawer();
      });
      act(() => {
        hookResult.handleDragStop(null, mockDragData(100, 100));
      });

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(getByTestId("drawer-x").textContent).toBe("100");
      expect(getByTestId("drawer-y").textContent).toBe("100");
    });

    it("should remove resize listener when drawer is closed", () => {
      let hookResult: useChatDrawerResult | null = null;
      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            hookResult = hook;
          }}
        />
      );

      act(() => {
        hookResult.openDrawer();
      });
      act(() => {
        hookResult.handleDragStop(null, mockDragData(800, 500));
      });
      act(() => {
        hookResult.closeDrawer();
      });

      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 600,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 400,
        configurable: true,
      });
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(getByTestId("drawer-x").textContent).toBe("0");
      expect(getByTestId("drawer-y").textContent).toBe("0");
    });

    it("should clamp width and height when viewport shrinks below drawer size", () => {
      let hookResult: useChatDrawerResult | null = null;
      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            hookResult = hook;
          }}
        />
      );

      act(() => {
        hookResult.openDrawer();
      });
      act(() => {
        hookResult.handleDragStop(null, mockDragData(0, 0));
      });

      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 350,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 300,
        configurable: true,
      });
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(getByTestId("drawer-width-px").textContent).toBe("350");
      expect(getByTestId("drawer-height-px").textContent).toBe("300");
      expect(getByTestId("drawer-x").textContent).toBe("0");
      expect(getByTestId("drawer-y").textContent).toBe("0");
    });
  });

  describe("function reference stability", () => {
    it("should maintain stable function references across renders", () => {
      const references: useChatDrawerResult[] = [];

      const { rerender } = render(
        <TestParent
          onRender={(hook) => {
            references.push(hook);
          }}
        />
      );

      rerender(
        <TestParent
          onRender={(hook) => {
            references.push(hook);
          }}
        />
      );

      expect(references).toHaveLength(2);
      expect(references[0].openDrawer).toBe(references[1].openDrawer);
      expect(references[0].closeDrawer).toBe(references[1].closeDrawer);
      expect(references[0].toggleExpand).toBe(references[1].toggleExpand);
      expect(references[0].handleDragStop).toBe(references[1].handleDragStop);
      expect(references[0].handleResizeStop).toBe(references[1].handleResizeStop);
    });
  });
});
