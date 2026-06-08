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
    htmlTag: "strong",
    markdownSyntax: ["**", "**"],
    pattern: /\*\*(.+?)\*\*/gs,
  },
  {
    format: "italic",
    tooltip: "Italic (Ctrl+I)",
    icon: FormatItalicIcon,
    htmlTag: "em",
    markdownSyntax: ["_", "_"],
    pattern: /_(.+?)_/gs,
  },
  {
    format: "underline",
    tooltip: "Underline (Ctrl+U)",
    icon: FormatUnderlinedIcon,
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
