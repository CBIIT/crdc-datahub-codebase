import {
  Grid,
  FormControl,
  FormControlLabel,
  RadioGroup,
  RadioGroupProps,
  FormHelperText,
  styled,
  GridProps,
} from "@mui/material";
import React, { FC, useState, useRef, useEffect } from "react";

import { updateInputValidity } from "../../utils";

import StyledRadioButton from "./StyledRadioButton";

const GridStyled = styled(Grid, {
  shouldForwardProp: (prop) => prop !== "containerWidth",
})<GridProps & { containerWidth?: string }>(({ containerWidth }) => ({
  width: containerWidth,
  "& .formControl": {
    marginTop: "8px",
    marginBottom: "4px",
  },
  "& .css-hsm3ra-MuiFormLabel-root": {
    color: "rgba(0, 0, 0, 0.6) !important",
  },
  "& .MuiRadio-root": {
    color: "#1D91AB !important",
    marginLeft: "10px",
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
}));

const StyledFormLabel = styled("label")(() => ({
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "19.6px",
  minHeight: "20px",
  color: "#083A50",
  marginBottom: "4px",
}));

const StyledAsterisk = styled("span")(() => ({
  marginLeft: "2px",
  color: "#C93F08",
}));

type Props = {
  label: string;
  name: string;
  containerWidth?: string;
  value: string | boolean;
  id: string;
  helpText?: string;
  required?: boolean;
  readOnly?: boolean;
  gridWidth?: 2 | 4 | 6 | 8 | 10 | 12;
} & RadioGroupProps;

const RadioYesNoInput: FC<Props> = ({
  label,
  name,
  gridWidth,
  containerWidth,
  value,
  id,
  helpText,
  required,
  readOnly,
  ...rest
}) => {
  const [val, setVal] = useState<string>(
    value?.toString() === "" || value?.toString() === undefined ? null : value?.toString()
  );
  const [error, setError] = useState(false);
  const radioGroupInputRef = useRef<HTMLInputElement>(null);

  const onChangeWrapper = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) {
      return;
    }
    const newValue = (event.target as HTMLInputElement).value;
    setVal(newValue === "" ? null : newValue);
    setError(false);
  };

  useEffect(() => {
    if (required && val === null) {
      updateInputValidity(radioGroupInputRef, "Please select an option");
    } else {
      updateInputValidity(radioGroupInputRef);
    }
  }, [val]);

  useEffect(() => {
    const invalid = () => setError(true);

    radioGroupInputRef.current?.addEventListener("invalid", invalid);
    return () => {
      radioGroupInputRef.current?.removeEventListener("invalid", invalid);
    };
  }, [radioGroupInputRef]);

  useEffect(() => {
    setVal(value?.toString() === "" || value?.toString() === undefined ? null : value?.toString());
  }, [value]);

  return (
    <GridStyled md={gridWidth || 6} xs={12} item containerWidth={containerWidth}>
      <FormControl className="formControl" error={error}>
        <StyledFormLabel>
          {label}
          {required ? <StyledAsterisk>*</StyledAsterisk> : ""}
        </StyledFormLabel>
        <RadioGroup
          name={name}
          value={val}
          onChange={onChangeWrapper}
          id={id}
          data-type="string"
          {...rest}
        >
          <FormControlLabel
            value="true"
            color="#1D91AB"
            control={
              <StyledRadioButton
                inputRef={radioGroupInputRef}
                id={id.concat("-yes-radio-button")}
                readOnly={readOnly}
                disabled={readOnly}
              />
            }
            label="Yes"
          />
          <FormControlLabel
            value="false"
            color="#1D91AB"
            control={
              <StyledRadioButton
                id={id.concat("-no-radio-button")}
                readOnly={readOnly}
                disabled={readOnly}
              />
            }
            label="No"
          />
        </RadioGroup>
        <FormHelperText className={(!readOnly && error ? "" : "displayNone") || ""}>
          {(!readOnly && error ? "This field is required" : null) || " "}
        </FormHelperText>
      </FormControl>
    </GridStyled>
  );
};

export default RadioYesNoInput;
