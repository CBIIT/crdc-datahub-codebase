import { Button, Dialog, DialogProps, IconButton, Stack, styled } from "@mui/material";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";

import DataViewDetails from "./DataViewDetails";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    width: "1144px !important",
    padding: "38px 59px 41px",
    borderRadius: "8px",
    border: "2px solid #13B9DD",
    background: "linear-gradient(0deg, #F2F6FA 0%, #F2F6FA 100%), #2E4D7B",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
  },
});

const StyledCloseDialogButton = styled(IconButton)(() => ({
  position: "absolute",
  right: "21px",
  top: "11px",
  padding: "10px",
  "& svg": {
    color: "#44627C",
  },
}));

const StyledCloseButton = styled(Button)({
  background: "#FFFFFF",
  "&.MuiButton-root": {
    minWidth: "137px",
    width: "fit-content",
    padding: "10px",
    color: "#000000",
    textAlign: "center",
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 500,
    lineHeight: "24px",
    letterSpacing: "0.32px",
    textTransform: "none",
    alignSelf: "center",
    border: "1px solid #000000",
  },
});

type Props = {
  submissionID: string;
  nodeType: string;
  nodeID: string;
  closeText?: string;
  onClose: () => void;
} & Omit<DialogProps, "onClose">;

const DataViewDetailsDialog = ({
  submissionID,
  nodeType,
  nodeID,
  open,
  closeText = "Close",
  onClose,
  ...rest
}: Props) => (
  <StyledDialog open={open} onClose={onClose} title="" scroll="body" {...rest}>
    <StyledCloseDialogButton
      onClick={onClose}
      aria-label="close"
      data-testid="data-view-dialog-close-icon-button"
    >
      <CloseIconSvg />
    </StyledCloseDialogButton>

    <DataViewDetails submissionID={submissionID} nodeType={nodeType} nodeID={nodeID} />

    <Stack direction="row" justifyContent="center" alignItems="center" spacing={2} marginTop="58px">
      <StyledCloseButton
        id="data-view-dialog-close-button"
        variant="contained"
        color="info"
        onClick={onClose}
        aria-label="Cancel button"
        data-testid="data-view-dialog-cancel-button"
      >
        {closeText}
      </StyledCloseButton>
    </Stack>
  </StyledDialog>
);

export default DataViewDetailsDialog;
