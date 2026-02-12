import { FormControl, FormHelperText, Grid, TextFieldProps, styled } from "@mui/material";
import { DatePicker, DatePickerProps } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import React, { FC, useEffect, useId, useRef, useState } from "react";

import calendarIcon from "../../assets/icons/calendar.svg?url";
import { updateInputValidity } from "../../utils";
import Tooltip from "../Tooltip";

const CalendarIcon = styled("div")(() => ({
  backgroundImage: `url("${calendarIcon}")`,
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  width: "22.77px",
  height: "22.06px",
}));

const GridItem = styled(Grid)(({ theme }) => ({
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

const StyledAsterisk = styled("span")(() => ({
  color: "#C93F08",
  marginLeft: "2px",
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

const StyledFormHelperText = styled(FormHelperText)(() => ({
  marginTop: "4px",
  minHeight: "20px",
}));

const StyledDatePicker = styled(DatePicker)(() => ({
  "& .MuiInputBase-root": {
    borderRadius: "8px",
    backgroundColor: "#FFFFFF",
    color: "#083A50",
  },
  "& .MuiInputBase-input": {
    fontWeight: 400,
    fontSize: "16px",
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    lineHeight: "19.6px",
    padding: "12px",
    height: "20px",
  },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
    border: "1px solid #209D7D !important",
    boxShadow:
      "2px 2px 4px 0px rgba(38, 184, 147, 0.10), -1px -1px 6px 0px rgba(38, 184, 147, 0.20)",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "#6B7294",
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
  // Target readOnly <input> inputs
  "& .Mui-readOnly.MuiInputBase-root, .Mui-readOnly .MuiInputBase-input": {
    backgroundColor: "#E5EEF4",
    color: "#083A50",
    cursor: "not-allowed",
    overflow: "hidden",
  },
}));

type Props = {
  inputID: string;
  initialValue?: string | Date;
  label: string;
  infoText?: string;
  errorText?: string;
  tooltipText?: string;
  gridWidth?: 2 | 4 | 6 | 8 | 10 | 12;
  maxLength?: number;
  name?: string;
  required?: boolean;
  inputProps?: TextFieldProps;
} & DatePickerProps<Dayjs>;

/**
 * Generates a generic date picker input with a label, help text, and tooltip text
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const DatePickerInput: FC<Props> = ({
  inputID,
  initialValue,
  label,
  name,
  required = false,
  inputProps,
  gridWidth,
  maxLength,
  infoText,
  tooltipText,
  errorText,
  disablePast,
  format = "MM/DD/YYYY",
  onChange,
  readOnly,
  ...rest
}) => {
  const id = inputID || useId();

  const [val, setVal] = useState<Dayjs>(dayjs(initialValue || null));
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>(
    errorText || (required ? "This field is required" : null)
  );
  const inputRef = useRef<HTMLInputElement>(null);
  dayjs.extend(timezone);
  dayjs.tz.setDefault("America/New_York");

  const processValue = (inputVal: Dayjs) => {
    const isInvalidDay = !inputVal?.isValid();
    const isPastDate = inputVal?.isBefore(dayjs(new Date()).tz().startOf("day"));

    let newErrorMsg = "";
    if (required && !inputVal) {
      newErrorMsg = "This field is required";
    } else if (disablePast && isPastDate) {
      newErrorMsg = "The date is invalid. Please select today's date or a future date";
    } else if (
      (required || (inputVal !== null && inputRef.current?.value !== format)) &&
      isInvalidDay
    ) {
      newErrorMsg = `The date is invalid. Please enter a date in the format ${format}`;
    }

    updateInputValidity(inputRef, newErrorMsg);
    setErrorMsg(newErrorMsg);
    setVal(inputVal);
  };

  const onChangeWrapper = (newVal: Dayjs) => {
    if (typeof onChange === "function") {
      onChange(newVal, null);
    }

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
    processValue(dayjs(initialValue?.toString()?.trim()));
  }, [initialValue]);

  return (
    <GridItem md={gridWidth || 6} xs={12} item>
      <StyledFormControl fullWidth error={error}>
        <StyledFormLabel htmlFor={id}>
          {label}
          {required ? <StyledAsterisk>*</StyledAsterisk> : ""}
          {tooltipText && <Tooltip title={tooltipText} />}
        </StyledFormLabel>
        <StyledDatePicker
          value={val}
          onChange={(value: Dayjs) => {
            onChangeWrapper(value.tz());
          }}
          inputRef={inputRef}
          disablePast={disablePast}
          format={format}
          readOnly={readOnly}
          slots={{ openPickerIcon: CalendarIcon }}
          slotProps={{
            textField: {
              id,
              name,
              required,
              error,
              onInput: (event: React.ChangeEvent<HTMLInputElement>) => {
                onChangeWrapper(dayjs(event?.target?.value));
              },
              size: "small",
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                onChangeWrapper(event as unknown as Dayjs);
              },
              ...inputProps,
            },
            popper: {
              placement: "bottom-end",
              disablePortal: true,
              modifiers: [
                {
                  // disables popper from flipping above the input when out of screen room
                  name: "flip",
                  enabled: false,
                  options: {
                    fallbackPlacements: [],
                  },
                },
              ],
            },
          }}
          {...rest}
        />
        <StyledFormHelperText>{(error ? errorMsg : infoText) || " "}</StyledFormHelperText>
      </StyledFormControl>
    </GridItem>
  );
};

export default DatePickerInput;
