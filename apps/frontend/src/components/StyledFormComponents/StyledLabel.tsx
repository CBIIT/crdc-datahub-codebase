import { FormLabel, styled } from "@mui/material";

const StyledLabel = styled(FormLabel)(() => ({
  fontWeight: 700,
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  lineHeight: "19.6px",
  minHeight: "20px",
  color: "#083A50",
  marginBottom: "4px",
  "&.Mui-focused": {
    color: "#083A50",
  },
}));

export default StyledLabel;
