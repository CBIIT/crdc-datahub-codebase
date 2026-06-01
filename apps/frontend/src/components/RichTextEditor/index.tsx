import { Box, styled } from "@mui/material";
import type { ReactElement } from "react";
import { forwardRef, useImperativeHandle } from "react";
import { Editable, Slate } from "slate-react";

import { useRichTextEditor } from "./hooks/useRichTextEditor";
import Toolbar from "./Toolbar";
import { createEmptyDocument } from "./utils/documentUtils";

export type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onTextLengthChange?: (length: number) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
};

export type RichTextEditorHandle = {
  reset: () => void;
};

const StyledEditorWrapper = styled(Box)({
  marginTop: "24px",
  border: "1px solid rgba(0, 0, 0, 0.23)",
  borderRadius: "4px",
  display: "flex",
  flexDirection: "column",
  width: "fit-content",
  maxWidth: "100%",
  boxSizing: "border-box",
  "&:hover": {
    borderColor: "rgba(0, 0, 0, 0.87)",
  },
  "&:focus-within": {
    borderColor: "#1976d2",
    borderWidth: "2px",
  },
});

const StyledEditable = styled(Editable)({
  padding: "12px",
  lineHeight: "25px",
  width: "min(750px, calc(100vw - 150px))",
  minWidth: "min(750px, calc(100vw - 150px))",
  maxWidth: "min(1440px, 80vw)",
  height: "min(375px, calc(100vh - 340px))",
  minHeight: "clamp(100px, calc(100vh - 340px), 375px) !important",
  maxHeight: "min(500px, calc(100vh - 340px))",
  resize: "both",
  overflowY: "auto",
  overflowX: "hidden",
  boxSizing: "border-box",
  outline: "none",
  "& [data-slate-placeholder]": {
    top: "12px !important",
  },
  "& p": {
    margin: "0 0 4px 0",
    "&:last-child": { marginBottom: 0 },
  },
  "& ul, & ol": {
    margin: "0 0 4px 0",
    paddingLeft: "24px",
    "&:last-child": { marginBottom: 0 },
  },
  "& li": {
    lineHeight: "25px",
  },
});

const EditorToolbar = ({ disabled }: { disabled: boolean }): ReactElement | null => {
  if (disabled) {
    return null;
  }

  return <Toolbar />;
};

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  (
    {
      value,
      onChange,
      onTextLengthChange,
      placeholder,
      disabled = false,
      "aria-label": ariaLabel,
      "data-testid": dataTestId,
    },
    ref
  ): ReactElement => {
    const { editor, initialValue, handleChange, handleKeyDown, renderElement, renderLeaf, reset } =
      useRichTextEditor({ value, onChange, onTextLengthChange });

    useImperativeHandle(ref, () => ({ reset }), [reset]);

    return (
      <StyledEditorWrapper data-testid={dataTestId}>
        <Slate editor={editor} initialValue={initialValue} onChange={handleChange}>
          <EditorToolbar disabled={disabled} />
          <StyledEditable
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            readOnly={disabled}
            aria-label={ariaLabel}
            aria-multiline
          />
        </Slate>
      </StyledEditorWrapper>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";

export { createEmptyDocument };

export default RichTextEditor;
