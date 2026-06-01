import type { FormattedText, ListElement, ListFormat, ListItemElement } from "../types";

const EMPTY_TEXT_NODE: FormattedText = { text: "" };

/**
 * Creates a Slate list container for the requested list format.
 */
export const createListElement = (format: ListFormat): ListElement => ({
  type: format,
  children: [],
});

/**
 * Creates a Slate list item with an empty text node by default.
 */
export const createListItem = (
  children: FormattedText[] = [{ ...EMPTY_TEXT_NODE }]
): ListItemElement => ({
  type: "list-item",
  children,
});
