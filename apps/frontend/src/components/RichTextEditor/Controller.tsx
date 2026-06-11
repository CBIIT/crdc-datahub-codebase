import { Box, styled } from "@mui/material";
import type { ReactElement } from "react";
import { forwardRef, useImperativeHandle } from "react";
import { Editable, Slate } from "slate-react";

import { useRichTextEditor } from "./hooks/useRichTextEditor";
import Toolbar from "./Toolbar";

const StyledEditorWrapper = styled(Box)({
  marginTop: "24px",
  border: "1px solid #6B7294",
  borderRadius: "4px",
  display: "flex",
  flexDirection: "column",
  width: "fit-content",
  maxWidth: "100%",
  boxSizing: "border-box",
  backgroundColor: "white",
  "&:hover": {
    borderColor: "#6B7294",
  },
  "&:focus-within": {
    borderColor: "#209D7D",
    borderWidth: "1px",
    boxShadow:
      "2px 2px 4px 0px rgba(38, 184, 147, 0.10), -1px -1px 6px 0px rgba(38, 184, 147, 0.20)",
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
  backgroundColor: "white",
  "& [data-slate-placeholder]": {
    top: "12px !important",
  },
  "& li [data-slate-placeholder]": {
    display: "none !important",
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

export type RichTextEditorHandle = {
  reset: () => void;
};

export type Props = {
  value: string;
  onChange: (value: string) => void;
  onTextLengthChange?: (length: number) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
};

const Controller = forwardRef<RichTextEditorHandle, Props>(
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
          {!disabled ? <Toolbar /> : null}

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

Controller.displayName = "RichTextEditor";

export default Controller;
