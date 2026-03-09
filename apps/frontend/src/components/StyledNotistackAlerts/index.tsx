import { styled } from "@mui/material";
import { MaterialDesignContent } from "notistack";
import { CSSProperties } from "react";

const BaseSnackbarStyles: CSSProperties = {
  color: "#ffffff",
  width: "535px",
  minHeight: "50px",
  boxShadow: "-4px 8px 27px 4px rgba(27,28,28,0.09)",
  boxSizing: "border-box",
  wordBreak: "break-word",
  userSelect: "none",
  justifyContent: "center",
};

const StyledNotistackAlerts = styled(MaterialDesignContent)({
  "&.notistack-MuiContent-default": {
    ...BaseSnackbarStyles,
    backgroundColor: "#5D53F6",
  },
  "&.notistack-MuiContent-error": {
    ...BaseSnackbarStyles,
    backgroundColor: "#E74040",
  },
  "&.notistack-MuiContent-success": {
    ...BaseSnackbarStyles,
    backgroundColor: "#5D53F6",
  },
});

export default StyledNotistackAlerts;
