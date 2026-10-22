import { createEditor, Editor, Transforms } from "slate";
import { withReact } from "slate-react";

import type { CustomEditor, LinkElement, ParagraphElement } from "../types";

import * as utils from "./linkEditorUtils";

const createTestEditor = (): CustomEditor => {
  const editor = utils.withLinks(withReact(createEditor()) as CustomEditor);
  editor.children = [{ type: "paragraph", children: [{ text: "" }] }];

  return editor;
};

const createEditorWithLink = (
  leadingText = "see ",
  trailingText = " after",
  url = "https://google.com"
): CustomEditor => {
  const editor = createTestEditor();
  editor.children = [
    {
      type: "paragraph",
      children: [
        { text: leadingText },
        { type: "link", url, children: [{ text: "google.com" }] },
        { text: trailingText },
      ],
    },
  ];

  return editor;
};

const createPasteData = (text: string): DataTransfer =>
  ({ getData: (format: string) => (format === "text/plain" ? text : "") }) as DataTransfer;

const getParagraphChildren = (editor: CustomEditor) =>
  (editor.children[0] as ParagraphElement).children;

const getLastChild = (editor: CustomEditor) => {
  const children = getParagraphChildren(editor);

  return children[children.length - 1];
};

const getLinks = (editor: CustomEditor): LinkElement[] =>
  getParagraphChildren(editor).filter(
    (child): child is LinkElement => "type" in child && child.type === "link"
  );

describe("createLinkElement", () => {
  it("should create a link element with the given URL", () => {
    expect(utils.createLinkElement("https://g.co")).toEqual({
      type: "link",
      url: "https://g.co",
      children: [],
    });
  });

  it("should create a link element with the given children", () => {
    expect(utils.createLinkElement("https://g.co", [{ text: "Google" }])).toEqual({
      type: "link",
      url: "https://g.co",
      children: [{ text: "Google" }],
    });
  });
});

describe("insertLink", () => {
  it("should insert a link at the cursor", () => {
    const editor = createTestEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "see " }] }];
    Transforms.select(editor, { path: [0, 0], offset: 4 });

    utils.insertLink(editor, "Google", "https://google.com");

    expect(getLinks(editor)).toEqual([
      { type: "link", url: "https://google.com", children: [{ text: "Google" }] },
    ]);
  });

  it("should replace the selected content with the link", () => {
    const editor = createTestEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "replace me" }] }];
    Transforms.select(editor, {
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: 10 },
    });

    utils.insertLink(editor, "Google", "https://google.com");

    expect(Editor.string(editor, [0])).toBe("Google");
    expect(getLinks(editor)).toHaveLength(1);
  });

  it("should place the cursor after the inserted link", () => {
    const editor = createTestEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "see " }] }];
    Transforms.select(editor, { path: [0, 0], offset: 4 });

    utils.insertLink(editor, "Google", "https://google.com");
    editor.insertText("!");

    expect(Editor.string(editor, [0])).toBe("see Google!");
    expect(getLinks(editor)[0].children).toEqual([{ text: "Google" }]);
  });
});

describe("updateLink", () => {
  it("should replace the text and URL of an existing link", () => {
    const editor = createEditorWithLink();

    utils.updateLink(editor, [0, 1], "Search", "https://duckduckgo.com");

    expect(getLinks(editor)).toEqual([
      { type: "link", url: "https://duckduckgo.com", children: [{ text: "Search" }] },
    ]);
  });

  it("should keep the surrounding text intact", () => {
    const editor = createEditorWithLink();

    utils.updateLink(editor, [0, 1], "Search", "https://duckduckgo.com");

    expect(Editor.string(editor, [0])).toBe("see Search after");
  });

  it("should not create an additional link", () => {
    const editor = createEditorWithLink();

    utils.updateLink(editor, [0, 1], "Search", "https://duckduckgo.com");

    expect(getLinks(editor)).toHaveLength(1);
  });
});

describe("removeLink", () => {
  it("should unwrap the link into plain text", () => {
    const editor = createEditorWithLink();

    utils.removeLink(editor, [0, 1]);

    expect(getLinks(editor)).toHaveLength(0);
  });

  it("should keep the link text in the document", () => {
    const editor = createEditorWithLink();

    utils.removeLink(editor, [0, 1]);

    expect(Editor.string(editor, [0])).toBe("see google.com after");
  });
});

describe("withLinks", () => {
  it("should treat link elements as inline", () => {
    const editor = createTestEditor();

    expect(editor.isInline(utils.createLinkElement("https://g.co"))).toBe(true);
  });

  it("should not treat other elements as inline", () => {
    const editor = createTestEditor();

    expect(editor.isInline({ type: "paragraph", children: [{ text: "" }] })).toBe(false);
  });

  it("should convert a URL into a link when a space is typed after it", () => {
    const editor = createTestEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "check google.com" }] }];
    Transforms.select(editor, { path: [0, 0], offset: 16 });

    editor.insertText(" ");

    expect(getLinks(editor)).toEqual([
      { type: "link", url: "https://google.com", children: [{ text: "google.com" }] },
    ]);
  });

  it("should keep the typed space outside of the new link", () => {
    const editor = createTestEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "check google.com" }] }];
    Transforms.select(editor, { path: [0, 0], offset: 16 });

    editor.insertText(" ");

    expect(getLastChild(editor)).toEqual({ text: " " });
  });

  it("should convert a URL into a link when a line break is inserted after it", () => {
    const editor = createTestEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "check google.com" }] }];
    Transforms.select(editor, { path: [0, 0], offset: 16 });

    editor.insertBreak();

    expect(getLinks(editor)).toHaveLength(1);
    expect(editor.children).toHaveLength(2);
  });

  it("should not create a link from plain text", () => {
    const editor = createTestEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "hello world" }] }];
    Transforms.select(editor, { path: [0, 0], offset: 11 });

    editor.insertText(" ");

    expect(getLinks(editor)).toHaveLength(0);
  });

  it("should not create a link from an unsafe scheme", () => {
    const editor = createTestEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "run javascript:alert(1)" }] }];
    Transforms.select(editor, { path: [0, 0], offset: 23 });

    editor.insertText(" ");

    expect(getLinks(editor)).toHaveLength(0);
  });

  it("should not create a link when the URL is not the last word", () => {
    const editor = createTestEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "google.com was down" }] }];
    Transforms.select(editor, { path: [0, 0], offset: 19 });

    editor.insertText(" ");

    expect(getLinks(editor)).toHaveLength(0);
  });

  it("should not re-link text that is already a link", () => {
    const editor = createEditorWithLink("see ", "");
    Transforms.select(editor, Editor.end(editor, [0]));

    editor.insertText(" ");

    expect(getLinks(editor)).toHaveLength(1);
  });

  it("should convert a pasted URL into a link", () => {
    const editor = createTestEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "see " }] }];
    Transforms.select(editor, { path: [0, 0], offset: 4 });

    editor.insertData(createPasteData("npmjs.com"));

    expect(getLinks(editor)).toEqual([
      { type: "link", url: "https://npmjs.com", children: [{ text: "npmjs.com" }] },
    ]);
  });

  it("should paste plain text without creating a link", () => {
    const editor = createTestEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "see " }] }];
    Transforms.select(editor, { path: [0, 0], offset: 4 });

    editor.insertData(createPasteData("just words"));

    expect(getLinks(editor)).toHaveLength(0);
    expect(Editor.string(editor, [0])).toBe("see just words");
  });

  it("should not create a nested link when pasting into an existing link", () => {
    const editor = createEditorWithLink();
    Transforms.select(editor, { path: [0, 1, 0], offset: 3 });

    editor.insertData(createPasteData("npmjs.com"));

    expect(getLinks(editor)).toHaveLength(1);
  });

  it("should type text after a link outside of the link", () => {
    const editor = createEditorWithLink();
    Transforms.select(editor, Editor.end(editor, [0, 1]));

    editor.insertText("x");

    expect(getLinks(editor)[0].children).toEqual([{ text: "google.com" }]);
    expect(Editor.string(editor, [0])).toBe("see google.comx after");
  });

  it("should type text before a link outside of the link", () => {
    const editor = createEditorWithLink();
    Transforms.select(editor, Editor.start(editor, [0, 1]));

    editor.insertText("x");

    expect(getLinks(editor)[0].children).toEqual([{ text: "google.com" }]);
    expect(Editor.string(editor, [0])).toBe("see xgoogle.com after");
  });

  it("should type text inside a link when the cursor is not on an edge", () => {
    const editor = createEditorWithLink();
    Transforms.select(editor, { path: [0, 1, 0], offset: 6 });

    editor.insertText("X");

    expect(getLinks(editor)[0].children).toEqual([{ text: "googleX.com" }]);
  });

  it("should remove a link element that no longer contains text", () => {
    const editor = createTestEditor();
    editor.children = [
      {
        type: "paragraph",
        children: [
          { text: "a" },
          { type: "link", url: "https://g.co", children: [{ text: "" }] },
          { text: "b" },
        ],
      },
    ];

    Editor.normalize(editor, { force: true });

    expect(getLinks(editor)).toHaveLength(0);
    expect(Editor.string(editor, [0])).toBe("ab");
  });
});
