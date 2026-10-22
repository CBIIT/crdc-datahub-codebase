import { Editor, Element, NodeEntry, Path, Range, Transforms } from "slate";

import type { BlockFormat, CustomEditor, CustomElement, ListFormat } from "../../types";

export const INDENTATION = "  ";

/**
 * Returns the current selection only when it is collapsed to a single cursor point.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @returns {Range | null} The collapsed selection, or `null` if expanded or absent.
 */
export const getCollapsedSelection = (editor: CustomEditor): Range | null => {
  const { selection } = editor;

  if (!selection || !Range.isCollapsed(selection)) {
    return null;
  }

  return selection;
};

/**
 * Finds the first Slate element entry matching the requested block type.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {BlockFormat} type - The block type to search for (e.g. `"paragraph"`, `"list-item"`).
 * @returns {NodeEntry<CustomElement> | undefined} The matching entry, or `undefined` if not found.
 */
export const getFirstElementEntry = (
  editor: CustomEditor,
  type: BlockFormat
): NodeEntry<CustomElement> | undefined => {
  const [entry] = Editor.nodes(editor, {
    match: (node) => Element.isElement(node) && node.type === type,
  });

  return entry as NodeEntry<CustomElement> | undefined;
};

/**
 * Determines the active list format for keyboard operations.
 *
 * Returns `"bulleted-list"` if the cursor is inside one, otherwise defaults to `"numbered-list"`.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @returns {ListFormat} The active list format.
 */
export const getCurrentListFormat = (editor: CustomEditor): ListFormat => {
  const bulletListEntry = getFirstElementEntry(editor, "bulleted-list");

  if (bulletListEntry) {
    return "bulleted-list";
  }

  return "numbered-list";
};

/**
 * Deletes a number of characters immediately before the cursor.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @param {number} distance - The number of characters to delete.
 */
export const removeCharactersBeforeCursor = (editor: CustomEditor, distance: number): void => {
  Transforms.delete(editor, {
    unit: "character",
    reverse: true,
    distance,
  });
};

/**
 * Returns the path of the previous sibling node in the Slate document tree.
 *
 * @param {Path} path - The Slate path to find the previous sibling for.
 * @returns {Path | null} The previous sibling path, or `null` if the node is the first child.
 *
 * @example
 * ```ts
 * getPreviousSiblingPath([0, 2]); // [0, 1]
 * getPreviousSiblingPath([0, 0]); // null
 * ```
 */
export const getPreviousSiblingPath = (path: Path): Path | null => {
  const currentIndex = path[path.length - 1];

  if (currentIndex <= 0) {
    return null;
  }

  return [...path.slice(0, -1), currentIndex - 1];
};
