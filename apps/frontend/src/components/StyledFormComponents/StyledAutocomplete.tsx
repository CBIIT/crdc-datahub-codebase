import { Autocomplete, Paper, styled } from "@mui/material";

import dropdownArrowsIcon from "../../assets/icons/dropdown_arrows.svg?url";

const StyledAutocomplete = styled(Autocomplete)(({ readOnly }: { readOnly?: boolean }) => ({
  "& .MuiInputBase-root": {
    "&.MuiAutocomplete-inputRoot.MuiInputBase-root": {
      padding: 0,
      color: "#083A50",
    },

    ...(readOnly && {
      "& *": {
        cursor: "not-allowed",
      },
    }),
  },

  // Base input
  "& .MuiInputBase-input": {
    backgroundColor: "#fff",
    padding: "10.5px 30px 10.5px 12px !important",
    minHeight: "20px !important",
    ...(readOnly && {
      backgroundColor: "#E5EEF4",
      cursor: "not-allowed",
    }),
  },

  // Input placeholder
  "& .MuiInputBase-input::placeholder": {
    color: "#87878C",
    fontWeight: 400,
    opacity: 1,
  },

  // Border
  "& .MuiOutlinedInput-notchedOutline": {
    borderRadius: "8px",
    borderColor: "#6B7294",
  },

  // Input focused
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    border: "1px solid #209D7D !important",
    boxShadow:
      "2px 2px 4px 0px rgba(38, 184, 147, 0.10), -1px -1px 6px 0px rgba(38, 184, 147, 0.20)",
  },

  // Input with error
  "&.Mui-error fieldset": {
    borderColor: "#D54309 !important",
  },

  // Arrow Adornment
  "&.MuiAutocomplete-root .MuiAutocomplete-endAdornment": {
    top: "50%",
    transform: "translateY(-50%)",
    right: "9px",
  },
  "& .MuiAutocomplete-popupIndicator": {
    marginRight: "1px",
  },
  "& .MuiAutocomplete-popupIndicatorOpen": {
    transform: "none",
  },
}));

/**
 * A pre-styled Paper component for the Autocomplete dropdown.
 *
 * @note This is applied to the default export automatically, but is exported for further customization.
 */
export const StyledPaper = styled(Paper)({
  borderRadius: "8px",
  border: "1px solid #6B7294",
  marginTop: "2px",
  color: "#083A50",
  "& .MuiAutocomplete-listbox": {
    padding: 0,
    overflow: "auto",
    maxHeight: "300px",
  },
  "& .MuiAutocomplete-option[aria-selected='true']": {
    backgroundColor: "#3E7E6D !important",
    color: "#FFFFFF",
  },
  "& .MuiAutocomplete-option": {
    padding: "7.5px 10px",
    minHeight: "35px",
    background: "#FFFFFF",
  },
  "& .MuiAutocomplete-option:hover": {
    backgroundColor: "#3E7E6D",
    color: "#FFFFFF",
  },
  "& .MuiAutocomplete-option.Mui-focused": {
    backgroundColor: "#3E7E6D !important",
    color: "#FFFFFF",
  },
});

const DropdownArrowsIcon = styled("div")({
  backgroundImage: `url("${dropdownArrowsIcon}")`,
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  width: "10px",
  height: "18px",
});

StyledAutocomplete.defaultProps = {
  /**
   * Consistent icon for the dropdown arrow.
   */
  popupIcon: <DropdownArrowsIcon />,
  /**
   * Force the popup icon to always be visible.
   */
  forcePopupIcon: true,
  /**
   * Disable the MUI portal rendering.
   */
  disablePortal: true,
  /**
   * Disable the clear icon by default.
   */
  disableClearable: true,
  /**
   * Force a custom Paper component to style the dropdown.
   *
   * @note The paper is not nested within the Autocomplete component,
   * so it must be styled separately.
   */
  PaperComponent: StyledPaper,
};

export default StyledAutocomplete;
