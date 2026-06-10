import type { KeyboardEvent } from "react";
import { Editor, Element, Node, Point, Range, Transforms } from "slate";

import type { CustomEditor, KeyboardHandler, ListFormat } from "../../types";
import { createEmptyDocument } from "../documentUtils";
import { isListElement } from "../editorGuards";
import { toggleBlock } from "../editorTransforms";

import { handleModifierHotkeys } from "./keyboardHotkeyHandlers";
import {
  getCollapsedSelection,
  getCurrentListFormat,
  getFirstElementEntry,
  getPreviousSiblingPath,
  INDENTATION,
  removeCharactersBeforeCursor,
} from "./keyboardSelectionUtils";

/**
 * Determines the number of whitespace characters to remove when outdenting.
 *
 * @param {string} textBeforeCursor - The text content before the cursor position.
 * @returns {number} The number of characters to remove (tab width, single space, or 0).
 */
const getIndentationDistanceToRemove = (textBeforeCursor: string): number => {
  if (textBeforeCursor.endsWith(INDENTATION)) {
    return INDENTATION.length;
  }

  if (textBeforeCursor.endsWith(" ")) {
    return 1;
  }

  return 0;
};

/**
 * Removes leading indentation from a paragraph when Shift+Tab is pressed.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {Range} selection - The current collapsed selection.
 */
const removeParagraphIndentation = (editor: CustomEditor, selection: Range): void => {
  const paragraphEntry = getFirstElementEntry(editor, "paragraph");

  if (!paragraphEntry) {
    return;
  }

  const [, paragraphPath] = paragraphEntry;
  const paragraphStart = Editor.start(editor, paragraphPath);
  const rangeBeforeCursor: Range = { anchor: paragraphStart, focus: selection.focus };
  const textBeforeCursor = Editor.string(editor, rangeBeforeCursor);
  const indentationDistance = getIndentationDistanceToRemove(textBeforeCursor);

  if (indentationDistance === 0) {
    return;
  }

  removeCharactersBeforeCursor(editor, indentationDistance);
};

/**
 * Converts a list item back to a paragraph when Shift+Tab is pressed inside a list.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @returns {boolean} `true` if the list item was outdented, `false` if not inside a list item.
 */
const outdentListItem = (editor: CustomEditor): boolean => {
  const listItemEntry = getFirstElementEntry(editor, "list-item");

  if (!listItemEntry) {
    return false;
  }

  toggleBlock(editor, getCurrentListFormat(editor));
  return true;
};

/**
 * Handles Tab and Shift+Tab indentation behavior.
 *
 * Tab inserts indentation. Shift+Tab outdents a list item or removes
 * leading whitespace from a paragraph.
 *
 * @param {KeyboardEvent} event - The keyboard event to evaluate.
 * @param {CustomEditor} editor - The Slate editor instance.
 * @returns {boolean} `true` if the Tab key was handled, `false` otherwise.
 */
export const handleTabKey = (event: KeyboardEvent, editor: CustomEditor): boolean => {
  if (event.key !== "Tab") {
    return false;
  }

  event.preventDefault();

  if (!event.shiftKey) {
    Transforms.insertText(editor, INDENTATION);
    return true;
  }

  const selection = getCollapsedSelection(editor);

  if (!selection) {
    return true;
  }

  if (outdentListItem(editor)) {
    return true;
  }

  removeParagraphIndentation(editor, selection);
  return true;
};

/**
 * Exits a list when Enter is pressed on an empty list item that is not the first item.
 *
 * @param {KeyboardEvent} event - The keyboard event to evaluate.
 * @param {CustomEditor} editor - The Slate editor instance.
 * @returns {boolean} `true` if the list was exited, `false` otherwise.
 */
export const handleEnterOnEmptyListItem = (event: KeyboardEvent, editor: CustomEditor): boolean => {
  if (event.key !== "Enter") {
    return false;
  }

  const selection = getCollapsedSelection(editor);

  if (!selection) {
    return false;
  }

  const listItemEntry = getFirstElementEntry(editor, "list-item");

  if (!listItemEntry) {
    return false;
  }

  const [listItemNode, listItemPath] = listItemEntry;
  const listItemIsEmpty = Node.string(listItemNode) === "";
  const isFirstItem = listItemPath[listItemPath.length - 1] === 0;
  const shouldExitList = listItemIsEmpty && !isFirstItem;

  if (!shouldExitList) {
    return false;
  }

  event.preventDefault();
  toggleBlock(editor, getCurrentListFormat(editor));
  return true;
};

/**
 * Moves the cursor to the end of a previous sibling list when Backspace is pressed
 * at the start of a paragraph that follows a list.
 *
 * @param {KeyboardEvent} event - The keyboard event to evaluate.
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {Range} selection - The current collapsed selection.
 * @returns {boolean} `true` if the cursor was moved, `false` otherwise.
 */
const moveCursorToEndOfPreviousList = (
  event: KeyboardEvent,
  editor: CustomEditor,
  selection: Range
): boolean => {
  const paragraphEntry = getFirstElementEntry(editor, "paragraph");

  if (!paragraphEntry) {
    return false;
  }

  const [, paragraphPath] = paragraphEntry;
  const paragraphStart = Editor.start(editor, paragraphPath);

  if (!Point.equals(selection.focus, paragraphStart)) {
    return false;
  }

  const previousPath = getPreviousSiblingPath(paragraphPath);

  if (!previousPath || !Node.has(editor, previousPath)) {
    return false;
  }

  const previousNode = Node.get(editor, previousPath);

  if (!isListElement(previousNode)) {
    return false;
  }

  event.preventDefault();

  const paragraphIsEmpty = Node.string(paragraphEntry[0]) === "";

  if (paragraphIsEmpty) {
    Transforms.removeNodes(editor, { at: paragraphPath });
  }

  const lastListItemPath = [...previousPath, previousNode.children.length - 1];
  Transforms.select(editor, Editor.end(editor, lastListItemPath));
  return true;
};

/**
 * Converts a list item to a paragraph when Backspace is pressed at the start of a list item.
 *
 * @param {KeyboardEvent} event - The keyboard event to evaluate.
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {Range} selection - The current collapsed selection.
 * @returns {boolean} `true` if the list item was converted, `false` otherwise.
 */
const convertListItemToParagraph = (
  event: KeyboardEvent,
  editor: CustomEditor,
  selection: Range
): boolean => {
  const listItemEntry = getFirstElementEntry(editor, "list-item");

  if (!listItemEntry) {
    return false;
  }

  const [, listItemPath] = listItemEntry;
  const listItemStart = Editor.start(editor, listItemPath);

  if (!Point.equals(selection.focus, listItemStart)) {
    return false;
  }

  event.preventDefault();
  toggleBlock(editor, getCurrentListFormat(editor));
  return true;
};

/**
 * Ensures an empty editor is represented as a single empty paragraph.
 * This prevents clearing the editor from leaving it in an invalid empty state with no nodes.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @returns {void}
 */
const normalizeEmptyEditorToParagraph = (editor: CustomEditor): void => {
  const firstNode = editor.children[0];
  const isSingleEmptyParagraph =
    editor.children.length === 1 &&
    Element.isElement(firstNode) &&
    firstNode.type === "paragraph" &&
    Node.string(firstNode) === "";

  if (isSingleEmptyParagraph || Node.string(editor) !== "") {
    return;
  }

  while (editor.children.length > 0) {
    Transforms.removeNodes(editor, { at: [0] });
  }

  Transforms.insertNodes(editor, createEmptyDocument(), { at: [0] });
  Transforms.select(editor, Editor.start(editor, [0]));
};

/**
 * Handles Backspace at list boundaries.
 *
 * Moves the cursor into a preceding list or converts a list item to a paragraph
 * when Backspace is pressed at the start of a block.
 *
 * @param {KeyboardEvent} event - The keyboard event to evaluate.
 * @param {CustomEditor} editor - The Slate editor instance.
 * @returns {boolean} `true` if the Backspace was handled, `false` otherwise.
 */
export const handleBackspaceKey = (event: KeyboardEvent, editor: CustomEditor): boolean => {
  if (event.key !== "Backspace") {
    return false;
  }

  if (!editor.selection) {
    return false;
  }

  if (Range.isExpanded(editor.selection)) {
    event.preventDefault();
    Transforms.delete(editor, { at: editor.selection });
    normalizeEmptyEditorToParagraph(editor);
    return true;
  }

  const selection = getCollapsedSelection(editor);

  if (!selection) {
    return false;
  }

  if (moveCursorToEndOfPreviousList(event, editor, selection)) {
    return true;
  }

  return convertListItemToParagraph(event, editor, selection);
};

/**
 * Maps a text prefix to its corresponding list format.
 *
 * @param {string} textBeforeCursor - The text content before the cursor.
 * @returns {ListFormat | null} The matching list format, or `null` if no match.
 *
 * @example
 * ```ts
 * getMarkdownShortcutListFormat("-");  // "bulleted-list"
 * getMarkdownShortcutListFormat("1."); // "numbered-list"
 * getMarkdownShortcutListFormat("abc"); // null
 * ```
 */
const getMarkdownShortcutListFormat = (textBeforeCursor: string): ListFormat | null => {
  if (textBeforeCursor === "-") {
    return "bulleted-list";
  }

  if (textBeforeCursor === "1.") {
    return "numbered-list";
  }

  return null;
};

/**
 * Converts markdown list shortcuts (`-` or `1.`) into Slate list blocks when Space is pressed.
 *
 * @param {KeyboardEvent} event - The keyboard event to evaluate.
 * @param {CustomEditor} editor - The Slate editor instance.
 * @returns {boolean} `true` if a shortcut was converted, `false` otherwise.
 *
 * @example
 * Typing `- ` at the start of a paragraph converts it to a bulleted list.
 * Typing `1. ` at the start of a paragraph converts it to a numbered list.
 */
export const handleMarkdownListShortcut = (event: KeyboardEvent, editor: CustomEditor): boolean => {
  if (event.key !== " ") {
    return false;
  }

  const selection = getCollapsedSelection(editor);

  if (!selection) {
    return false;
  }

  const [blockEntry] = Editor.nodes(editor, {
    match: (node) =>
      Element.isElement(node) && Editor.isBlock(editor, node) && node.type === "paragraph",
  });

  if (!blockEntry) {
    return false;
  }

  const [, blockPath] = blockEntry;
  const blockStart = Editor.start(editor, blockPath);
  const rangeBeforeCursor: Range = { anchor: blockStart, focus: selection.focus };
  const textBeforeCursor = Editor.string(editor, rangeBeforeCursor);
  const listFormat = getMarkdownShortcutListFormat(textBeforeCursor);

  if (!listFormat) {
    return false;
  }

  event.preventDefault();
  Transforms.select(editor, rangeBeforeCursor);
  Transforms.delete(editor);
  toggleBlock(editor, listFormat);
  return true;
};

/**
 * Runs the configured keyboard handlers for a Slate editor instance.
 *
 * @param {KeyboardEvent} event - The keyboard event from the editor's `onKeyDown` handler.
 * @param {CustomEditor} editor - The Slate editor instance.
 *
 * @example
 * ```tsx
 * <Editable onKeyDown={(event) => handleRichTextEditorKeyDown(event, editor)} />
 * ```
 */
export const handleRichTextEditorKeyDown = (event: KeyboardEvent, editor: CustomEditor): void => {
  const handlers: KeyboardHandler[] = [
    handleTabKey,
    handleEnterOnEmptyListItem,
    handleBackspaceKey,
    handleMarkdownListShortcut,
    handleModifierHotkeys,
  ];

  handlers.some((handler) => handler(event, editor));
};
