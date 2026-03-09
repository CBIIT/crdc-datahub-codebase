import { Input, InputProps, Tooltip, TooltipProps, styled } from "@mui/material";
import React, { FC, useEffect, useId, useState, useRef } from "react";

import useFormMode from "../../hooks/useFormMode";
import { updateInputValidity } from "../../utils";

type Props = {
  /**
   * Pass in a regex pattern if you want this field to have custom validation checking
   */
  pattern?: string;
  patternValidityMessage?: string;
  maxLength?: number;
  filter?: (input: string) => string;
} & InputProps;

const StyledTooltip = styled((props: TooltipProps) => (
  <Tooltip classes={{ popper: props.className }} {...props} />
))(() => ({
  "& .MuiTooltip-tooltip": {
    color: "#C93F08",
    background: "#FFFFFF",
    border: "1px solid #2B528B",
  },
  "& .MuiTooltip-arrow": {
    color: "#2B528B",
  },
}));

const StyledInput = styled(Input)(() => ({
  "&.MuiInputBase-root": {
    "& .MuiInputBase-input": {
      padding: "0px",
      color: "#083A50",
      fontWeight: 400,
      fontSize: "16px",
      fontFamily: "'Nunito', 'Rubik', sans-serif",
      height: "20px",
      width: "100%",
    },
    "& ::placeholder": {
      color: "#87878C",
      fontWeight: 400,
      opacity: 1,
      height: "20px",
    },
    "& .MuiInputBase-input:read-only": {
      backgroundColor: "#E5EEF4",
      color: "#083A50",
      cursor: "not-allowed",
    },
  },
}));

/**
 * Generates a generic text input with a label and help text
 *
 * NOTE:
 * - We're using a custom wrapper for Material UI's OutlinedInput component
 *   instead of using the TextField component because of the forced
 *   floating label behavior of TextField.
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const TableTextInput: FC<Props> = ({
  classes,
  value,
  patternValidityMessage,
  maxLength,
  pattern,
  readOnly,
  filter,
  ...rest
}) => {
  const id = useId();
  const { readOnlyInputs } = useFormMode();

  const [val, setVal] = useState(value);
  const regex = new RegExp(pattern);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showError, setShowError] = useState<boolean>(false);
  useEffect(() => {
    const invalid = () => {
      setShowError(true);
    };

    inputRef.current?.addEventListener("invalid", invalid);
    return () => {
      inputRef.current?.removeEventListener("invalid", invalid);
    };
  }, [inputRef]);

  const onChange = (newVal) => {
    setShowError(false);
    if (typeof filter === "function") {
      newVal = filter(newVal);
    }
    if (typeof maxLength === "number" && newVal.length > maxLength) {
      newVal = newVal.slice(0, maxLength);
    }
    if (!newVal.match(regex)) {
      updateInputValidity(
        inputRef,
        patternValidityMessage || "Please enter input in the correct format"
      );
    } else {
      updateInputValidity(inputRef);
    }
    setVal(newVal);
  };

  useEffect(() => {
    onChange(value.toString().trim());
  }, [value]);
  return (
    <StyledTooltip
      title="Missing required field"
      arrow
      disableHoverListener
      disableFocusListener
      disableTouchListener
      open={showError}
    >
      <StyledInput
        inputRef={inputRef}
        sx={{ width: "100%", display: "flex", alignItems: "center" }}
        id={id}
        size="small"
        value={val}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        disableUnderline
        readOnly={readOnlyInputs || readOnly}
      />
    </StyledTooltip>
  );
};

export default TableTextInput;
