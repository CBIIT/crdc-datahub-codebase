import { Descendant, Element, Text } from "slate";

import type { FormattedText, ParagraphElement } from "../types";

const EMPTY_TEXT_NODE: FormattedText = { text: "" };

/**
 * Creates the default Slate value used when no saved rich-text content exists.
 */
export const createEmptyDocument = (): ParagraphElement[] => [
  { type: "paragraph", children: [{ ...EMPTY_TEXT_NODE }] },
];

/**
 * Ensures Slate element children always contain at least one text node.
 */
export const normalizeTextChildren = (children: FormattedText[]): FormattedText[] => {
  if (children.length > 0) {
    return children;
  }

  return [{ ...EMPTY_TEXT_NODE }];
};

const nodeHasText = (node: Descendant): boolean => {
  if (Text.isText(node)) {
    return Boolean(node.text.trim());
  }

  if (!Element.isElement(node)) {
    return false;
  }

  return node.children.some((childNode: Descendant) => nodeHasText(childNode));
};

/**
 * Returns true when a Slate document contains no non-whitespace text.
 */
export const isEditorEmpty = (nodes: Descendant[]): boolean => !nodes.some(nodeHasText);
