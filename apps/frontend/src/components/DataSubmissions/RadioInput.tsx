import {
  FormControl,
  FormControlLabel,
  RadioGroup,
  RadioGroupProps,
  Stack,
  styled,
  SxProps,
} from "@mui/material";
import React, { useState, useRef, useEffect, useId, forwardRef, ReactNode } from "react";

import { updateInputValidity } from "../../utils";
import StyledRadioButton from "../Questionnaire/StyledRadioButton";
import { StyledLabel } from "../Questionnaire/TextInput";
import StyledAsterisk from "../StyledFormComponents/StyledAsterisk";
import StyledTooltip from "../StyledFormComponents/StyledTooltip";

const StyledFormControl = styled(Stack)<{ component: React.ElementType }>({
  marginTop: "0",
  marginBottom: "0",
  "& .css-hsm3ra-MuiFormLabel-root": {
    color: "rgba(0, 0, 0, 0.6) !important",
  },
  "& .MuiRadio-root": {
    color: "#1D91AB !important",
    marginLeft: "10px",
    paddingRight: "7px",
  },
  "& #invisibleRadioInput": {
    height: 0,
    border: "none",
    width: 0,
  },
  "& .MuiFormHelperText-root": {
    color: "#083A50",
    marginLeft: 0,
  },
  "& .MuiFormHelperText-root.Mui-error": {
    color: "#D54309 !important",
  },
  "& .displayNone": {
    display: "none !important",
  },
});

const StyledFormLabel = styled(StyledLabel)({
  marginRight: "10px",
});

const StyledFormControlLabel = styled(FormControlLabel)(() => ({
  "&.MuiFormControlLabel-root": {
    paddingRight: "5px",
    marginRight: "2px",
  },
  "& .MuiFormControlLabel-label": {
    color: "#083A50",
    fontFamily: "'Nunito'",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 500,
    lineHeight: "19.6px",
  },
}));

export type RadioOption = {
  label: string;
  value: string;
  disabled?: boolean;
  optionSx?: SxProps;
  tooltipContent: string | ReactNode;
};

type Props = {
  label: string;
  name?: string;
  value: string | boolean;
  options: RadioOption[];
  id: string;
  inline?: boolean;
  helpText?: string;
  required?: boolean;
} & RadioGroupProps;

/**
 * @deprecated Do not use this component. It is deprecated and will be removed in a future release.
 */
const RadioInput = forwardRef<HTMLDivElement, Props>(
  ({ label, name, value, options, id, inline, helpText, required, ...rest }, ref) => {
    const radioId = id || useId();
    const [val, setVal] = useState<string>(
      value?.toString() === "" || value?.toString() === undefined ? null : value?.toString()
    );
    const radioGroupInputRef = useRef<HTMLInputElement>(null);

    const onChangeWrapper = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = (event.target as HTMLInputElement).value;
      setVal(newValue === "" ? null : newValue);
    };

    useEffect(() => {
      if (required && val === null) {
        updateInputValidity(radioGroupInputRef, "Please select an option");
      } else {
        updateInputValidity(radioGroupInputRef);
      }
    }, [val]);

    useEffect(() => {
      setVal(value?.toString() ?? null);
    }, [value]);

    return (
      <StyledFormControl
        component={FormControl}
        direction={inline ? "row" : "column"}
        alignItems={inline ? "center" : "initial"}
      >
        <StyledFormLabel className="radio-label" htmlFor={radioId}>
          {label}
          {required ? <StyledAsterisk /> : ""}
        </StyledFormLabel>
        <RadioGroup
          ref={ref}
          name={name}
          value={val}
          onChange={onChangeWrapper}
          id={radioId}
          {...rest}
        >
          {options?.map((option: RadioOption, idx: number) => (
            <StyledTooltip
              key={`${option.label}-${option.value}}`}
              title={option.tooltipContent}
              disableInteractive
            >
              <StyledFormControlLabel
                value={option.value}
                label={option.label}
                sx={option.optionSx}
                color="#1D91AB"
                control={
                  <StyledRadioButton
                    id={id.concat(`-${option.label}-radio-button`)}
                    readOnly={option.disabled}
                    disabled={option.disabled}
                    {...(idx === 0 && { inputRef: radioGroupInputRef })}
                  />
                }
              />
            </StyledTooltip>
          ))}
        </RadioGroup>
      </StyledFormControl>
    );
  }
);

export default RadioInput;
