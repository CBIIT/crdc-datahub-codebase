import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";

import type {
  BlockButtonConfig,
  MarkButtonConfig,
} from "../components/RichTextEditor/ToolbarButton";

/**
 * Inline mark buttons rendered in the editor toolbar.
 */
export const MARK_BUTTONS: MarkButtonConfig[] = [
  { format: "bold", tooltip: "Bold (Ctrl+B)", icon: FormatBoldIcon },
  { format: "italic", tooltip: "Italic (Ctrl+I)", icon: FormatItalicIcon },
  { format: "underline", tooltip: "Underline (Ctrl+U)", icon: FormatUnderlinedIcon },
];

/**
 * Block-format buttons rendered in the editor toolbar.
 */
export const BLOCK_BUTTONS: BlockButtonConfig[] = [
  { format: "bulleted-list", tooltip: "Bullet List", icon: FormatListBulletedIcon },
  { format: "numbered-list", tooltip: "Numbered List", icon: FormatListNumberedIcon },
];
