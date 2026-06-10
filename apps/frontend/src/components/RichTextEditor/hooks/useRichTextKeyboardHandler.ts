import { useCallback } from "react";
import type { KeyboardEvent } from "react";

import type { CustomEditor } from "../types";
import { handleRichTextEditorKeyDown } from "../utils/keyboard/keyboardListHandlers";

/**
 * Creates the memoized keyboard event handler used by the Slate editable area.
 */
export const useRichTextKeyboardHandler = (
  editor: CustomEditor
): ((event: KeyboardEvent) => void) =>
  useCallback(
    (event: KeyboardEvent): void => {
      handleRichTextEditorKeyDown(event, editor);
    },
    [editor]
  );
