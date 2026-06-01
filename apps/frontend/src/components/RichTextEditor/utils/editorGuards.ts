import { Element, Node } from "slate";

import type { BlockFormat, ListElement, ListFormat } from "../types";

const LIST_FORMATS: readonly ListFormat[] = ["bulleted-list", "numbered-list"];

/**
 * Narrows a block format to a list format.
 */
export const isListFormat = (format: BlockFormat): format is ListFormat =>
  LIST_FORMATS.includes(format as ListFormat);

/**
 * Narrows a Slate node to one of the supported list elements.
 */
export const isListElement = (node: Node): node is ListElement =>
  Element.isElement(node) && isListFormat(node.type as BlockFormat);
