import { act } from "@testing-library/react";
import { createEditor } from "slate";
import { withHistory } from "slate-history";
import { withReact, ReactEditor } from "slate-react";

import { renderHook } from "@/test-utils";

import { useLinkPopup } from "./useLinkPopup";

vi.mock("slate-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("slate-react")>();
  return {
    ...actual,
    ReactEditor: {
      ...actual.ReactEditor,
      focus: vi.fn(),
      toSlateNode: vi.fn(() => ({
        type: "link",
        url: "https://google.com",
        children: [{ text: "Google" }],
      })),
      findPath: vi.fn(() => [0, 1]),
    },
  };
});

const createTestEditor = () => withHistory(withReact(createEditor()));

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not throw when initialized", () => {
    expect(() => renderHook(() => useLinkPopup(createTestEditor()))).not.toThrow();
  });
  it("should return the initial closed state", () => {
    const { result } = renderHook(() => useLinkPopup(createTestEditor()));

    expect(result.current.state.open).toBe(false);
    expect(result.current.state.mode).toBe("edit");
    expect(result.current.state.text).toBe("");
    expect(result.current.state.url).toBe("");
    expect(result.current.state.error).toBe("");
    expect(result.current.state.linkPath).toBeNull();
  });

  it("should open from toolbar in edit mode", () => {
    const editor = createTestEditor();
    const { result } = renderHook(() => useLinkPopup(editor));

    const anchor = document.createElement("button");

    act(() => {
      result.current.openFromToolbar(anchor);
    });

    expect(result.current.state.open).toBe(true);
    expect(result.current.state.mode).toBe("edit");
    expect(result.current.state.anchorElement).toBe(anchor);
    expect(result.current.state.linkPath).toBeNull();
  });

  it("should open from link in view mode", () => {
    const editor = createTestEditor();
    const { result } = renderHook(() => useLinkPopup(editor));

    const anchor = document.createElement("a");

    act(() => {
      result.current.openFromLink(anchor);
    });

    expect(result.current.state.open).toBe(true);
    expect(result.current.state.mode).toBe("view");
    expect(result.current.state.text).toBe("Google");
    expect(result.current.state.url).toBe("https://google.com");
    expect(result.current.state.linkPath).toEqual([0, 1]);
  });

  it("should switch to edit mode with startEditing", () => {
    const editor = createTestEditor();
    const { result } = renderHook(() => useLinkPopup(editor));

    const anchor = document.createElement("a");

    act(() => {
      result.current.openFromLink(anchor);
    });

    act(() => {
      result.current.startEditing();
    });

    expect(result.current.state.mode).toBe("edit");
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update text state with setText", () => {
    const editor = createTestEditor();
    const { result } = renderHook(() => useLinkPopup(editor));

    const anchor = document.createElement("button");

    act(() => {
      result.current.openFromToolbar(anchor);
    });

    act(() => {
      result.current.setText("Hello");
    });

    expect(result.current.state.text).toBe("Hello");
  });

  it("should update url state and clear error with setUrl", () => {
    const editor = createTestEditor();
    const { result } = renderHook(() => useLinkPopup(editor));

    const anchor = document.createElement("button");

    act(() => {
      result.current.openFromToolbar(anchor);
    });

    act(() => {
      result.current.setUrl("google.com");
    });

    expect(result.current.state.url).toBe("google.com");
    expect(result.current.state.error).toBe("");
  });

  it("should set error when saving with an invalid URL", () => {
    const editor = createTestEditor();
    const { result } = renderHook(() => useLinkPopup(editor));

    const anchor = document.createElement("button");

    act(() => {
      result.current.openFromToolbar(anchor);
    });

    act(() => {
      result.current.setUrl("not a url");
    });

    act(() => {
      result.current.save();
    });

    expect(result.current.state.error).toBe("Please enter a valid URL.");
  });

  it("should close and only set open to false without resetting mode", () => {
    const editor = createTestEditor();
    const { result } = renderHook(() => useLinkPopup(editor));

    const anchor = document.createElement("a");

    act(() => {
      result.current.openFromLink(anchor);
    });

    expect(result.current.state.mode).toBe("view");

    act(() => {
      result.current.close();
    });

    expect(result.current.state.open).toBe(false);
    expect(result.current.state.mode).toBe("view");
    expect(ReactEditor.focus).toHaveBeenCalled();
  });

  it("should fully reset state with resetAfterClose when not open", () => {
    const editor = createTestEditor();
    const { result } = renderHook(() => useLinkPopup(editor));

    const anchor = document.createElement("a");

    act(() => {
      result.current.openFromLink(anchor);
    });

    act(() => {
      result.current.close();
    });

    act(() => {
      result.current.resetAfterClose();
    });

    expect(result.current.state.open).toBe(false);
    expect(result.current.state.mode).toBe("edit");
    expect(result.current.state.text).toBe("");
    expect(result.current.state.url).toBe("");
    expect(result.current.state.linkPath).toBeNull();
  });

  it("should not reset state with resetAfterClose when still open", () => {
    const editor = createTestEditor();
    const { result } = renderHook(() => useLinkPopup(editor));

    const anchor = document.createElement("a");

    act(() => {
      result.current.openFromLink(anchor);
    });

    act(() => {
      result.current.resetAfterClose();
    });

    expect(result.current.state.open).toBe(true);
    expect(result.current.state.mode).toBe("view");
    expect(result.current.state.text).toBe("Google");
  });
});
