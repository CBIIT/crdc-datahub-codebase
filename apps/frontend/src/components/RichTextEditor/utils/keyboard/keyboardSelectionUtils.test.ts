import { createEditor, Transforms } from "slate";

import { withCustomEditor } from "../editorTransforms";

import * as utils from "./keyboardSelectionUtils";

const createParagraphEditor = (text = "hello") => {
  const editor = withCustomEditor(createEditor());
  editor.children = [{ type: "paragraph", children: [{ text }] }];
  Transforms.select(editor, {
    anchor: { path: [0, 0], offset: text.length },
    focus: { path: [0, 0], offset: text.length },
  });

  return editor;
};

describe("getCollapsedSelection", () => {
  it("should return the selection when collapsed", () => {
    const editor = createParagraphEditor();

    const result = utils.getCollapsedSelection(editor);

    expect(result).not.toBeNull();
    expect(result).toEqual(editor.selection);
  });

  it("should return null when no selection exists", () => {
    const editor = withCustomEditor(createEditor());
    editor.children = [{ type: "paragraph", children: [{ text: "hello" }] }];

    expect(utils.getCollapsedSelection(editor)).toBeNull();
  });

  it("should return null when the selection is expanded", () => {
    const editor = createParagraphEditor();
    Transforms.select(editor, {
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: 5 },
    });

    expect(utils.getCollapsedSelection(editor)).toBeNull();
  });
});

describe("getFirstElementEntry", () => {
  it("should return the entry for a matching block type", () => {
    const editor = createParagraphEditor();

    const result = utils.getFirstElementEntry(editor, "paragraph");

    expect(result).toBeDefined();
    expect(result[0].type).toBe("paragraph");
  });

  it("should return undefined when no matching block exists", () => {
    const editor = createParagraphEditor();

    expect(utils.getFirstElementEntry(editor, "bulleted-list")).toBeUndefined();
  });

  it("should return the first match when multiple exist", () => {
    const editor = withCustomEditor(createEditor());
    editor.children = [
      { type: "paragraph", children: [{ text: "first" }] },
      { type: "paragraph", children: [{ text: "second" }] },
    ];
    Transforms.select(editor, {
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: 0 },
    });

    const result = utils.getFirstElementEntry(editor, "paragraph");

    expect(result).toBeDefined();
    expect(result[1]).toEqual([0]);
  });
});

describe("getCurrentListFormat", () => {
  it("should return 'bulleted-list' when inside a bulleted list", () => {
    const editor = withCustomEditor(createEditor());
    editor.children = [
      { type: "bulleted-list", children: [{ type: "list-item", children: [{ text: "item" }] }] },
    ];
    Transforms.select(editor, {
      anchor: { path: [0, 0, 0], offset: 0 },
      focus: { path: [0, 0, 0], offset: 0 },
    });

    expect(utils.getCurrentListFormat(editor)).toBe("bulleted-list");
  });

  it("should return 'numbered-list' when inside a numbered list", () => {
    const editor = withCustomEditor(createEditor());
    editor.children = [
      { type: "numbered-list", children: [{ type: "list-item", children: [{ text: "item" }] }] },
    ];
    Transforms.select(editor, {
      anchor: { path: [0, 0, 0], offset: 0 },
      focus: { path: [0, 0, 0], offset: 0 },
    });

    expect(utils.getCurrentListFormat(editor)).toBe("numbered-list");
  });

  it("should default to 'numbered-list' when not inside any list", () => {
    const editor = createParagraphEditor();

    expect(utils.getCurrentListFormat(editor)).toBe("numbered-list");
  });
});

describe("removeCharactersBeforeCursor", () => {
  it("should remove the specified number of characters before the cursor", () => {
    const editor = createParagraphEditor("hello");

    utils.removeCharactersBeforeCursor(editor, 3);

    expect(editor.children).toEqual([{ type: "paragraph", children: [{ text: "he" }] }]);
  });

  it("should remove all characters when distance equals text length", () => {
    const editor = createParagraphEditor("hi");

    utils.removeCharactersBeforeCursor(editor, 2);

    expect(editor.children).toEqual([{ type: "paragraph", children: [{ text: "" }] }]);
  });
});

describe("getPreviousSiblingPath", () => {
  it("should return the previous sibling path", () => {
    expect(utils.getPreviousSiblingPath([0, 2])).toEqual([0, 1]);
  });

  it("should return null for the first child", () => {
    expect(utils.getPreviousSiblingPath([0, 0])).toBeNull();
  });

  it("should return null for a single-segment path at index 0", () => {
    expect(utils.getPreviousSiblingPath([0])).toBeNull();
  });

  it("should decrement only the last segment", () => {
    expect(utils.getPreviousSiblingPath([1, 3, 5])).toEqual([1, 3, 4]);
  });
});
