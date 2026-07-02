import { act } from "@testing-library/react";
import type { Descendant } from "slate";

import { renderHook } from "@/test-utils";

import { useRichTextEditor } from "./useRichTextEditor";

vi.mock("../utils/markdown/markdownDeserializer", () => ({
  deserializeFromMarkdown: vi.fn((): Descendant[] => [
    { type: "paragraph", children: [{ text: "deserialized" }] },
  ]),
}));

vi.mock("../utils/markdown/markdownSerializer", () => ({
  serializeToMarkdown: vi.fn(() => "serialized"),
  getPlainTextLength: vi.fn(() => 10),
}));

vi.mock("../utils/keyboard/keyboardListHandlers", () => ({
  handleRichTextEditorKeyDown: vi.fn(),
}));

const defaultProps = {
  value: "initial",
  onChange: vi.fn(),
};

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should not throw when initialized", () => {
    expect(() => renderHook(() => useRichTextEditor(defaultProps))).not.toThrow();
  });

  it("should return an editor instance", () => {
    const { result } = renderHook(() => useRichTextEditor(defaultProps));

    expect(result.current.editor).toBeDefined();
  });

  it("should return the deserialized initial value", () => {
    const { result } = renderHook(() => useRichTextEditor(defaultProps));

    expect(result.current.initialValue).toEqual([
      { type: "paragraph", children: [{ text: "deserialized" }] },
    ]);
  });

  it("should return renderElement as a function", () => {
    const { result } = renderHook(() => useRichTextEditor(defaultProps));

    expect(result.current.renderElement).toBeTypeOf("function");
  });

  it("should return renderLeaf as a function", () => {
    const { result } = renderHook(() => useRichTextEditor(defaultProps));

    expect(result.current.renderLeaf).toBeTypeOf("function");
  });

  it("should return handleKeyDown as a function", () => {
    const { result } = renderHook(() => useRichTextEditor(defaultProps));

    expect(result.current.handleKeyDown).toBeTypeOf("function");
  });

  it("should return reset as a function", () => {
    const { result } = renderHook(() => useRichTextEditor(defaultProps));

    expect(result.current.reset).toBeTypeOf("function");
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should call onChange with serialized markdown when handleChange is called", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useRichTextEditor({ ...defaultProps, onChange }));

    act(() => {
      result.current.handleChange([{ type: "paragraph", children: [{ text: "new" }] }]);
    });

    expect(onChange).toHaveBeenCalledWith("serialized");
  });

  it("should call onTextLengthChange when provided", () => {
    const onTextLengthChange = vi.fn();
    const { result } = renderHook(() => useRichTextEditor({ ...defaultProps, onTextLengthChange }));

    act(() => {
      result.current.handleChange([{ type: "paragraph", children: [{ text: "hello" }] }]);
    });

    expect(onTextLengthChange).toHaveBeenCalled();
  });

  it("should not throw when onTextLengthChange is not provided", () => {
    const { result } = renderHook(() => useRichTextEditor(defaultProps));

    expect(() => {
      act(() => {
        result.current.handleChange([{ type: "paragraph", children: [{ text: "hello" }] }]);
      });
    }).not.toThrow();
  });

  it("should reset the editor to an empty document", () => {
    const { result } = renderHook(() => useRichTextEditor(defaultProps));

    act(() => {
      result.current.reset();
    });

    expect(result.current.editor.children).toEqual([
      { type: "paragraph", children: [{ text: "" }] },
    ]);
  });

  it("should clear undo/redo history on reset", () => {
    const { result } = renderHook(() => useRichTextEditor(defaultProps));

    act(() => {
      result.current.reset();
    });

    expect(result.current.editor.history.undos).toEqual([]);
    expect(result.current.editor.history.redos).toEqual([]);
  });
});
