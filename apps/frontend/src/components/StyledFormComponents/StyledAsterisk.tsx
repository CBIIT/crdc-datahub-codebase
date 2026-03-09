import { styled } from "@mui/material";
import { forwardRef } from "react";

const StyledAsterisk = styled("span")(() => ({
  color: "#C93F08",
  marginLeft: "2px",
  fontWeight: 700,
  fontSize: "16px",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  lineHeight: "18.8px",
}));

const Asterisk = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  (props, ref) => (
    <StyledAsterisk ref={ref} {...props}>
      *
    </StyledAsterisk>
  )
);

export default Asterisk;
