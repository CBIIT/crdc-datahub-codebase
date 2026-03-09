import {
  FormControl,
  FormHelperText,
  Grid,
  OutlinedInput,
  OutlinedInputProps,
  styled,
} from "@mui/material";
import React, { FC, ReactNode, useEffect, useId, useRef, useState } from "react";

import { updateInputValidity } from "../../utils";
import Tooltip from "../Tooltip";

const StyledGridWrapper = styled(Grid)(({ theme }) => ({
  "& .MuiFormHelperText-root": {
    color: "#083A50",
    marginLeft: "0",
    [theme.breakpoints.up("lg")]: {
      whiteSpace: "nowrap",
    },
  },
  "& .MuiFormHelperText-root.Mui-error": {
    color: "#D54309 !important",
  },
}));

const StyledFormControl = styled(FormControl)(() => ({
  height: "100%",
  justifyContent: "end",
}));

export const StyledLabelWrapper = styled("div")(() => ({
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  minHeight: "20px",
  color: "#083A50",
  marginBottom: "4px",
}));

export const StyledLabel = styled("label")(() => ({
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "19.6px",
  minHeight: "20px",
  color: "#083A50",
}));

const StyledAsterisk = styled("span")(() => ({
  color: "#C93F08",
  marginLeft: "2px",
}));

const StyledHelperText = styled(FormHelperText)(() => ({
  marginTop: "4px",
  minHeight: "20px",
}));

const StyledOutlinedInput = styled(OutlinedInput, {
  shouldForwardProp: (prop) => prop !== "resize" && prop !== "rowHeight",
})<OutlinedInputProps & { resize: boolean; rowHeight: number }>(
  ({ resize, rowHeight, rows, minRows, maxRows }) => ({
    borderRadius: "8px",
    backgroundColor: "#fff",
    color: "#083A50",
    "& .MuiInputBase-input": {
      fontWeight: 400,
      fontSize: "16px",
      fontFamily: "'Nunito', 'Rubik', sans-serif",
      lineHeight: "19.6px",
      padding: "12px",
      height: "20px",
    },
    "&.MuiInputBase-multiline": {
      padding: "12px",
    },
    "& .MuiInputBase-inputMultiline": {
      resize: resize ? "vertical" : "none",
      minHeight: resize && rowHeight ? `${(+rows || +minRows || 1) * rowHeight}px` : 0,
      maxHeight: resize && maxRows && rowHeight ? `${+maxRows * rowHeight}px` : "none",
    },
    "&.MuiInputBase-multiline .MuiInputBase-input": {
      lineHeight: `${rowHeight}px`,
      padding: 0,
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "#6B7294",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      border: "1px solid #209D7D",
      boxShadow:
        "2px 2px 4px 0px rgba(38, 184, 147, 0.10), -1px -1px 6px 0px rgba(38, 184, 147, 0.20)",
    },
    "& .MuiInputBase-input::placeholder": {
      color: "#87878C",
      fontWeight: 400,
      opacity: 1,
    },
    // Override the input error border color
    "&.Mui-error fieldset": {
      borderColor: "#D54309 !important",
    },
    // Target readOnly <textarea> inputs
    "&.MuiInputBase-multiline.Mui-readOnly": {
      backgroundColor: "#E5EEF4",
      color: "#083A50",
      cursor: "not-allowed",
      borderRadius: "8px",
    },
    // Target readOnly <input> inputs
    "& .MuiOutlinedInput-input:read-only": {
      backgroundColor: "#E5EEF4",
      color: "#083A50",
      cursor: "not-allowed",
      borderRadius: "8px",
    },
  })
);

type Props = {
  label?: string | ReactNode;
  labelStartAdornment?: ReactNode;
  labelEndAdornment?: ReactNode;
  infoText?: string;
  errorText?: string;
  tooltipText?: string | ReactNode;
  gridWidth?: 2 | 4 | 6 | 8 | 10 | 12;
  maxLength?: number;
  hideValidation?: boolean;
  resize?: boolean;
  validate?: (input: string) => boolean;
  filter?: (input: string) => string;
  parentStateSetter?: (string) => void;
} & OutlinedInputProps;

/**
 * Generates a generic text input with a label and help text
 *
 * NOTE:
 * - We're using a custom wrapper for Material UI's OutlinedInput component
 *   instead of using the TextField component because of the forced
 *   floating label behavior of TextField.
 *
 * @param {Props} props & number props
 * @returns {JSX.Element}
 */
const TextInput: FC<Props> = ({
  classes,
  value,
  label,
  labelStartAdornment,
  labelEndAdornment,
  required = false,
  gridWidth,
  maxLength,
  infoText,
  errorText,
  tooltipText,
  hideValidation,
  validate,
  filter,
  type,
  readOnly,
  rows,
  multiline,
  resize,
  inputProps,
  onChange,
  parentStateSetter,
  ...rest
}) => {
  const id = rest.id || useId();

  const [val, setVal] = useState(value);
  const [error, setError] = useState(false);
  const errorMsg = errorText || (required ? "This field is required" : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ROW_HEIGHT = 25; // line height of each row in a multiline

  const processValue = (inputVal: string) => {
    let newVal = inputVal;

    if (typeof filter === "function") {
      newVal = filter(newVal);
    }
    if (typeof maxLength === "number" && newVal?.length > maxLength) {
      newVal = newVal.slice(0, maxLength);
    }
    if (typeof validate === "function") {
      const customIsValid = validate(newVal);
      updateInputValidity(inputRef, !customIsValid ? errorMsg : "");
    }
    if (typeof parentStateSetter === "function") {
      parentStateSetter(newVal);
    }
    setVal(newVal);
  };

  const onChangeWrapper = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (typeof onChange === "function") {
      onChange(event);
    }
    const newVal = event.target.value;

    processValue(newVal);
    setError(false);
  };

  useEffect(() => {
    const invalid = () => setError(true);

    inputRef.current?.addEventListener("invalid", invalid);
    return () => {
      inputRef.current?.removeEventListener("invalid", invalid);
    };
  }, [inputRef]);

  useEffect(() => {
    processValue(value?.toString());
  }, [value]);

  /* MUI sets the height for multiline input using inline styling. Needs to be overwritten to have a working minHeight */
  const customInputProps =
    resize && multiline
      ? { style: { height: `${(+rows || 1) * ROW_HEIGHT}px`, overflow: "auto" } }
      : {};

  return (
    <StyledGridWrapper md={gridWidth || 6} xs={12} item>
      <StyledFormControl fullWidth error={error}>
        <StyledLabelWrapper>
          {labelStartAdornment}
          {label && (
            <StyledLabel htmlFor={id}>
              {label}
              {required && label ? <StyledAsterisk>*</StyledAsterisk> : ""}
              {tooltipText && <Tooltip placement="right" title={tooltipText} />}
            </StyledLabel>
          )}
          {labelEndAdornment}
        </StyledLabelWrapper>
        <StyledOutlinedInput
          inputRef={inputRef}
          type={type || "text"}
          size="small"
          value={val ?? ""}
          onChange={onChangeWrapper}
          required={required}
          readOnly={readOnly}
          rows={rows}
          multiline={multiline}
          resize={resize}
          rowHeight={ROW_HEIGHT}
          {...rest}
          inputProps={{ ...customInputProps, ...inputProps }}
          id={id}
        />
        <StyledHelperText>
          {(!hideValidation && !readOnly && error ? errorMsg : infoText) || " "}
        </StyledHelperText>
      </StyledFormControl>
    </StyledGridWrapper>
  );
};

export default TextInput;
