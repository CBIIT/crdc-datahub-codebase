import { Editor, Element, Transforms } from "slate";
import { withHistory } from "slate-history";
import { withReact } from "slate-react";

import type { BlockFormat, CustomEditor, CustomElement, ListFormat, MarkFormat } from "../types";

import { isListElement, isListFormat } from "./editorGuards";
import { createListElement } from "./elementFactory";

/**
 * Adds React and history behavior to a base Slate editor.
 */
export const withCustomEditor = (editor: Editor): CustomEditor =>
  withHistory(withReact(editor)) as CustomEditor;

/**
 * Returns true when the current selection has the requested text mark.
 */
export const isMarkActive = (editor: CustomEditor, format: MarkFormat): boolean => {
  const marks = Editor.marks(editor);

  if (!marks) {
    return false;
  }

  return marks[format] === true;
};

/**
 * Toggles a text mark for the current selection.
 */
export const toggleMark = (editor: CustomEditor, format: MarkFormat): void => {
  if (isMarkActive(editor, format)) {
    Editor.removeMark(editor, format);
    return;
  }

  Editor.addMark(editor, format, true);
};

/**
 * Returns true when the current selection is inside the requested block format.
 */
export const isBlockActive = (editor: CustomEditor, format: BlockFormat): boolean => {
  const [match] = Array.from(
    Editor.nodes(editor, {
      match: (node) => !Editor.isEditor(node) && Element.isElement(node) && node.type === format,
    })
  );

  return Boolean(match);
};

const getNextBlockType = (format: BlockFormat, isActive: boolean): BlockFormat => {
  if (isActive) {
    return "paragraph";
  }

  if (isListFormat(format)) {
    return "list-item";
  }

  return format;
};

const unwrapExistingLists = (editor: CustomEditor): void => {
  Transforms.unwrapNodes(editor, {
    match: (node) => !Editor.isEditor(node) && isListElement(node),
    split: true,
  });
};

/**
 * Toggles the current block between paragraph, list item, and list container states.
 */
export const toggleBlock = (editor: CustomEditor, format: BlockFormat): void => {
  const blockIsActive = isBlockActive(editor, format);
  const nextBlockType = getNextBlockType(format, blockIsActive);

  unwrapExistingLists(editor);
  Transforms.setNodes<CustomElement>(editor, { type: nextBlockType });

  if (blockIsActive || !isListFormat(format)) {
    return;
  }

  Transforms.wrapNodes(editor, createListElement(format as ListFormat));
};
