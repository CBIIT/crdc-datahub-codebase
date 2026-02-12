import { Select, SelectProps, styled } from "@mui/material";

import dropdownArrowsIcon from "../../assets/icons/dropdown_arrows.svg?url";

const StyledSelect = styled(Select, {
  shouldForwardProp: (prop) => prop !== "placeholderText",
})<SelectProps & { placeholderText?: string }>((props) => ({
  width: "100%",
  // Placeholder
  "& .MuiSelect-select .notranslate::after": {
    content: `'${props?.placeholderText ?? "Select"}'`,
    color: "#87878C",
    fontWeight: 400,
    opacity: 1,
  },
  "& .Mui-disabled.MuiSelect-icon": {
    opacity: props.theme.palette.action.disabledOpacity,
  },
  // Dropdown
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
  // Input
  "& .MuiInputBase-input": {
    backgroundColor: "#fff",
    borderRadius: "8px",
    color: "#083A50 !important",
    fontWeight: 400,
    fontSize: "16px",
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    lineHeight: "19.6px",
    padding: "12px",
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

  // Border
  "& .MuiOutlinedInput-notchedOutline": {
    borderRadius: "8px",
    borderColor: "#6B7294",
    padding: "0 12px",
  },
  // Border focused
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    border: "1px solid #209D7D !important",
    boxShadow:
      "2px 2px 4px 0px rgba(38, 184, 147, 0.10), -1px -1px 6px 0px rgba(38, 184, 147, 0.20)",
  },
  "&.Mui-focused .MuiOutlinedInput-input:focus": {
    borderRadius: "8px",
  },
  // Border error
  "&.Mui-error fieldset": {
    borderColor: "#D54309 !important",
  },
  // Icon
  "& .MuiSelect-icon": {
    right: "12px",
  },
  "& .MuiSelect-iconOpen": {
    transform: "none",
  },
}));

const DropdownArrowsIcon = styled("div")(() => ({
  backgroundImage: `url("${dropdownArrowsIcon}")`,
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  width: "10px",
  height: "18px",
}));

StyledSelect.defaultProps = {
  IconComponent: DropdownArrowsIcon,
};

export default StyledSelect;
