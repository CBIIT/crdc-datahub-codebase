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
    htmlTag: "strong",
    markdownSyntax: ["**", "**"],
    tooltip: "Bold (Ctrl+B)",
    icon: FormatBoldIcon,
  },
  {
    format: "italic",
    htmlTag: "em",
    markdownSyntax: ["_", "_"],
    tooltip: "Italic (Ctrl+I)",
    icon: FormatItalicIcon,
  },
  {
    format: "underline",
    htmlTag: "u",
    markdownSyntax: ["<u>", "</u>"],
    tooltip: "Underline (Ctrl+U)",
    icon: FormatUnderlinedIcon,
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
  },
  {
    format: "numbered-list",
    tooltip: "Numbered List",
    icon: FormatListNumberedIcon,
  },
];
