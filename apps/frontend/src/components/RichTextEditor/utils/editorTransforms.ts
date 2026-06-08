import { Editor, Element, Transforms } from "slate";
import { withHistory } from "slate-history";
import { withReact } from "slate-react";

import type { BlockFormat, CustomEditor, CustomElement, ListFormat, MarkFormat } from "../types";

import { isListElement, isListFormat } from "./editorGuards";
import { createListElement } from "./elementFactory";

/**
 * Adds React and history behavior to a base Slate editor.
 *
 * @param {Editor} editor - The base Slate editor instance.
 * @returns {CustomEditor} The enhanced editor with React and history plugins.
 *
 * @example
 * const editor = withCustomEditor(createEditor());
 */
export const withCustomEditor = (editor: Editor): CustomEditor =>
  withHistory(withReact(editor)) as CustomEditor;

/**
 * Checks whether the given inline mark is active on the current selection.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {MarkFormat} format - The mark format to check.
 * @returns {boolean} `true` if the mark is currently applied.
 *
 * @example
 * isMarkActive(editor, "bold"); // true if selection is bold
 */
export const isMarkActive = (editor: CustomEditor, format: MarkFormat): boolean => {
  const marks = Editor.marks(editor);

  if (!marks) {
    return false;
  }

  return marks[format] === true;
};

/**
 * Toggles an inline mark on the current selection. Removes it if active, adds it otherwise.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {MarkFormat} format - The mark format to toggle.
 * @returns {void}
 *
 * @example
 * toggleMark(editor, "bold"); // toggles bold on/off
 */
export const toggleMark = (editor: CustomEditor, format: MarkFormat): void => {
  if (isMarkActive(editor, format)) {
    Editor.removeMark(editor, format);
    return;
  }

  Editor.addMark(editor, format, true);
};

/**
 * Checks whether the current selection is inside a block of the given format.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {BlockFormat} format - The block format to check.
 * @returns {boolean} `true` if the selection is inside a matching block.
 *
 * @example
 * isBlockActive(editor, "bulleted-list"); // true if inside a bullet list
 */
export const isBlockActive = (editor: CustomEditor, format: BlockFormat): boolean => {
  const [match] = Array.from(
    Editor.nodes(editor, {
      match: (node) => !Editor.isEditor(node) && Element.isElement(node) && node.type === format,
    })
  );

  return Boolean(match);
};

/**
 * Determines the block type to apply when toggling a block format.
 * Returns "paragraph" when deactivating, "list-item" for lists, or the format itself.
 *
 * @param {BlockFormat} format - The target block format.
 * @param {boolean} isActive - Whether the format is currently active.
 * @returns {BlockFormat} The block type to set on the selected nodes.
 */
const getNextBlockType = (format: BlockFormat, isActive: boolean): BlockFormat => {
  if (isActive) {
    return "paragraph";
  }

  if (isListFormat(format)) {
    return "list-item";
  }

  return format;
};

/**
 * Removes any list wrapper nodes around the current selection before re-wrapping.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @returns {void}
 */
const unwrapExistingLists = (editor: CustomEditor): void => {
  Transforms.unwrapNodes(editor, {
    match: (node) => !Editor.isEditor(node) && isListElement(node),
    split: true,
  });
};

/**
 * Toggles the current block between paragraph and the given block format.
 * Handles wrapping/unwrapping list containers automatically.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {BlockFormat} format - The block format to toggle.
 * @returns {void}
 *
 * @example
 * toggleBlock(editor, "bulleted-list"); // wraps selection in a bullet list
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
