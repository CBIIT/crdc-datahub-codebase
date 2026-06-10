import { useCallback, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import { createEditor, Node, Transforms } from "slate";
import type { Descendant } from "slate";
import { HistoryEditor } from "slate-history";
import type { RenderElementProps, RenderLeafProps } from "slate-react";

import EditorElement from "../EditorElement";
import EditorLeaf from "../EditorLeaf";
import { createEmptyDocument } from "../utils/documentUtils";
import { withCustomEditor } from "../utils/editorTransforms";
import { handleRichTextEditorKeyDown } from "../utils/keyboard/keyboardListHandlers";
import { deserializeFromMarkdown } from "../utils/markdown/markdownDeserializer";
import { serializeToMarkdown } from "../utils/markdown/markdownSerializer";

type UseRichTextEditorParams = {
  value: string;
  onChange: (value: string) => void;
  onTextLengthChange?: (length: number) => void;
};

type UseRichTextEditorResult = {
  editor: ReturnType<typeof withCustomEditor>;
  initialValue: Descendant[];
  handleChange: (newValue: Descendant[]) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  renderElement: (props: RenderElementProps) => ReactElement;
  renderLeaf: (props: RenderLeafProps) => ReactElement;
  reset: () => void;
};

/**
 * Owns the Slate editor instance, initial value, serialization, render callbacks,
 * and keyboard handler for the rich text editor component.
 */
export const useRichTextEditor = ({
  value,
  onChange,
  onTextLengthChange,
}: UseRichTextEditorParams): UseRichTextEditorResult => {
  const [editor] = useState(() => withCustomEditor(createEditor()));
  const [initialValue] = useState<Descendant[]>(() => deserializeFromMarkdown(value));

  const handleChange = useCallback(
    (newValue: Descendant[]): void => {
      onChange(serializeToMarkdown(newValue));
      onTextLengthChange?.(Node.string(editor).length);
    },
    [editor, onChange, onTextLengthChange]
  );

  const renderElement = useCallback(
    (props: RenderElementProps): ReactElement => <EditorElement {...props} />,
    []
  );

  const renderLeaf = useCallback(
    (props: RenderLeafProps): ReactElement => <EditorLeaf {...props} />,
    []
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      handleRichTextEditorKeyDown(event, editor);
    },
    [editor]
  );

  const reset = useCallback((): void => {
    Transforms.deselect(editor);
    editor.children = createEmptyDocument();
    if (HistoryEditor.isHistoryEditor(editor)) {
      editor.history = { undos: [], redos: [] };
    }
    editor.onChange();
  }, [editor]);

  return {
    editor,
    initialValue,
    handleChange,
    handleKeyDown,
    renderElement,
    renderLeaf,
    reset,
  };
};
