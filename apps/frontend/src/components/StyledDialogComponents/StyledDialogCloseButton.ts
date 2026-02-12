import styled from "@emotion/styled";
import { IconButton } from "@mui/material";

const StyledCloseDialogButton = styled(IconButton)(() => ({
  position: "absolute !important" as "absolute",
  right: "21px",
  top: "11px",
  padding: "10px !important",
  "& svg": {
    color: "#44627C",
  },
}));

export default StyledCloseDialogButton;
