import { act, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as chatUtils from "../utils/chatUtils";

import type { useChatDrawerResult } from "./useChatDrawer";
import { useChatDrawer } from "./useChatDrawer";

vi.mock("../utils/chatUtils", () => ({
  computeNextHeightPx: vi.fn(),
  getViewportHeightPx: vi.fn(),
}));

const mockComputeNextHeightPx = vi.mocked(chatUtils.computeNextHeightPx);
const mockGetViewportHeightPx = vi.mocked(chatUtils.getViewportHeightPx);

const dispatchPointerEvent = (type: string, options: PointerEventInit = {}): void => {
  act(() => {
    const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
    Object.defineProperty(event, "clientX", { value: options.clientX ?? 0 });
    Object.defineProperty(event, "clientY", { value: options.clientY ?? 0 });
    Object.defineProperty(event, "pointerId", { value: options.pointerId ?? 0 });
    Object.defineProperty(event, "pointerType", { value: options.pointerType ?? "mouse" });
    window.dispatchEvent(event);
  });
};

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
      <div data-testid="is-dragging">{hook.isDragging.toString()}</div>
      <div data-testid="is-expanded">{hook.isExpanded.toString()}</div>
      <div data-testid="drawer-height-px">{String(hook.drawerHeightPx)}</div>
      <div data-testid="drawer-width-px">{String(hook.drawerWidthPx)}</div>
      <div data-testid="drawer-position-x">{String(hook.drawerPositionX)}</div>
      <div data-testid="drawer-position-y">{String(hook.drawerPositionY)}</div>
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
    mockComputeNextHeightPx.mockReturnValue({
      heightPx: 500,
      viewportHeightPx: 800,
    });

    // Mock requestAnimationFrame to execute synchronously for predictable tests
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(performance.now());
      return 0;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

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

      expect(getByTestId("is-open")).toHaveTextContent("false");
    });

    it("should initialize with isDragging as false", () => {
      const { getByTestId } = render(<TestParent />);

      expect(getByTestId("is-dragging")).toHaveTextContent("false");
    });

    it("should initialize with isExpanded as false", () => {
      const { getByTestId } = render(<TestParent />);

      expect(getByTestId("is-expanded")).toHaveTextContent("false");
    });

    it("should initialize with default collapsed height", () => {
      const { getByTestId } = render(<TestParent />);

      expect(getByTestId("drawer-height-px")).toHaveTextContent("368");
    });

    it("should provide a drawer ref", () => {
      let capturedHook: useChatDrawerResult | null = null;

      render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      expect(capturedHook.drawerRef).toBeDefined();
      expect(capturedHook.drawerRef.current).toBeNull();
    });
  });

  describe("openDrawer", () => {
    it("should open the drawer", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });
    });

    it("should reset drawer state when opening", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-dragging")).toHaveTextContent("false");
        expect(getByTestId("is-expanded")).toHaveTextContent("false");
        expect(getByTestId("drawer-height-px")).toHaveTextContent("368");
      });
    });

    it("should be idempotent when drawer is already open", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const stateBefore = {
        isOpen: getByTestId("is-open").textContent,
        isDragging: getByTestId("is-dragging").textContent,
        isExpanded: getByTestId("is-expanded").textContent,
        drawerHeightPx: getByTestId("drawer-height-px").textContent,
      };

      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent(stateBefore.isOpen);
        expect(getByTestId("is-dragging")).toHaveTextContent(stateBefore.isDragging);
        expect(getByTestId("is-expanded")).toHaveTextContent(stateBefore.isExpanded);
        expect(getByTestId("drawer-height-px")).toHaveTextContent(stateBefore.drawerHeightPx);
      });
    });
  });

  describe("closeDrawer", () => {
    it("should close the drawer", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const closeButton = getByTestId("close-drawer");
      userEvent.click(closeButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("false");
      });
    });

    it("should reset dragging state when closing", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const event = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(event);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      const closeButton = getByTestId("close-drawer");
      userEvent.click(closeButton);

      await waitFor(() => {
        expect(getByTestId("is-dragging")).toHaveTextContent("false");
      });
    });

    it("should reset height to collapsed when closing", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const toggleButton = getByTestId("toggle-expand");
      userEvent.click(toggleButton);

      await waitFor(() => {
        expect(getByTestId("is-expanded")).toHaveTextContent("true");
      });

      const closeButton = getByTestId("close-drawer");
      userEvent.click(closeButton);

      await waitFor(() => {
        expect(getByTestId("drawer-height-px")).toHaveTextContent("368");
        expect(getByTestId("is-expanded")).toHaveTextContent("false");
      });
    });

    it("should be idempotent when drawer is already closed", async () => {
      const { getByTestId } = render(<TestParent />);

      const closeButton = getByTestId("close-drawer");
      userEvent.click(closeButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("false");
      });
    });
  });

  describe("toggleExpand", () => {
    it("should expand drawer when collapsed", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const toggleButton = getByTestId("toggle-expand");
      userEvent.click(toggleButton);

      await waitFor(() => {
        expect(getByTestId("is-expanded")).toHaveTextContent("true");
        expect(getByTestId("drawer-height-px")).toHaveTextContent("800");
      });
    });

    it("should collapse drawer when expanded", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const toggleButton = getByTestId("toggle-expand");
      userEvent.click(toggleButton);

      await waitFor(() => {
        expect(getByTestId("is-expanded")).toHaveTextContent("true");
      });

      userEvent.click(toggleButton);

      await waitFor(() => {
        expect(getByTestId("is-expanded")).toHaveTextContent("false");
        expect(getByTestId("drawer-height-px")).toHaveTextContent("368");
      });
    });

    it("should not toggle when drawer is closed", async () => {
      const { getByTestId } = render(<TestParent />);

      const toggleButton = getByTestId("toggle-expand");
      userEvent.click(toggleButton);

      await waitFor(() => {
        expect(getByTestId("is-expanded")).toHaveTextContent("false");
        expect(getByTestId("drawer-height-px")).toHaveTextContent("368");
      });
    });

    it("should call getViewportHeightPx when toggling", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const toggleButton = getByTestId("toggle-expand");
      userEvent.click(toggleButton);

      await waitFor(() => {
        expect(mockGetViewportHeightPx).toHaveBeenCalledWith(368);
      });
    });
  });

  describe("drag_ended", () => {
    it("should be idempotent when not dragging", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      await waitFor(() => {
        dispatchPointerEvent("pointerup", {
          pointerId: 1,
        });
      });

      await waitFor(() => {
        expect(getByTestId("is-dragging")).toHaveTextContent("false");
      });

      await waitFor(() => {
        dispatchPointerEvent("pointerup", {
          pointerId: 1,
        });
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("false");
    });
  });

  describe("beginResize", () => {
    it("should start dragging on left mouse button", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const event = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(event);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("should not start dragging on right mouse button", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const event = {
        pointerType: "mouse",
        button: 2,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(event);
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("false");
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("should start dragging on touch input", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const event = {
        pointerType: "touch",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(event);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });
    });

    it("should not start dragging when drawer is closed", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const event = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(event);
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("false");
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("should start dragging with pen input", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const event = {
        pointerType: "pen",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(event);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });
    });
  });

  describe("Window Pointer Events", () => {
    it("should handle endDrag when not dragging", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      await waitFor(() => {
        dispatchPointerEvent("pointerup", {
          pointerId: 1,
        });
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("false");
    });

    it("should handle window pointermove during drag", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const mockElement = document.createElement("div");
      Object.defineProperty(capturedHook.drawerRef, "current", {
        value: mockElement,
        writable: true,
      });

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
      });

      await waitFor(() => {
        dispatchPointerEvent("pointermove", {
          clientY: 300,
          pointerId: 1,
        });
      });

      await waitFor(() => {
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });
    });

    it("should not handle pointermove when not dragging", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      await waitFor(() => {
        dispatchPointerEvent("pointermove", {
          clientY: 300,
          pointerId: 1,
        });
      });

      expect(mockComputeNextHeightPx).not.toHaveBeenCalled();
    });

    it("should ignore pointermove from different pointer", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const mockElement = document.createElement("div");
      Object.defineProperty(capturedHook.drawerRef, "current", {
        value: mockElement,
        writable: true,
      });

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
      });

      await waitFor(() => {
        dispatchPointerEvent("pointermove", {
          clientY: 300,
          pointerId: 2,
        });
      });

      expect(mockComputeNextHeightPx).not.toHaveBeenCalled();
    });

    it("should end drag on window pointerup", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      await waitFor(() => {
        dispatchPointerEvent("pointerup", {
          pointerId: 1,
        });
      });

      await waitFor(() => {
        expect(getByTestId("is-dragging")).toHaveTextContent("false");
      });
    });

    it("should end drag on window pointercancel", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      await waitFor(() => {
        dispatchPointerEvent("pointercancel", {
          pointerId: 1,
        });
      });

      await waitFor(() => {
        expect(getByTestId("is-dragging")).toHaveTextContent("false");
      });
    });

    it("should not end drag on pointerup from different pointer", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      await waitFor(() => {
        dispatchPointerEvent("pointerup", {
          pointerId: 2,
        });
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("true");
    });

    it("should cleanup window event listeners on unmount", () => {
      const { unmount } = render(<TestParent onRender={() => {}} />);

      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("pointercancel", expect.any(Function));
    });
  });

  describe("Height Changes", () => {
    it("should start resize operation correctly", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const mockElement = document.createElement("div");
      Object.defineProperty(capturedHook.drawerRef, "current", {
        value: mockElement,
        writable: true,
      });

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
        expect(getByTestId("drawer-height-px")).toHaveTextContent("368");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 575,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
      });

      await waitFor(() => {
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });
    });

    it("should not auto-expand when dragging to max height", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const mockElement = document.createElement("div");
      Object.defineProperty(capturedHook.drawerRef, "current", {
        value: mockElement,
        writable: true,
      });

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 485,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
      });

      await waitFor(() => {
        dispatchPointerEvent("pointermove", {
          clientY: 10,
          pointerId: 1,
        });
      });

      await waitFor(() => {
        expect(getByTestId("is-expanded")).toHaveTextContent("false");
      });
    });

    it("should set isExpanded to false when not near max height", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const mockElement = document.createElement("div");
      Object.defineProperty(capturedHook.drawerRef, "current", {
        value: mockElement,
        writable: true,
      });

      mockComputeNextHeightPx.mockReturnValue({
        heightPx: 600,
        viewportHeightPx: 800,
      });

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
      });

      await waitFor(() => {
        dispatchPointerEvent("pointermove", {
          clientY: 200,
          pointerId: 1,
        });
      });

      await waitFor(() => {
        expect(getByTestId("is-expanded")).toHaveTextContent("false");
      });
    });

    it("should not update height when drawerRef is null", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
      });

      const heightBefore = getByTestId("drawer-height-px").textContent;

      await waitFor(() => {
        dispatchPointerEvent("pointermove", {
          clientY: 200,
          pointerId: 1,
        });
      });

      expect(mockComputeNextHeightPx).not.toHaveBeenCalled();
      expect(getByTestId("drawer-height-px")).toHaveTextContent(heightBefore);
    });
  });

  describe("Edge Cases", () => {
    it("should handle unknown action types", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const closeButton = getByTestId("close-drawer");
      userEvent.click(closeButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("false");
        expect(getByTestId("is-dragging")).toHaveTextContent("false");
        expect(getByTestId("is-expanded")).toHaveTextContent("false");
        expect(getByTestId("drawer-height-px")).toHaveTextContent("368");
      });
    });

    it("should handle multiple rapid open/close calls", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      const closeButton = getByTestId("close-drawer");

      userEvent.click(openButton);
      userEvent.click(closeButton);
      userEvent.click(openButton);
      userEvent.click(closeButton);
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });
    });

    it("should handle drag when already dragging", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const event1 = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      const event2 = {
        pointerType: "mouse",
        button: 0,
        pointerId: 2,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(event1);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      await waitFor(() => {
        capturedHook.beginResize(event2);
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("true");
    });

    it("should handle toggle expand multiple times", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const toggleButton = getByTestId("toggle-expand");
      userEvent.click(toggleButton);
      userEvent.click(toggleButton);
      userEvent.click(toggleButton);

      await waitFor(() => {
        expect(getByTestId("is-expanded")).toHaveTextContent("true");
      });
    });

    it("should maintain stable function references", () => {
      let capturedHook1: useChatDrawerResult | null = null;
      let capturedHook2: useChatDrawerResult | null = null;

      const { rerender } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook1 = hook;
          }}
        />
      );

      const openDrawerRef1 = capturedHook1.openDrawer;
      const closeDrawerRef1 = capturedHook1.closeDrawer;
      const beginResizeRef1 = capturedHook1.beginResize;
      const toggleExpandRef1 = capturedHook1.toggleExpand;

      rerender(
        <TestParent
          onRender={(hook) => {
            capturedHook2 = hook;
          }}
        />
      );

      expect(capturedHook2.openDrawer).toBe(openDrawerRef1);
      expect(capturedHook2.closeDrawer).toBe(closeDrawerRef1);
      expect(capturedHook2.beginResize).toBe(beginResizeRef1);
      expect(capturedHook2.toggleExpand).toBe(toggleExpandRef1);
    });
  });

  describe("beginMove", () => {
    it("should start move operation on left mouse button", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const event = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginMove(event);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("should not start move on right mouse button", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const event = {
        pointerType: "mouse",
        button: 2,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginMove(event);
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("false");
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("should not start move when drawer is closed", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const event = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginMove(event);
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("false");
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("should start move with touch input", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const event = {
        pointerType: "touch",
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginMove(event);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });
    });
  });

  describe("applyMove", () => {
    it("should dispatch position_changed when move operation invokes pointermove", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 500,
        clientY: 500,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      act(() => {
        capturedHook.beginMove(startEvent);
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("true");

      act(() => {
        const event = new Event("pointermove", { bubbles: true, cancelable: true }) as PointerEvent;
        Object.defineProperty(event, "clientX", { value: 400 });
        Object.defineProperty(event, "clientY", { value: 400 });
        Object.defineProperty(event, "pointerId", { value: 1 });
        Object.defineProperty(event, "pointerType", { value: "mouse" });
        window.dispatchEvent(event);
      });

      const posX = parseInt(getByTestId("drawer-position-x").textContent, 10);
      expect(posX).toBeGreaterThan(0);
    });

    it("should constrain position to viewport bounds", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 500,
        clientY: 500,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginMove(startEvent);
      });

      await waitFor(() => {
        dispatchPointerEvent("pointermove", {
          clientX: -1000,
          clientY: -1000,
          pointerId: 1,
        });
      });

      await waitFor(() => {
        const posX = parseInt(getByTestId("drawer-position-x").textContent, 10);
        const posY = parseInt(getByTestId("drawer-position-y").textContent, 10);
        expect(posX).toBeGreaterThanOrEqual(0);
        expect(posY).toBeGreaterThanOrEqual(0);
      });
    });

    it("should not go below zero position", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginMove(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      dispatchPointerEvent("pointermove", {
        clientX: 1000,
        clientY: 1000,
        pointerId: 1,
      });

      await waitFor(() => {
        expect(getByTestId("drawer-position-x")).toHaveTextContent("0");
        expect(getByTestId("drawer-position-y")).toHaveTextContent("0");
      });
    });

    it("should ignore pointermove from different pointer during move", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 500,
        clientY: 500,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginMove(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      dispatchPointerEvent("pointermove", {
        clientX: 100,
        clientY: 100,
        pointerId: 99,
      });

      expect(getByTestId("drawer-position-x")).toHaveTextContent("0");
      expect(getByTestId("drawer-position-y")).toHaveTextContent("96");
    });
  });

  describe("applyResize width changes", () => {
    it("should update width during resize operation", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const mockElement = document.createElement("div");
      Object.defineProperty(capturedHook.drawerRef, "current", {
        value: mockElement,
        writable: true,
      });

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 500,
        clientY: 500,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      dispatchPointerEvent("pointermove", {
        clientX: 300,
        clientY: 300,
        pointerId: 1,
      });

      await waitFor(() => {
        const width = parseInt(getByTestId("drawer-width-px").textContent, 10);
        expect(width).toBeGreaterThan(400);
      });
    });

    it("should enforce minimum width", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const mockElement = document.createElement("div");
      Object.defineProperty(capturedHook.drawerRef, "current", {
        value: mockElement,
        writable: true,
      });

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      dispatchPointerEvent("pointermove", {
        clientX: 1000,
        clientY: 1000,
        pointerId: 1,
      });

      await waitFor(() => {
        const width = parseInt(getByTestId("drawer-width-px").textContent, 10);
        expect(width).toBeGreaterThanOrEqual(400);
      });
    });

    it("should enforce maximum width based on viewport", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const mockElement = document.createElement("div");
      Object.defineProperty(capturedHook.drawerRef, "current", {
        value: mockElement,
        writable: true,
      });

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 500,
        clientY: 500,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      dispatchPointerEvent("pointermove", {
        clientX: -5000,
        clientY: 0,
        pointerId: 1,
      });

      await waitFor(() => {
        const width = parseInt(getByTestId("drawer-width-px").textContent, 10);

        expect(width).toBeLessThanOrEqual(window.innerWidth);
      });
    });
  });

  describe("reducer position_changed", () => {
    it("should handle position_changed action", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      expect(getByTestId("drawer-position-x")).toHaveTextContent("0");
      expect(getByTestId("drawer-position-y")).toHaveTextContent("96");

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 500,
        clientY: 500,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginMove(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      dispatchPointerEvent("pointermove", {
        clientX: 450,
        clientY: 450,
        pointerId: 1,
      });

      await waitFor(() => {
        expect(getByTestId("drawer-position-x")).toHaveTextContent("50");
        expect(getByTestId("drawer-position-y")).toHaveTextContent("146");
      });
    });
  });

  describe("reducer width_changed", () => {
    it("should handle width_changed action", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const mockElement = document.createElement("div");
      Object.defineProperty(capturedHook.drawerRef, "current", {
        value: mockElement,
        writable: true,
      });

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const initialWidth = getByTestId("drawer-width-px").textContent;
      expect(initialWidth).toBe("400");

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 500,
        clientY: 500,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginResize(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      dispatchPointerEvent("pointermove", {
        clientX: 400,
        clientY: 400,
        pointerId: 1,
      });

      await waitFor(() => {
        const newWidth = parseInt(getByTestId("drawer-width-px").textContent, 10);
        expect(newWidth).toBe(500);
      });
    });
  });

  describe("handleWindowPointerMove move branch", () => {
    it("should call applyMove during move operation", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 600,
        clientY: 600,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      await waitFor(() => {
        capturedHook.beginMove(startEvent);
        expect(getByTestId("is-dragging")).toHaveTextContent("true");
      });

      dispatchPointerEvent("pointermove", {
        clientX: 550,
        clientY: 550,
        pointerId: 1,
      });

      await waitFor(() => {
        expect(getByTestId("drawer-position-x")).toHaveTextContent("50");
        expect(getByTestId("drawer-position-y")).toHaveTextContent("146");
      });
    });

    it("should not apply move when not dragging", async () => {
      const { getByTestId } = render(<TestParent />);

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      await waitFor(() => {
        dispatchPointerEvent("pointermove", {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        });
      });

      expect(getByTestId("drawer-position-x")).toHaveTextContent("0");
      expect(getByTestId("drawer-position-y")).toHaveTextContent("96");
    });
  });

  describe("beginMove function reference stability", () => {
    it("should maintain stable beginMove function reference", () => {
      let capturedHook1: useChatDrawerResult | null = null;
      let capturedHook2: useChatDrawerResult | null = null;

      const { rerender } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook1 = hook;
          }}
        />
      );

      const beginMoveRef1 = capturedHook1.beginMove;

      rerender(
        <TestParent
          onRender={(hook) => {
            capturedHook2 = hook;
          }}
        />
      );

      expect(capturedHook2.beginMove).toBe(beginMoveRef1);
    });
  });

  describe("visibilitychange event", () => {
    it("should end drag when document becomes hidden during drag", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 500,
        clientY: 500,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      act(() => {
        capturedHook.beginMove(startEvent);
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("true");

      // Simulate tab becoming hidden
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("false");

      // Restore hidden property
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
    });

    it("should not end drag when document becomes visible", async () => {
      let capturedHook: useChatDrawerResult | null = null;

      const { getByTestId } = render(
        <TestParent
          onRender={(hook) => {
            capturedHook = hook;
          }}
        />
      );

      const openButton = getByTestId("open-drawer");
      userEvent.click(openButton);

      await waitFor(() => {
        expect(getByTestId("is-open")).toHaveTextContent("true");
      });

      const startEvent = {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 500,
        clientY: 500,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>;

      act(() => {
        capturedHook.beginMove(startEvent);
      });

      expect(getByTestId("is-dragging")).toHaveTextContent("true");

      // Simulate tab becoming visible (document.hidden = false)
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Should still be dragging since document is visible
      expect(getByTestId("is-dragging")).toHaveTextContent("true");

      // Clean up drag state
      dispatchPointerEvent("pointerup", { pointerId: 1 });
    });
  });
});
