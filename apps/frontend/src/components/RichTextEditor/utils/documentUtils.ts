import { Descendant, Element, Text } from "slate";

import type {
  FormattedText,
  ListElement,
  ListFormat,
  ListItemElement,
  ParagraphElement,
} from "../types";

const EMPTY_TEXT_NODE: FormattedText = { text: "" };

/**
 * Creates a Slate list container for the requested list format.
 *
 * @param {ListFormat} format - The list format to create.
 * @returns {ListElement} A list element node with no children.
 *
 * @example
 * createListElement("bulleted-list"); // { type: "bulleted-list", children: [] }
 */
export const createListElement = (format: ListFormat): ListElement => ({
  type: format,
  children: [],
});

/**
 * Creates a Slate list item with an empty text node by default.
 *
 * @param {FormattedText[]} [children] - Optional children for the list item.
 * @returns {ListItemElement} A list item element node.
 *
 * @example
 * createListItem(); // { type: "list-item", children: [{ text: "" }] }
 */
export const createListItem = (
  children: FormattedText[] = [{ ...EMPTY_TEXT_NODE }]
): ListItemElement => ({
  type: "list-item",
  children,
});

/**
 * Creates the default Slate value used when no saved rich-text content exists.
 *
 * @returns {ParagraphElement[]} A single paragraph with an empty text node.
 */
export const createEmptyDocument = (): ParagraphElement[] => [
  { type: "paragraph", children: [{ ...EMPTY_TEXT_NODE }] },
];

/**
 * Ensures Slate element children always contain at least one text node.
 *
 * @param {FormattedText[]} children - The array of text nodes to normalize.
 * @returns {FormattedText[]} The original array if non-empty, or a single empty text node.
 *
 * @example
 * normalizeTextChildren([]); // [{ text: "" }]
 * normalizeTextChildren([{ text: "hi" }]); // [{ text: "hi" }]
 */
export const normalizeTextChildren = (children: FormattedText[]): FormattedText[] => {
  if (children.length > 0) {
    return children;
  }

  return [{ ...EMPTY_TEXT_NODE }];
};

/**
 * Checks whether a Slate document contains no non-whitespace text.
 * Recursively traverses nested elements.
 *
 * @param {Descendant[]} nodes - The top-level Slate document nodes.
 * @returns {boolean} `true` if the document has no visible text content.
 */
export const isEditorEmpty = (nodes: Descendant[]): boolean => {
  const nodeHasText = (node: Descendant): boolean => {
    if (Text.isText(node)) {
      return Boolean(node.text.trim());
    }

    if (!Element.isElement(node)) {
      return false;
    }

    return node.children.some((childNode: Descendant) => nodeHasText(childNode));
  };

  return !nodes?.some(nodeHasText);
};
