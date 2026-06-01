import type { KeyboardEvent } from "react";

import type { CustomEditor } from "../../types";

import { handleModifierHotkeys } from "./keyboardHotkeyHandlers";
import {
  handleBackspaceKey,
  handleEnterOnEmptyListItem,
  handleMarkdownListShortcut,
  handleTabKey,
} from "./keyboardListHandlers";

type KeyboardHandler = (event: KeyboardEvent, editor: CustomEditor) => boolean;

/**
 * Ordered keyboard behaviors for the rich text editor. The first handler that
 * returns true owns the event.
 */
export const RICH_TEXT_KEYBOARD_HANDLERS: KeyboardHandler[] = [
  handleTabKey,
  handleEnterOnEmptyListItem,
  handleBackspaceKey,
  handleMarkdownListShortcut,
  handleModifierHotkeys,
];

/**
 * Runs the configured keyboard handlers for a Slate editor instance.
 */
export const handleRichTextEditorKeyDown = (event: KeyboardEvent, editor: CustomEditor): void => {
  RICH_TEXT_KEYBOARD_HANDLERS.some((handler) => handler(event, editor));
};
