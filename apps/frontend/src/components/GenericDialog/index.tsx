import {
  styled,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  DialogProps,
} from "@mui/material";
import React, { ReactNode } from "react";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "451px",
    borderRadius: "8px",
    border: "1px solid #E25C22",
    background: "#EDF0F1",
    boxShadow: "0px 4px 10px 0px rgba(0, 0, 0, 0.15)",
  },
});

const StyledDialogTitle = styled(DialogTitle)({
  color: "#E25C22",
  fontSize: "15px",
  fontFamily: "'Inter', 'Rubik', sans-serif",
  fontStyle: "normal",
  fontWeight: "700",
  lineHeight: "normal",
  padding: "18px 15px 10px",
});

const StyledDialogContent = styled(DialogContent)({
  padding: "0 15px 18px",
});

const StyledDialogContentText = styled(DialogContentText)({
  color: "#000000",
  fontSize: "15px",
  fontFamily: "'Inter', 'Rubik', sans-serif",
  fontStyle: "normal",
  fontWeight: "400",
  lineHeight: "normal",
});

const StyledDialogActions = styled(DialogActions)({
  fontSize: "15px",
  fontFamily: "'Inter', 'Rubik', sans-serif",
  fontStyle: "normal",
  fontWeight: "400",
  lineHeight: "normal",
  padding: "0 15px 10px",
});

type CustomDialogProps = {
  title?: string;
  message?: string | ReactNode;
  actions?: ReactNode;
} & DialogProps;

const CustomDialog: React.FC<CustomDialogProps> = ({
  open,
  onClose,
  title,
  message,
  actions,
  children,
  ...rest
}) => (
  <StyledDialog open={open} onClose={onClose} {...rest}>
    {title && <StyledDialogTitle>{title}</StyledDialogTitle>}
    {message && (
      <StyledDialogContent>
        <StyledDialogContentText>{message}</StyledDialogContentText>
      </StyledDialogContent>
    )}
    {children && <StyledDialogContent>{children}</StyledDialogContent>}
    {actions && <StyledDialogActions>{actions}</StyledDialogActions>}
  </StyledDialog>
);

export default CustomDialog;
