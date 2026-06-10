import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";

import { BlockDefinition, MarkDefinition } from "@/components/RichTextEditor/types";

/**
 * Defines the supported inline mark formats.
 */
export const MARK_DEFINITIONS: MarkDefinition[] = [
  {
    format: "bold",
    tooltip: "Bold (Ctrl+B)",
    icon: FormatBoldIcon,
    hotkey: "b",
    htmlTag: "strong",
    markdownSyntax: ["**", "**"],
    pattern: /\*\*(.+?)\*\*/gs,
  },
  {
    format: "italic",
    tooltip: "Italic (Ctrl+I)",
    icon: FormatItalicIcon,
    hotkey: "i",
    htmlTag: "em",
    markdownSyntax: ["_", "_"],
    pattern: /_(.+?)_/gs,
  },
  {
    format: "underline",
    tooltip: "Underline (Ctrl+U)",
    icon: FormatUnderlinedIcon,
    hotkey: "u",
    htmlTag: "u",
    markdownSyntax: ["<u>", "</u>"],
    pattern: /<u>(.+?)<\/u>/gs,
  },
];

/**
 * Defines the supported block mark formats.
 */
export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    format: "bulleted-list",
    tooltip: "Bullet List",
    icon: FormatListBulletedIcon,
    pattern: /^[-*]\s+(.+)$/,
  },
  {
    format: "numbered-list",
    tooltip: "Numbered List",
    icon: FormatListNumberedIcon,
    pattern: /^\d+\.\s+(.+)$/,
  },
];

/**
 * Tolerance pattern: matches italic formatted with asterisks (only underscores are serialized).
 */
export const ITALIC_ASTERISK_PATTERN = /\*(.+?)\*/;

/**
 * Matches backslash-escaped markdown syntax characters.
 */
export const ESCAPED_CHARACTER_PATTERN = /\\([*_\\])/;

/**
 * Matches runs of plain text that contain no markdown syntax characters.
 */
export const PLAIN_TEXT_PATTERN = /[^*_<\\]+/;

/**
 * Maps raw characters to their HTML-entity-escaped equivalents for markdown output.
 */
export const HTML_TEXT_ESCAPE_REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

/**
 * Maps raw markdown syntax characters to their backslash-escaped equivalents.
 */
export const MARKDOWN_ESCAPE_REPLACEMENTS: Record<string, string> = {
  "\\": "\\\\",
  "*": "\\*",
  _: "\\_",
};

/**
 * Maps serialized HTML entities back to their decoded characters.
 */
export const HTML_ENTITY_REPLACEMENTS: Record<string, string> = {
  "&nbsp;": " ",
  "&#160;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
};
