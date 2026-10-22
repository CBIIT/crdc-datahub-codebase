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
    enabled: true,
    hotkey: "b",
    htmlTag: "strong",
    markdownSyntax: ["**", "**"],
  },
  {
    format: "italic",
    tooltip: "Italic (Ctrl+I)",
    icon: FormatItalicIcon,
    enabled: true,
    hotkey: "i",
    htmlTag: "em",
    markdownSyntax: ["_", "_"],
  },
  {
    format: "underline",
    tooltip: "Underline (Ctrl+U)",
    icon: FormatUnderlinedIcon,
    enabled: false,
    hotkey: "u",
    htmlTag: "u",
    markdownSyntax: ["<u>", "</u>"],
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
    enabled: true,
  },
  {
    format: "numbered-list",
    tooltip: "Numbered List",
    icon: FormatListNumberedIcon,
    enabled: true,
  },
];
