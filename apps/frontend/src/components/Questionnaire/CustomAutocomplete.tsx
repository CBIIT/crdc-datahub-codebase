import {
  AutocompleteChangeReason,
  AutocompleteProps,
  AutocompleteValue,
  FormControl,
  Grid,
  TextField,
  styled,
} from "@mui/material";
import { ReactNode, SyntheticEvent, useEffect, useId, useRef, useState } from "react";

import { updateInputValidity } from "../../utils";
import StyledAsterisk from "../StyledFormComponents/StyledAsterisk";
import StyledAutocomplete from "../StyledFormComponents/StyledAutocomplete";
import StyledHelperText from "../StyledFormComponents/StyledHelperText";
import StyledLabel from "../StyledFormComponents/StyledLabel";
import Tooltip from "../Tooltip";

const StyledFormControl = styled(FormControl)({
  height: "100%",
  justifyContent: "end",
  "& .MuiFormHelperText-root.Mui-error": {
    color: "#D54309 !important",
  },
});

const StyledTag = styled("div")({
  paddingLeft: "12px",
  position: "absolute",
});

const ProxySelect = styled("select")({
  display: "none",
});

export type CustomProps = {
  /**
   * The HTML form name attribute
   *
   * @note Used to parse the form data into a JSON object
   */
  name: string;
  /**
   * The label text for the input to display above the input field
   */
  label: string;
  /**
   * The value of the input field
   */
  value: string[];
  /**
   * The options to display in the input selection dropdown
   */
  options: string[];
  /**
   * The text to display in the placeholder when multiple values are selected
   */
  tagText: (value: string[]) => string;
  /**
   * The width of the input in the form grid
   */
  gridWidth?: 2 | 4 | 6 | 8 | 10 | 12;
  helpText?: string;
  tooltipText?: string | ReactNode;
  required?: boolean;
  validate?: (input: string | string[]) => boolean;
} & Omit<AutocompleteProps<string, boolean, true, true, "div">, "renderInput">;

/**
 * Provides a custom autocomplete input field with a label and helper text.  The primary focus is:
 *
 * - Disable the clear button
 * - Constrain the rendering of tags to a single line
 * - Sort the selected options above the unselected options after blur
 *
 * @note This component supports only string values currently
 * @param {CustomProps} props
 * @returns {JSX.Element}
 */
const CustomAutocomplete = ({
  tagText,
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
  readOnly,
  ...rest
}: CustomProps): JSX.Element => {
  const id = rest.id || useId();

  const [val, setVal] = useState<string[]>(value);
  const [error, setError] = useState<boolean>(false);
  const [hasFocus, setHasFocus] = useState<boolean>(false);
  const [separatedOptions, setSeparatedOptions] = useState<string[]>(options);

  const helperText = helpText || (required ? "This field is required" : " ");
  const inputRef = useRef<HTMLInputElement>(null);

  const processValue = (newValue: string[]) => {
    if (typeof validate === "function") {
      const customIsValid = validate(newValue);
      updateInputValidity(inputRef, !customIsValid ? helpText : "");
    } else if (required) {
      updateInputValidity(inputRef, !newValue ? helperText : "");
    }

    setVal(newValue);
  };

  const onChangeWrapper = (
    event: SyntheticEvent,
    newValue: AutocompleteValue<string[], false, false, false>,
    reason: AutocompleteChangeReason
  ): void => {
    if (typeof onChange === "function") {
      onChange(event, newValue, reason);
    }

    processValue(newValue);
    setError(false);
  };

  const handleInputBlur = () => {
    setHasFocus(false);
    sortOptions(true);
  };

  const sortOptions = (force = false) => {
    if (hasFocus && !force) {
      return;
    }

    const selectedOptions = val
      .filter((v) => options.includes(v))
      .sort((a, b) => a.localeCompare(b));
    const unselectedOptions = options.filter((o) => !selectedOptions.includes(o));

    setSeparatedOptions([...selectedOptions, ...unselectedOptions]);
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

  useEffect(() => {
    sortOptions();
  }, [options, val]);

  return (
    <Grid md={gridWidth || 6} xs={12} item>
      <StyledFormControl fullWidth error={error}>
        <StyledLabel htmlFor={id} id={`${id}-label`}>
          {label}
          {required ? <StyledAsterisk /> : ""}
          {tooltipText && <Tooltip placement="right" title={tooltipText} />}
        </StyledLabel>
        <StyledAutocomplete
          value={val}
          onChange={onChangeWrapper}
          options={separatedOptions}
          readOnly={readOnly}
          getOptionLabel={(option: string) => option}
          renderTags={(value: string[]) => {
            if (value?.length === 0 || hasFocus) {
              return null;
            }

            if (value.length === 1) {
              return <StyledTag>{value[0]}</StyledTag>;
            }

            return <StyledTag>{tagText(value)}</StyledTag>;
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={inputRef}
              placeholder={val?.length > 0 ? undefined : placeholder}
              id={id}
              onFocus={() => !readOnly && setHasFocus(true)}
              onBlur={handleInputBlur}
              onKeyDown={(event) => {
                // Prevent backspace from clearing input tags
                if (event.key === "Backspace") {
                  event.stopPropagation();
                }
              }}
            />
          )}
          {...rest}
        />
        <StyledHelperText>{!readOnly && error ? helperText : " "}</StyledHelperText>
      </StyledFormControl>
      <ProxySelect
        name={name}
        value={val}
        aria-labelledby={`${id}-label`}
        onChange={() => {}}
        multiple
        hidden
      >
        {val.map((v) => (
          <option key={v} value={v} aria-label={v} />
        ))}
      </ProxySelect>
    </Grid>
  );
};

export default CustomAutocomplete;
