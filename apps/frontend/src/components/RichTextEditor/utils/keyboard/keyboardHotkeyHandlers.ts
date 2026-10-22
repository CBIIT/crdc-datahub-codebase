import type { KeyboardEvent } from "react";
import { HistoryEditor } from "slate-history";

import { MARK_DEFINITIONS } from "@/config/EditorConfig";

import type { CustomEditor } from "../../types";
import { toggleMark } from "../editorTransforms";

/**
 * Handles undo (Ctrl+Z) and redo (Ctrl+Y / Ctrl+Shift+Z) hotkeys.
 *
 * @param {KeyboardEvent} event - The keyboard event to evaluate.
 * @param {CustomEditor} editor - The Slate editor instance to apply history operations to.
 * @param {string} key - The lowercase key character pressed.
 * @returns {boolean} `true` if the event was handled, `false` otherwise.
 */
const handleUndoRedoHotkeys = (
  event: KeyboardEvent,
  editor: CustomEditor,
  key: string
): boolean => {
  const shouldUndo = key === "z" && !event.shiftKey;

  if (shouldUndo) {
    event.preventDefault();
    HistoryEditor.undo(editor);
    return true;
  }

  const shouldRedo = key === "y" || (key === "z" && event.shiftKey);

  if (!shouldRedo) {
    return false;
  }

  event.preventDefault();
  HistoryEditor.redo(editor);
  return true;
};

/**
 * Toggles an inline mark format when its hotkey is pressed defined in {@link MARK_DEFINITIONS}.
 *
 * @param {KeyboardEvent} event - The keyboard event to evaluate.
 * @param {CustomEditor} editor - The Slate editor instance to toggle the mark on.
 * @param {string} key - The lowercase key character pressed (e.g. `"b"`, `"i"`, `"u"`).
 * @returns {boolean} `true` if a matching mark was toggled, `false` otherwise.
 */
const handleMarkHotkeys = (event: KeyboardEvent, editor: CustomEditor, key: string): boolean => {
  const mark = MARK_DEFINITIONS.find((m) => m.hotkey === key && m.enabled);

  if (!mark) {
    return false;
  }

  event.preventDefault();
  toggleMark(editor, mark.format);
  return true;
};

/**
 * Handles editor keyboard shortcuts that require Ctrl/Command.
 *
 * @param {KeyboardEvent} event - The keyboard event from the editor's `onKeyDown` handler.
 * @param {CustomEditor} editor - The Slate editor instance.
 * @returns {boolean} `true` if the shortcut was handled, `false` if no modifier was held or no handler matched.
 *
 * @example
 * ```tsx
 * <Editable onKeyDown={(event) => handleModifierHotkeys(event, editor)} />
 * ```
 */
export const handleModifierHotkeys = (event: KeyboardEvent, editor: CustomEditor): boolean => {
  if (!event.ctrlKey && !event.metaKey) {
    return false;
  }

  const key = event.key.toLowerCase();

  if (handleUndoRedoHotkeys(event, editor, key)) {
    return true;
  }

  return handleMarkHotkeys(event, editor, key);
};
