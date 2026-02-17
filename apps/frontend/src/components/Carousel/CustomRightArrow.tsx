import { styled } from "@mui/material";

import ChevronRight from "../../assets/icons/chevron_right.svg?react";

const StyledButton = styled("button")({
  color: "#3D4551",
  background: "transparent !important",
  transform: "translateX(15px)",
  "&.react-multiple-carousel__arrow--right::before": {
    content: "none",
  },
});

const CustomRightArrow = (props) => (
  <StyledButton
    onClick={props?.onClick}
    aria-label="Paginate Right"
    type="button"
    className="react-multiple-carousel__arrow react-multiple-carousel__arrow--right"
  >
    <ChevronRight />
  </StyledButton>
);

export default CustomRightArrow;
