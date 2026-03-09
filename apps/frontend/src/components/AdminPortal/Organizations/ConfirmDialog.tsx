import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogProps,
  IconButton,
  Typography,
  styled,
} from "@mui/material";
import { FC } from "react";

import CloseIconSvg from "../../../assets/icons/close_icon.svg?react";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    borderRadius: "8px",
    width: "755px !important",
    padding: "47px 59px 71px 54px",
    border: "2px solid #0B7F99",
    background: "linear-gradient(0deg, #F2F6FA 0%, #F2F6FA 100%), #2E4D7B",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
  },
});

const StyledDialogContent = styled(DialogContent)({
  padding: 0,
});

const StyledBodyText = styled(Typography)({
  fontFamily: "'Nunito', 'Rubik', sans-serif !important",
  fontSize: "16px !important",
  fontStyle: "normal",
  fontWeight: "400 !important",
  lineHeight: "19.6px !important",
  marginBottom: "28px !important",
  letterSpacing: "unset !important",
});

const StyledDialogActions = styled(DialogActions)({
  padding: "0 !important",
  justifyContent: "center",
});

const StyledCloseDialogButton = styled(IconButton)(() => ({
  position: "absolute !important" as "absolute",
  right: "21px",
  top: "11px",
  padding: "10px",
  "& svg": {
    color: "#44627C",
  },
}));

const StyledActionButton = styled(Button)({
  minWidth: "128px",
  height: "42px",
  padding: "12px !important",
  borderRadius: "8px !important",
  border: "1px solid #000 !important",
  color: "#000 !important",
  textAlign: "center",
  fontFamily: "'Nunito', 'Rubik', sans-serif !important",
  fontSize: "16px !important",
  fontStyle: "normal",
  fontWeight: "700 !important",
  lineHeight: "24px !important",
  letterSpacing: "0.32px",
  textTransform: "none !important" as "none",
  alignSelf: "center",
  margin: "0 15px !important",
  marginTop: "45px !important",
  "&:hover": {
    background: "transparent !important",
  },
});

type Props = {
  onClose?: () => void;
  onSubmit?: () => void;
} & Omit<DialogProps, "onClose">;

const ConfirmDialog: FC<Props> = ({ title, onClose, onSubmit, open, ...rest }) => (
  <StyledDialog open={open} onClose={() => onClose?.()} {...rest}>
    <StyledCloseDialogButton aria-label="close" onClick={() => onClose?.()}>
      <CloseIconSvg />
    </StyledCloseDialogButton>
    <StyledDialogContent>
      <StyledBodyText id="confirm-dialog-body" variant="h6">
        Currently, there are active data submissions for this study within this program. Are you
        sure you want to remove this study from the program?
      </StyledBodyText>
    </StyledDialogContent>
    <StyledDialogActions>
      <StyledActionButton
        id="uploader-cli-submit-button"
        variant="outlined"
        sx={{ width: "186px" }}
        onClick={onSubmit}
      >
        Confirm to Remove
      </StyledActionButton>
      <StyledActionButton id="uploader-cli-cancel-button" variant="outlined" onClick={onClose}>
        Cancel
      </StyledActionButton>
    </StyledDialogActions>
  </StyledDialog>
);

export default ConfirmDialog;
