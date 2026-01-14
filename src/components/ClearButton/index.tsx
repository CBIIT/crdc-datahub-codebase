import { IconButton, IconButtonProps, styled } from "@mui/material";
import { FC } from "react";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";

const StyledClearButton = styled(IconButton)({
  padding: "4px",
  marginRight: "14px",
  position: "relative",
  zIndex: 10000,
  backgroundColor: "#E7F2EF",
  border: "1px solid #D6D6D6",
  "&:hover": {
    backgroundColor: "#D6E8E4",
  },
  "& .MuiSvgIcon-root": {
    color: "#44627C",
  },
});

type Props = IconButtonProps;

/**
 * A reusable clear button with an X icon that prevents event propagation and appears above overlays.
 */
const ClearButton: FC<Props> = ({ onClick, ...props }) => (
  <StyledClearButton
    size="small"
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick?.(e);
    }}
    {...props}
  >
    <CloseIconSvg />
  </StyledClearButton>
);

export default ClearButton;
