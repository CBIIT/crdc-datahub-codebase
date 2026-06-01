import type { KeyboardEvent } from "react";
import { Editor, Element, Node, Point, Range, Transforms } from "slate";

import type { CustomEditor, ListFormat } from "../../types";
import { isListElement } from "../editorGuards";
import { toggleBlock } from "../editorTransforms";

import {
  getCollapsedSelection,
  getCurrentListFormat,
  getFirstElementEntry,
  getPreviousSiblingPath,
  INDENTATION,
  removeCharactersBeforeCursor,
} from "./keyboardSelectionUtils";

const getIndentationDistanceToRemove = (textBeforeCursor: string): number => {
  if (textBeforeCursor.endsWith(INDENTATION)) {
    return INDENTATION.length;
  }

  if (textBeforeCursor.endsWith(" ")) {
    return 1;
  }

  return 0;
};

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

const isFirstListItem = (listItemPath: number[]): boolean =>
  listItemPath[listItemPath.length - 1] === 0;

/**
 * Exits a list when Enter is pressed on an empty list item that is not first.
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
  const shouldExitList = listItemIsEmpty && !isFirstListItem(listItemPath);

  if (!shouldExitList) {
    return false;
  }

  event.preventDefault();
  toggleBlock(editor, getCurrentListFormat(editor));
  return true;
};

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
  const lastListItemPath = [...previousPath, previousNode.children.length - 1];
  Transforms.select(editor, Editor.end(editor, lastListItemPath));
  return true;
};

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
 * Handles Backspace list boundary behavior.
 */
export const handleBackspaceKey = (event: KeyboardEvent, editor: CustomEditor): boolean => {
  if (event.key !== "Backspace") {
    return false;
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
 * Converts markdown list shortcuts into actual Slate list blocks.
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
