import { Element, Node } from "slate";

import type { BlockFormat, LinkElement, ListElement, ListFormat } from "../types";

const LIST_FORMATS: readonly ListFormat[] = ["bulleted-list", "numbered-list"];

/**
 * Narrows a block format string to a list format type guard.
 *
 * @param {BlockFormat} format - The block format to check.
 * @returns {boolean} `true` if the format is "bulleted-list" or "numbered-list".
 *
 * @example
 * isListFormat("bulleted-list"); // true
 * isListFormat("paragraph"); // false
 */
export const isListFormat = (format: BlockFormat): format is ListFormat =>
  LIST_FORMATS.includes(format as ListFormat);

/**
 * Narrows a Slate node to one of the supported list elements.
 *
 * @param {Node} node - The Slate node to check.
 * @returns {boolean} `true` if the node is a bulleted-list or numbered-list element.
 *
 * @example
 * isListElement({ type: "bulleted-list", children: [] }); // true
 * isListElement({ text: "hello" }); // false
 */
export const isListElement = (node: Node): node is ListElement =>
  Element.isElement(node) && isListFormat(node.type as BlockFormat);

/**
 * Narrows a Slate node to a link element.
 *
 * @param {Node} node - The Slate node to check.
 * @returns {boolean} `true` if the node is a link element.
 *
 * @example
 * isLinkElement({ type: "link", url: "https://g.co", children: [] }); // true
 * isLinkElement({ type: "paragraph", children: [] }); // false
 */
export const isLinkElement = (node: Node): node is LinkElement =>
  Element.isElement(node) && node.type === "link";
