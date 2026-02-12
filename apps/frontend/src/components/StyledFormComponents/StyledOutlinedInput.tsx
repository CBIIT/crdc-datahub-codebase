import { OutlinedInput, styled } from "@mui/material";

const StyledOutlinedInput = styled(OutlinedInput)(() => ({
  width: "100%",
  borderRadius: "8px",
  backgroundColor: "#fff",
  color: "#083A50",
  // Input
  "& .MuiInputBase-input": {
    fontWeight: 400,
    fontSize: "16px",
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    lineHeight: "19.6px",
    padding: "12px",
    height: "20px",
  },
  // Border
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "#6B7294",
  },
  // Border focused
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    border: "1px solid #209D7D",
    boxShadow:
      "2px 2px 4px 0px rgba(38, 184, 147, 0.10), -1px -1px 6px 0px rgba(38, 184, 147, 0.20)",
  },
  // Placeholder
  "& .MuiInputBase-input::placeholder": {
    color: "#87878C",
    fontWeight: 400,
    opacity: 1,
  },
  // Override the input error border color
  "&.Mui-error fieldset": {
    borderColor: "#D54309 !important",
  },
  // Multiline Input
  "&.MuiInputBase-multiline": {
    padding: "12px",
  },
  "&.MuiInputBase-multiline .MuiInputBase-input": {
    lineHeight: "25px",
    padding: 0,
  },
  // Target readOnly <textarea> inputs
  "&.MuiInputBase-multiline.Mui-readOnly": {
    backgroundColor: "#E5EEF4",
    color: "#083A50",
    cursor: "not-allowed",
    borderRadius: "8px",
  },
  // Target readOnly <input> inputs
  "& .MuiOutlinedInput-input:read-only": {
    backgroundColor: "#E5EEF4",
    color: "#083A50",
    cursor: "not-allowed",
    borderRadius: "8px",
  },
}));

export default StyledOutlinedInput;
