import { Editor, Element, Node, Path, Point, Range, Transforms } from "slate";

import type { CustomEditor, CustomText, LinkElement } from "../types";

import { isLinkElement } from "./editorGuards";
import { findTrailingUrl, readUrl } from "./linkUrlUtils";

/**
 * Creates a Slate link element for the given URL.
 *
 * @param {string} url - The link URL.
 * @param {CustomText[]} [children] - Optional text children for the link.
 * @returns {LinkElement} A link element node.
 *
 * @example
 * createLinkElement("https://g.co"); // { type: "link", url: "https://g.co", children: [] }
 */
export const createLinkElement = (url: string, children: CustomText[] = []): LinkElement => ({
  type: "link",
  url,
  children,
});

/**
 * Checks whether any part of the given range touches a link element.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {Range} at - The range to inspect.
 * @returns {boolean} `true` when the range overlaps a link element.
 */
const hasLinkAt = (editor: CustomEditor, at: Range): boolean => {
  const [linkEntry] = Editor.nodes(editor, { at, match: isLinkElement });

  return Boolean(linkEntry);
};

/**
 * Inserts a link element at the current selection, replacing any selected
 * content, and moves the cursor just past the inserted link.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {string} text - The visible link text.
 * @param {string} url - The canonical link URL.
 * @returns {void}
 *
 * @example
 * insertLink(editor, "Google", "https://google.com");
 */
export const insertLink = (editor: CustomEditor, text: string, url: string): void => {
  if (editor.selection && hasLinkAt(editor, editor.selection)) {
    return;
  }

  Transforms.insertNodes(editor, createLinkElement(url, [{ text }]), { select: true });
  Transforms.collapse(editor, { edge: "end" });
  Transforms.move(editor, { distance: 1, unit: "offset" });
};

/**
 * Replaces an existing link element with updated text and URL.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {Path} linkPath - The path of the link element to replace.
 * @param {string} text - The updated visible link text.
 * @param {string} url - The updated canonical link URL.
 * @returns {void}
 */
export const updateLink = (
  editor: CustomEditor,
  linkPath: Path,
  text: string,
  url: string
): void => {
  const [linkNode] = Editor.node(editor, linkPath);
  const existingText = Node.string(linkNode);
  const children: CustomText[] =
    existingText === text && isLinkElement(linkNode)
      ? (linkNode.children as CustomText[])
      : [{ text }];

  Editor.withoutNormalizing(editor, () => {
    Transforms.removeNodes(editor, { at: linkPath });
    Transforms.insertNodes(editor, createLinkElement(url, children), {
      at: linkPath,
      select: true,
    });
  });

  Transforms.collapse(editor, { edge: "end" });
  Transforms.move(editor, { distance: 1, unit: "offset" });
};

/**
 * Unwraps the link element at the given path back into plain text.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {Path} linkPath - The path of the link element to unwrap.
 * @returns {void}
 */
export const removeLink = (editor: CustomEditor, linkPath: Path): void => {
  Transforms.unwrapNodes(editor, { at: linkPath, match: isLinkElement });
};

/**
 * Gets the point the given number of characters before another point, staying
 * put when the distance is zero.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {Point} point - The reference point.
 * @param {number} distance - The number of characters to step back.
 * @returns {Point} The resulting point.
 */
const getPointBefore = (editor: CustomEditor, point: Point, distance: number): Point => {
  if (distance === 0) {
    return point;
  }

  return Editor.before(editor, point, { distance, unit: "character" }) ?? point;
};

/**
 * Prevent typing after links from extending the link.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {Point} cursor - The collapsed cursor position.
 * @returns {void}
 */
const moveCursorOffLinkEdge = (editor: CustomEditor, cursor: Point): void => {
  const [linkEntry] = Editor.nodes(editor, { match: isLinkElement });

  if (!linkEntry) {
    return;
  }

  const [, linkPath] = linkEntry;
  const linkEnd = Editor.end(editor, linkPath);

  if (Point.equals(cursor, linkEnd)) {
    Transforms.select(editor, Editor.after(editor, linkEnd) ?? cursor);
    return;
  }

  const linkStart = Editor.start(editor, linkPath);

  if (!Point.equals(cursor, linkStart)) {
    return;
  }

  Transforms.select(editor, Editor.before(editor, linkStart) ?? cursor);
};

/**
 * Wraps a URL the user just finished typing into a link element. Examines the
 * text between the start of the current block and the cursor, skipping the
 * given number of just-typed trailing characters (e.g. the space that
 * completed the URL).
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {number} trailingCharacters - Characters before the cursor to exclude from the URL.
 * @returns {void}
 */
const applyAutoLink = (editor: CustomEditor, trailingCharacters: number): void => {
  const { selection } = editor;

  if (!selection || !Range.isCollapsed(selection)) {
    return;
  }

  const blockEntry = Editor.above(editor, {
    match: (node) => Element.isElement(node) && Editor.isBlock(editor, node),
  });

  if (!blockEntry) {
    return;
  }

  const blockStart = Editor.start(editor, blockEntry[1]);
  const textBeforeCursor = Editor.string(editor, { anchor: blockStart, focus: selection.anchor });
  const match = findTrailingUrl(
    textBeforeCursor.slice(0, textBeforeCursor.length - trailingCharacters)
  );

  if (!match) {
    return;
  }

  const linkStart = Editor.before(editor, selection.anchor, {
    distance: textBeforeCursor.length - match.index,
    unit: "character",
  });

  if (!linkStart) {
    return;
  }

  const linkRange: Range = {
    anchor: linkStart,
    focus: getPointBefore(editor, selection.anchor, trailingCharacters),
  };

  if (hasLinkAt(editor, linkRange)) {
    return;
  }

  Transforms.wrapNodes(editor, createLinkElement(match.url), { at: linkRange, split: true });
};

/**
 * Adds link behavior to the editor: marks links as inline nodes, converts URLs
 * typed before a space or line break into links, converts pasted URLs into
 * links, keeps text typed at a link's edges from extending the link, and
 * removes link elements that no longer contain text.
 *
 * @param {CustomEditor} editor - The Slate editor instance to enhance.
 * @returns {CustomEditor} The enhanced editor.
 *
 * @example
 * const editor = withLinks(withHistory(withReact(createEditor())));
 */
export const withLinks = (editor: CustomEditor): CustomEditor => {
  const { insertBreak, insertData, insertText, isInline, normalizeNode } = editor;

  editor.isInline = (element) => isLinkElement(element) || isInline(element);

  editor.insertText = (text, options) => {
    const { selection } = editor;
    const isCollapsed = selection && Range.isCollapsed(selection);

    if (!isCollapsed) {
      insertText(text, options);
      return;
    }

    moveCursorOffLinkEdge(editor, selection.anchor);
    insertText(text, options);

    const isSingleWhitespace = text.length === 1 && /\s/.test(text);

    if (!isSingleWhitespace) {
      return;
    }

    applyAutoLink(editor, 1);
  };

  editor.insertBreak = () => {
    applyAutoLink(editor, 0);
    insertBreak();
  };

  editor.insertData = (data) => {
    const pastedText = data.getData("text/plain").trim();
    const pastedUrl = readUrl(pastedText);

    if (!pastedUrl || !editor.selection || hasLinkAt(editor, editor.selection)) {
      insertData(data);
      return;
    }

    insertLink(editor, pastedText, pastedUrl);
  };

  editor.normalizeNode = (entry) => {
    const [node, path] = entry;

    if (isLinkElement(node) && Node.string(node) === "") {
      Transforms.removeNodes(editor, { at: path });
      return;
    }

    normalizeNode(entry);
  };

  return editor;
};
