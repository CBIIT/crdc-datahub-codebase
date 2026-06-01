import type { KeyboardEvent } from "react";
import { HistoryEditor } from "slate-history";

import type { CustomEditor, MarkFormat } from "../../types";
import { toggleMark } from "../editorTransforms";

const HOTKEY_MARK_FORMATS: Record<string, MarkFormat> = {
  b: "bold",
  i: "italic",
  u: "underline",
};

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

const handleMarkHotkeys = (event: KeyboardEvent, editor: CustomEditor, key: string): boolean => {
  const format = HOTKEY_MARK_FORMATS[key];

  if (!format) {
    return false;
  }

  event.preventDefault();
  toggleMark(editor, format);
  return true;
};

/**
 * Handles editor keyboard shortcuts that require Ctrl or Command.
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
