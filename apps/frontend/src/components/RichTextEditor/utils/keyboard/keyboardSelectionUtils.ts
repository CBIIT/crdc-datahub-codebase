import { Editor, Element, NodeEntry, Path, Range, Transforms } from "slate";

import type { BlockFormat, CustomEditor, CustomElement, ListFormat } from "../../types";

export const INDENTATION = "  ";

/**
 * Returns the current selection only when it is collapsed to a single cursor point.
 */
export const getCollapsedSelection = (editor: CustomEditor): Range | null => {
  const { selection } = editor;

  if (!selection || !Range.isCollapsed(selection)) {
    return null;
  }

  return selection;
};

/**
 * Finds the first Slate element entry for the requested block type.
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
 */
export const removeCharactersBeforeCursor = (editor: CustomEditor, distance: number): void => {
  Transforms.delete(editor, {
    unit: "character",
    reverse: true,
    distance,
  });
};

/**
 * Returns the path for the previous sibling of a Slate path when it exists.
 */
export const getPreviousSiblingPath = (path: Path): Path | null => {
  const currentIndex = path[path.length - 1];

  if (currentIndex <= 0) {
    return null;
  }

  return [...path.slice(0, -1), currentIndex - 1];
};
