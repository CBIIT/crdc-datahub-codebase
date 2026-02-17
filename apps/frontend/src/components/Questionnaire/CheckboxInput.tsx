import {
  Checkbox,
  CheckboxProps,
  FormControl,
  FormControlLabel,
  FormHelperText,
  styled,
} from "@mui/material";
import React, { FC, useId, useState } from "react";

import checkboxCheckedIcon from "../../assets/icons/checkbox_checked.svg?url";
import Tooltip from "../Tooltip";

const UncheckedIcon = styled("div")<{ readOnly?: boolean }>(({ readOnly }) => ({
  outline: "2px solid #1D91AB",
  outlineOffset: -2,
  width: "24px",
  height: "24px",
  backgroundColor: readOnly ? "#E5EEF4" : "initial",
  color: "#083A50",
  cursor: readOnly ? "not-allowed" : "pointer",
}));

const CheckedIcon = styled("div")<{ readOnly?: boolean }>(({ readOnly }) => ({
  backgroundImage: `url("${checkboxCheckedIcon}")`,
  backgroundSize: "auto",
  backgroundRepeat: "no-repeat",
  width: "24px",
  height: "24px",
  backgroundColor: readOnly ? "#E5EEF4" : "initial",
  color: "#1D91AB",
  cursor: readOnly ? "not-allowed" : "pointer",
}));

const StyledFormControl = styled(FormControl)(() => ({
  width: "auto",
  display: "inline-block",
}));

const StyledAsterisk = styled("span")(() => ({
  color: "#C93F08",
  marginLeft: "2px",
}));

const StyledFormControlLabel = styled(FormControlLabel)(({ theme }) => ({
  width: "fit-content",
  pointerEvents: "none",
  marginLeft: "-10px",
  marginRight: "30px",
  "& .MuiButtonBase-root ": {
    pointerEvents: "all",
  },
  "& .MuiFormControlLabel-label": {
    fontWeight: 700,
    fontSize: "16px",
    lineHeight: "19.6px",
    minHeight: "20px",
    color: "#083A50",
    [theme.breakpoints.up("lg")]: {
      whiteSpace: "nowrap",
    },
  },
}));

const StyledFormLabel = styled("label")(({ theme }) => ({
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "19.6px",
  minHeight: "20px",
  color: "#083A50",
  marginBottom: "4px",
  [theme.breakpoints.up("lg")]: {
    whiteSpace: "nowrap",
  },
}));

const StyledCheckbox = styled(Checkbox)(({ readOnly }) => ({
  cursor: readOnly ? "not-allowed" : "pointer",
  "&.MuiCheckbox-root": {
    padding: "10px",
  },
  "& .MuiSvgIcon-root": {
    fontSize: "24px",
  },
}));

type GridWidth = 2 | 4 | 6 | 8 | 10 | 12;

type Props = {
  value: string;
  name?: string;
  label?: string;
  inputLabel: string;
  errorText?: string;
  tooltipText?: string;
  inputLabelTooltipText?: string;
  required?: boolean;
  helpText?: string;
  gridWidth?: GridWidth;
  onChange?: (value: string, checked: boolean) => void;
} & Omit<CheckboxProps, "onChange">;

const CheckboxInput: FC<Props> = ({
  value,
  label,
  inputLabel,
  name,
  required = false,
  helpText,
  tooltipText,
  inputLabelTooltipText,
  errorText,
  onChange,
  gridWidth,
  readOnly,
  ...rest
}) => {
  const id = useId();

  const [val, setVal] = useState(value);
  const [error] = useState(false);
  const helperText = helpText || (required ? "This field is required" : " ");

  const onChangeWrapper = (newVal: string, checked: boolean) => {
    if (readOnly) {
      return;
    }
    if (typeof onChange === "function") {
      onChange(newVal, checked);
    }

    setVal(newVal);
  };

  return (
    <StyledFormControl fullWidth error={error}>
      {(label || required || tooltipText) && (
        <StyledFormLabel htmlFor={id}>
          {label}
          {required ? <StyledAsterisk>*</StyledAsterisk> : ""}
          {tooltipText && <Tooltip title={tooltipText} />}
        </StyledFormLabel>
      )}
      <StyledFormControlLabel
        value={val}
        control={
          <StyledCheckbox
            name={name}
            icon={<UncheckedIcon readOnly={readOnly} />}
            checkedIcon={<CheckedIcon readOnly={readOnly} />}
            onChange={(e, checked) => onChangeWrapper(e.target.value, checked)}
            disableRipple
            readOnly={readOnly}
            {...rest}
          />
        }
        label={
          <>
            {inputLabel}
            {inputLabelTooltipText && <Tooltip title={inputLabelTooltipText} />}
          </>
        }
        labelPlacement="end"
      />
      {error && <FormHelperText>{error ? helperText : " "}</FormHelperText>}
    </StyledFormControl>
  );
};

export default CheckboxInput;
