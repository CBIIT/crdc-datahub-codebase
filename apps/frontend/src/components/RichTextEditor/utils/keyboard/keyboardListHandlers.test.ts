import type { KeyboardEvent } from "react";
import { createEditor, Element, Transforms } from "slate";

import type { CustomEditor } from "../../types";
import { withCustomEditor } from "../editorTransforms";

import * as utils from "./keyboardListHandlers";
import { INDENTATION } from "./keyboardSelectionUtils";

const createKeyboardEvent = (overrides: Partial<KeyboardEvent> = {}): KeyboardEvent =>
  ({
    key: "",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  }) as unknown as KeyboardEvent;

const createTestEditor = (children: CustomEditor["children"]): CustomEditor => {
  const editor = withCustomEditor(createEditor());
  editor.children = children;

  return editor;
};

const createParagraphEditor = (text = "hello"): CustomEditor => {
  const editor = createTestEditor([{ type: "paragraph", children: [{ text }] }]);
  Transforms.select(editor, {
    anchor: { path: [0, 0], offset: text.length },
    focus: { path: [0, 0], offset: text.length },
  });

  return editor;
};

const createListEditor = (
  format: "bulleted-list" | "numbered-list",
  text = "item"
): CustomEditor => {
  const editor = createTestEditor([
    { type: format, children: [{ type: "list-item", children: [{ text }] }] },
  ]);
  Transforms.select(editor, {
    anchor: { path: [0, 0, 0], offset: text.length },
    focus: { path: [0, 0, 0], offset: text.length },
  });

  return editor;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleTabKey", () => {
  it("should return false for non-Tab keys", () => {
    const editor = createParagraphEditor();
    const event = createKeyboardEvent({ key: "Enter" });

    expect(utils.handleTabKey(event, editor)).toBe(false);
  });

  it("should insert indentation on Tab", () => {
    const editor = createParagraphEditor("");
    const event = createKeyboardEvent({ key: "Tab" });

    utils.handleTabKey(event, editor);

    expect(editor.children).toEqual([{ type: "paragraph", children: [{ text: INDENTATION }] }]);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("should outdent a list item on Shift+Tab", () => {
    const editor = createListEditor("bulleted-list");
    const event = createKeyboardEvent({ key: "Tab", shiftKey: true });

    utils.handleTabKey(event, editor);

    expect(editor.children).toEqual([{ type: "paragraph", children: [{ text: "item" }] }]);
  });

  it("should remove indentation from a paragraph on Shift+Tab", () => {
    const editor = createParagraphEditor(INDENTATION);
    const event = createKeyboardEvent({ key: "Tab", shiftKey: true });

    utils.handleTabKey(event, editor);

    expect(editor.children).toEqual([{ type: "paragraph", children: [{ text: "" }] }]);
  });
});

describe("handleEnterOnEmptyListItem", () => {
  it("should return false for non-Enter keys", () => {
    const editor = createListEditor("bulleted-list");
    const event = createKeyboardEvent({ key: "Tab" });

    expect(utils.handleEnterOnEmptyListItem(event, editor)).toBe(false);
  });

  it("should return false when not inside a list item", () => {
    const editor = createParagraphEditor();
    const event = createKeyboardEvent({ key: "Enter" });

    expect(utils.handleEnterOnEmptyListItem(event, editor)).toBe(false);
  });

  it("should return false when list item has text", () => {
    const editor = createListEditor("bulleted-list", "item");
    const event = createKeyboardEvent({ key: "Enter" });

    expect(utils.handleEnterOnEmptyListItem(event, editor)).toBe(false);
  });

  it("should exit list when Enter is pressed on an empty non-first list item", () => {
    const editor = createTestEditor([
      {
        type: "bulleted-list",
        children: [
          { type: "list-item", children: [{ text: "first" }] },
          { type: "list-item", children: [{ text: "" }] },
        ],
      },
    ]);
    Transforms.select(editor, {
      anchor: { path: [0, 1, 0], offset: 0 },
      focus: { path: [0, 1, 0], offset: 0 },
    });
    const event = createKeyboardEvent({ key: "Enter" });

    expect(utils.handleEnterOnEmptyListItem(event, editor)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("should return false when the empty list item is the first item", () => {
    const editor = createTestEditor([
      {
        type: "bulleted-list",
        children: [{ type: "list-item", children: [{ text: "" }] }],
      },
    ]);
    Transforms.select(editor, {
      anchor: { path: [0, 0, 0], offset: 0 },
      focus: { path: [0, 0, 0], offset: 0 },
    });
    const event = createKeyboardEvent({ key: "Enter" });

    expect(utils.handleEnterOnEmptyListItem(event, editor)).toBe(false);
  });
});

describe("handleBackspaceKey", () => {
  it("should return false for non-Backspace keys", () => {
    const editor = createParagraphEditor();
    const event = createKeyboardEvent({ key: "Delete" });

    expect(utils.handleBackspaceKey(event, editor)).toBe(false);
  });

  it("should convert list item to paragraph at start of list item", () => {
    const editor = createListEditor("bulleted-list", "item");
    Transforms.select(editor, {
      anchor: { path: [0, 0, 0], offset: 0 },
      focus: { path: [0, 0, 0], offset: 0 },
    });
    const event = createKeyboardEvent({ key: "Backspace" });

    expect(utils.handleBackspaceKey(event, editor)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("should return false when cursor is not at the start of a block", () => {
    const editor = createParagraphEditor("hello");
    const event = createKeyboardEvent({ key: "Backspace" });

    expect(utils.handleBackspaceKey(event, editor)).toBe(false);
  });

  it("should move cursor to end of previous list when at start of paragraph after a list", () => {
    const editor = createTestEditor([
      {
        type: "bulleted-list",
        children: [{ type: "list-item", children: [{ text: "item" }] }],
      },
      { type: "paragraph", children: [{ text: "after" }] },
    ]);
    Transforms.select(editor, {
      anchor: { path: [1, 0], offset: 0 },
      focus: { path: [1, 0], offset: 0 },
    });
    const event = createKeyboardEvent({ key: "Backspace" });

    expect(utils.handleBackspaceKey(event, editor)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

describe("handleMarkdownListShortcut", () => {
  it("should return false for non-Space keys", () => {
    const editor = createParagraphEditor("-");
    const event = createKeyboardEvent({ key: "a" });

    expect(utils.handleMarkdownListShortcut(event, editor)).toBe(false);
  });

  it("should convert '- ' to a bulleted list", () => {
    const editor = createParagraphEditor("-");
    const event = createKeyboardEvent({ key: " " });

    expect(utils.handleMarkdownListShortcut(event, editor)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();

    const [firstNode] = editor.children;

    expect(Element.isElement(firstNode) && firstNode.type).toBe("bulleted-list");
  });

  it("should convert '1. ' to a numbered list", () => {
    const editor = createParagraphEditor("1.");
    const event = createKeyboardEvent({ key: " " });

    expect(utils.handleMarkdownListShortcut(event, editor)).toBe(true);

    const [firstNode] = editor.children;

    expect(Element.isElement(firstNode) && firstNode.type).toBe("numbered-list");
  });

  it("should return false for unrecognized prefixes", () => {
    const editor = createParagraphEditor("hello");
    const event = createKeyboardEvent({ key: " " });

    expect(utils.handleMarkdownListShortcut(event, editor)).toBe(false);
  });
});

describe("handleRichTextEditorKeyDown", () => {
  it("should not throw for unhandled keys", () => {
    const editor = createParagraphEditor();
    const event = createKeyboardEvent({ key: "a" });

    expect(() => utils.handleRichTextEditorKeyDown(event, editor)).not.toThrow();
  });

  it("should delegate Tab to handleTabKey", () => {
    const editor = createParagraphEditor("");
    const event = createKeyboardEvent({ key: "Tab" });

    utils.handleRichTextEditorKeyDown(event, editor);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(editor.children).toEqual([{ type: "paragraph", children: [{ text: INDENTATION }] }]);
  });
});
