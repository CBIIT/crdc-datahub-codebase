import { createEditor, Transforms } from "slate";

import * as utils from "./editorTransforms";

const createTestEditor = () => {
  const editor = utils.withCustomEditor(createEditor());
  editor.children = [{ type: "paragraph", children: [{ text: "hello" }] }];
  Transforms.select(editor, {
    anchor: { path: [0, 0], offset: 0 },
    focus: { path: [0, 0], offset: 5 },
  });

  return editor;
};

describe("withCustomEditor", () => {
  it("should return an editor with history support", () => {
    const editor = utils.withCustomEditor(createEditor());

    expect(editor.history).toBeDefined();
    expect(editor.history.undos).toEqual([]);
    expect(editor.history.redos).toEqual([]);
  });

  it("should return an editor with React support", () => {
    const editor = utils.withCustomEditor(createEditor());

    expect(editor.insertData).toBeTypeOf("function");
  });
});

describe("isMarkActive", () => {
  it("should return false when no marks are applied", () => {
    const editor = createTestEditor();

    expect(utils.isMarkActive(editor, "bold")).toBe(false);
  });

  it("should return true when the mark is applied", () => {
    const editor = createTestEditor();
    editor.addMark("bold", true);

    expect(utils.isMarkActive(editor, "bold")).toBe(true);
  });

  it("should return false for a different mark", () => {
    const editor = createTestEditor();
    editor.addMark("bold", true);

    expect(utils.isMarkActive(editor, "italic")).toBe(false);
  });
});

describe("toggleMark", () => {
  it("should add a mark when it is not active", () => {
    const editor = createTestEditor();

    utils.toggleMark(editor, "bold");

    expect(utils.isMarkActive(editor, "bold")).toBe(true);
  });

  it("should remove a mark when it is active", () => {
    const editor = createTestEditor();
    editor.addMark("bold", true);

    utils.toggleMark(editor, "bold");

    expect(utils.isMarkActive(editor, "bold")).toBe(false);
  });
});

describe("isBlockActive", () => {
  it("should return true when inside a paragraph", () => {
    const editor = createTestEditor();

    expect(utils.isBlockActive(editor, "paragraph")).toBe(true);
  });

  it("should return false when not inside the given block type", () => {
    const editor = createTestEditor();

    expect(utils.isBlockActive(editor, "bulleted-list")).toBe(false);
  });
});

describe("toggleBlock", () => {
  it("should convert a paragraph to a bulleted list", () => {
    const editor = createTestEditor();

    utils.toggleBlock(editor, "bulleted-list");

    expect(utils.isBlockActive(editor, "bulleted-list")).toBe(true);
    expect(utils.isBlockActive(editor, "list-item")).toBe(true);
  });

  it("should convert a paragraph to a numbered list", () => {
    const editor = createTestEditor();

    utils.toggleBlock(editor, "numbered-list");

    expect(utils.isBlockActive(editor, "numbered-list")).toBe(true);
    expect(utils.isBlockActive(editor, "list-item")).toBe(true);
  });

  it("should convert a bulleted list back to a paragraph", () => {
    const editor = createTestEditor();
    utils.toggleBlock(editor, "bulleted-list");

    utils.toggleBlock(editor, "bulleted-list");

    expect(utils.isBlockActive(editor, "paragraph")).toBe(true);
    expect(utils.isBlockActive(editor, "bulleted-list")).toBe(false);
  });

  it("should switch from bulleted list to numbered list", () => {
    const editor = createTestEditor();
    utils.toggleBlock(editor, "bulleted-list");

    utils.toggleBlock(editor, "numbered-list");

    expect(utils.isBlockActive(editor, "numbered-list")).toBe(true);
    expect(utils.isBlockActive(editor, "bulleted-list")).toBe(false);
  });
});
