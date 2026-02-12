import {
  Autocomplete,
  AutocompleteChangeReason,
  AutocompleteProps,
  AutocompleteValue,
  FormControl,
  FormHelperText,
  Grid,
  TextField,
  styled,
} from "@mui/material";
import { ReactNode, SyntheticEvent, useEffect, useId, useRef, useState } from "react";

import DropdownArrowsIconSvg from "../../assets/icons/dropdown_arrows.svg?react";
import { updateInputValidity } from "../../utils";
import Tooltip from "../Tooltip";

const StyledFormControl = styled(FormControl)(() => ({
  height: "100%",
  justifyContent: "end",
  "& .MuiFormHelperText-root.Mui-error": {
    color: "#D54309 !important",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderRadius: "8px",
    borderColor: "#6B7294",
  },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
    border: "1px solid #209D7D !important",
    boxShadow:
      "2px 2px 4px 0px rgba(38, 184, 147, 0.10), -1px -1px 6px 0px rgba(38, 184, 147, 0.20)",
  },
  "& .Mui-error fieldset": {
    borderColor: "#D54309 !important",
  },
  "& .MuiInputBase-input::placeholder": {
    color: "#87878C",
    fontWeight: 400,
    opacity: 1,
  },
  "& .MuiAutocomplete-input": {
    color: "#083A50",
  },
  "& .MuiAutocomplete-root .MuiAutocomplete-endAdornment": {
    top: "50%",
    transform: "translateY(-50%)",
    right: "12px",
  },
  "& .MuiAutocomplete-popupIndicator": {
    marginRight: "1px",
  },
  "& .MuiAutocomplete-popupIndicatorOpen": {
    transform: "none",
  },

  "& .MuiPaper-root": {
    borderRadius: "8px",
    border: "1px solid #6B7294",
    marginTop: "2px",
    maxHeight: "270px",
    "& .MuiAutocomplete-listbox": {
      padding: 0,
      overflow: "auto",
      width: "fit-content",
      minWidth: "100%",
      maxHeight: "unset",
    },
    "& .MuiAutocomplete-option[aria-selected='true']": {
      color: "#083A50",
      background: "#FFFFFF",
    },
    "& .MuiAutocomplete-option": {
      padding: "7.5px 10px",
      minHeight: "35px",
      color: "#083A50",
      background: "#FFFFFF",
      whiteSpace: "nowrap",
    },
    "& .MuiAutocomplete-option:hover": {
      backgroundColor: "#3E7E6D",
      color: "#FFFFFF",
    },
    "& .MuiAutocomplete-option.Mui-focused": {
      backgroundColor: "#3E7E6D !important",
      color: "#FFFFFF",
    },
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
  color: "#C93F08",
  marginLeft: "2px",
}));

const StyledAutocomplete = styled(Autocomplete)(({ readOnly }: { readOnly?: boolean }) => ({
  "& .MuiInputBase-root": {
    "&.MuiAutocomplete-inputRoot.MuiInputBase-root": {
      display: "flex",
      alignItems: "center",
      padding: 0,
    },
    "& .MuiOutlinedInput-input:read-only": {
      backgroundColor: "#E5EEF4",
      color: "#083A50",
      cursor: "not-allowed",
      borderRadius: "8px",
    },
    "& .MuiInputBase-input": {
      fontWeight: 400,
      fontSize: "16px",
      fontFamily: "'Nunito', 'Rubik', sans-serif",
      padding: "12px 30px 12px 12px !important",
      height: "20px",
      cursor: readOnly ? "not-allowed !important" : "initial",
    },
    "& .MuiAutocomplete-clearIndicator": {
      visibility: "hidden !important",
      position: "absolute",
    },
  },
}));

const StyledFormHelperText = styled(FormHelperText)(() => ({
  marginLeft: 0,
  marginTop: "4px",
  minHeight: "20px",
}));

type Props<T> = {
  name?: string;
  label?: string;
  value?: T;
  options?: T[];
  gridWidth?: 2 | 4 | 6 | 8 | 10 | 12;
  helpText?: string;
  tooltipText?: string | ReactNode;
  required?: boolean;
  validate?: (input: T) => boolean;
} & Omit<AutocompleteProps<T, false, true, true, "div">, "renderInput">;

const AutocompleteInput = <T,>({
  name,
  label,
  gridWidth,
  helpText,
  tooltipText,
  required,
  value,
  onChange,
  options,
  validate,
  placeholder,
  freeSolo,
  readOnly,
  ...rest
}: Props<T>) => {
  const id = rest.id || useId();

  const [val, setVal] = useState<T>(value);
  const [error, setError] = useState<boolean>(false);
  const helperText = helpText || (required ? "This field is required" : " ");
  const inputRef = useRef<HTMLInputElement>(null);

  const processValue = (newValue: T) => {
    if (typeof validate === "function") {
      const customIsValid = validate(newValue);
      updateInputValidity(inputRef, !customIsValid ? helperText : "");
    } else if (required) {
      updateInputValidity(inputRef, !newValue ? helperText : "");
    }

    setVal(newValue);
  };

  const onChangeWrapper = (
    event: SyntheticEvent,
    newValue: AutocompleteValue<T, false, false, false>,
    reason: AutocompleteChangeReason
  ): void => {
    if (typeof onChange === "function") {
      onChange(event, newValue, reason);
    }

    processValue(newValue);
    setError(false);
  };

  const onInputChangeWrapper = (event: SyntheticEvent, newValue: string): void => {
    processValue(newValue as unknown as T);
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
    processValue(value);
  }, [value]);

  return (
    <Grid md={gridWidth || 6} xs={12} item>
      <StyledFormControl fullWidth error={error}>
        <StyledFormLabel htmlFor={id}>
          {label}
          {required ? <StyledAsterisk>*</StyledAsterisk> : ""}
          {tooltipText && <Tooltip placement="right" title={tooltipText} />}
        </StyledFormLabel>
        <StyledAutocomplete
          value={val}
          onChange={onChangeWrapper}
          onInputChange={onInputChangeWrapper}
          options={options}
          readOnly={readOnly}
          forcePopupIcon
          popupIcon={<DropdownArrowsIconSvg />}
          freeSolo={freeSolo}
          slotProps={{
            popper: {
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
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={inputRef}
              name={name}
              required={required}
              placeholder={placeholder}
              id={id}
            />
          )}
          {...rest}
        />
        <StyledFormHelperText>{!readOnly && error ? helperText : " "}</StyledFormHelperText>
      </StyledFormControl>
    </Grid>
  );
};

export default AutocompleteInput;
