import {
  FormControl,
  FormHelperText,
  Grid,
  MenuItem,
  Select,
  SelectProps,
  styled,
} from "@mui/material";
import React, { FC, ReactNode, useEffect, useId, useRef, useState } from "react";

import dropdownArrowsIcon from "../../assets/icons/dropdown_arrows.svg?url";
import { updateInputValidity } from "../../utils";
import Tooltip from "../Tooltip";

const DropdownArrowsIcon = styled("div")(() => ({
  backgroundImage: `url("${dropdownArrowsIcon}")`,
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  width: "10px",
  height: "18px",
}));

const GridItem = styled(Grid)(() => ({
  "& .MuiFormHelperText-root.Mui-error": {
    color: "#D54309 !important",
    marginLeft: "0px",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderRadius: "8px",
    borderColor: "#6B7294",
    padding: "0 12px",
  },
  "&.Mui-error fieldset": {
    borderColor: "#D54309 !important",
  },
  "& .MuiSelect-icon": {
    right: "12px",
  },
  "& .MuiSelect-iconOpen": {
    transform: "none",
  },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
    border: "1px solid #209D7D !important",
    boxShadow:
      "2px 2px 4px 0px rgba(38, 184, 147, 0.10), -1px -1px 6px 0px rgba(38, 184, 147, 0.20)",
  },
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

const ProxySelect = styled("select")(() => ({
  display: "none",
}));

const StyledSelect = styled(Select, {
  shouldForwardProp: (prop) => prop !== "placeholderText",
})<SelectProps & { placeholderText: string }>((props) => ({
  "& .MuiSelect-select .notranslate::after": {
    // content: `'${(props) => props.placeholderText || "none"}'`,
    content: `'${props.placeholderText ?? "Select"}'`,
    color: "#87878C",
    fontWeight: 400,
    opacity: 1,
  },
  "& .MuiPaper-root": {
    borderRadius: "8px",
    border: "1px solid #6B7294",
    marginTop: "2px",
    "& .MuiList-root": {
      padding: 0,
      overflow: "auto",
      maxHeight: "40vh",
    },
    "& .MuiMenuItem-root": {
      padding: "0 10px",
      height: "35px",
      color: "#083A50",
      background: "#FFFFFF",
    },
    "& .MuiMenuItem-root.Mui-selected": {
      backgroundColor: "#3E7E6D",
      color: "#FFFFFF",
    },
    "& .MuiMenuItem-root:hover": {
      background: "#3E7E6D",
      color: "#FFFFFF",
    },
    "& .MuiMenuItem-root.Mui-focused": {
      backgroundColor: "#3E7E6D !important",
      color: "#FFFFFF",
    },
  },
  "& .MuiInputBase-input": {
    backgroundColor: "#fff",
    color: "#083A50 !important",
    fontWeight: 400,
    fontSize: "16px",
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    lineHeight: "19.6px",
    padding: "12px",
    height: "20px !important",
    minHeight: "20px !important",
    "&::placeholder": {
      color: "#87878C",
      fontWeight: 400,
      opacity: 1,
    },
  },
  // Target readOnly <input> inputs
  "& .Mui-readOnly.MuiOutlinedInput-input:read-only": {
    backgroundColor: "#E5EEF4",
    color: "#083A50",
    cursor: "not-allowed",
    borderRadius: "8px",
  },
}));

const StyledHelperText = styled(FormHelperText)(() => ({
  marginTop: "4px",
  minHeight: "20px",
}));

type Props = {
  value: string | string[];
  options: SelectOption[];
  name?: string;
  label: string;
  required?: boolean;
  helpText?: string;
  tooltipText?: string | ReactNode;
  gridWidth?: 2 | 4 | 6 | 8 | 10 | 12;
  onChange?: (value: string | string[]) => void;
  filter?: (input: string | string[]) => string | string[];
} & Omit<SelectProps, "onChange">;

/**
 * Generates a generic select box with a label and help text
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const SelectInput: FC<Props> = ({
  value,
  name,
  label,
  options,
  required = false,
  helpText,
  tooltipText,
  gridWidth,
  onChange,
  filter,
  multiple,
  placeholder,
  readOnly,
  ...rest
}) => {
  const id = rest.id || useId();

  const [val, setVal] = useState(multiple ? [] : "");
  const [error, setError] = useState(false);
  const [minWidth, setMinWidth] = useState<number | null>(null);
  const helperText = helpText || (required ? "This field is required" : " ");
  const selectRef = useRef(null);
  const inputRef = useRef(null);

  const processValue = (newValue: string | string[]) => {
    const inputIsArray = Array.isArray(newValue);
    if (multiple && !inputIsArray) {
      updateInputValidity(inputRef, "Please select at least one option");
    } else if (inputIsArray) {
      const containsOnlyValidOptions = newValue.every(
        (value: string) => !!options.find((option) => option.value === value)
      );
      updateInputValidity(
        inputRef,
        containsOnlyValidOptions ? "" : "Please select only valid options"
      );
    } else if (required && !options.findIndex((option) => option.value === newValue)) {
      updateInputValidity(inputRef, "Please select an entry from the list");
    } else {
      updateInputValidity(inputRef, "");
    }

    if (!newValue && multiple) {
      setVal([]);
      return;
    }

    setVal(newValue || "");
  };

  const onChangeWrapper = (newVal) => {
    let filteredVal = newVal;
    if (typeof filter === "function") {
      filteredVal = filter(newVal);
    }
    if (typeof onChange === "function") {
      onChange(filteredVal);
    }

    processValue(filteredVal);
    setError(false);
  };

  const handleOpen = () => {
    if (!selectRef.current) {
      return;
    }

    setMinWidth(selectRef.current.offsetWidth);
  };

  useEffect(() => {
    const invalid = () => setError(true);

    inputRef.current?.node?.addEventListener("invalid", invalid);
    return () => {
      inputRef.current?.node?.removeEventListener("invalid", invalid);
    };
  }, [inputRef]);

  useEffect(() => {
    processValue(value);
  }, [value]);

  return (
    <GridItem md={gridWidth || 6} xs={12} item>
      <FormControl fullWidth error={error}>
        <StyledFormLabel htmlFor={id} id={`${id}-label`}>
          {label}
          {required ? <StyledAsterisk>*</StyledAsterisk> : ""}
          {tooltipText && <Tooltip placement="right" title={tooltipText} />}
        </StyledFormLabel>
        <StyledSelect
          ref={selectRef}
          size="small"
          value={val}
          onChange={(e) => onChangeWrapper(e.target.value)}
          required={required}
          IconComponent={DropdownArrowsIcon}
          onOpen={handleOpen}
          MenuProps={{
            disablePortal: true,
            sx: { width: minWidth ? `${minWidth}px` : "auto" },
          }}
          slotProps={{ input: { id } }}
          multiple={multiple}
          placeholderText={placeholder}
          readOnly={readOnly}
          inputRef={inputRef}
          {...rest}
          id={id}
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </StyledSelect>

        {/* Proxy select for the form parser to correctly parse data if multiple attribute is on */}
        <ProxySelect
          name={name}
          value={val}
          onChange={() => {}}
          multiple={multiple}
          aria-labelledby={`${id}-label`}
          hidden
        >
          <option value="" aria-label="Empty" />
          {options.map((option) => (
            <option key={option.value} value={option.value} aria-label={`${option.value}`} />
          ))}
        </ProxySelect>
        <StyledHelperText>{!readOnly && error ? helperText : " "}</StyledHelperText>
      </FormControl>
    </GridItem>
  );
};

export default SelectInput;
