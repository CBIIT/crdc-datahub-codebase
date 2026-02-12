import { Button, Dialog, DialogProps, IconButton, Stack, Typography, styled } from "@mui/material";
import React from "react";

import CloseIconSvg from "../../../assets/icons/close_icon.svg?react";
import { FormatDate } from "../../../utils";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    width: "731px !important",
    padding: "38px 42px 68px",
    borderRadius: "8px",
    border: "2px solid #E25C22",
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
  minWidth: "137px",
  padding: "10px",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  lineHeight: "24px",
  letterSpacing: "0.32px",
  textTransform: "none",
  alignSelf: "center",
  margin: "0 auto",
  marginTop: "45px",
});

const StyledHeader = styled(Typography)({
  color: "#929292",
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontSize: "13px",
  fontStyle: "normal",
  fontWeight: "400",
  lineHeight: "27px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  marginBottom: "2px",
});

const StyledTitle = styled(Typography)({
  color: "#E25C22",
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontSize: "35px",
  fontStyle: "normal",
  fontWeight: "900",
  lineHeight: "30px",
  paddingBottom: "8px",
  wordBreak: "break-word",
});

const StyledUploadedDate = styled(Typography)({
  color: "#595959",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "19.6px",
});

const StyledSubtitle = styled(Typography)({
  color: "#453D3D",
  fontFamily: "'Public Sans', sans-serif",
  fontSize: "14px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "20px",
  letterSpacing: "0.14px",
  textTransform: "uppercase",
  marginTop: "35px",
});

const StyledErrorItem = styled(Typography)({
  color: "#131313",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "22px",
  wordBreak: "break-word",
});

const StyledErrors = styled(Stack)({
  overflowY: "auto",
});

const StyledErrorDetails = styled(Stack)({
  padding: "10px",
  maxHeight: "290px",
});

type Props = {
  header?: string;
  title?: string;
  closeText?: string;
  errors: string[];
  errorCount?: string;
  nodeInfo?: string;
  uploadedDate?: string;
  onClose?: () => void;
} & Omit<DialogProps, "onClose">;

const ErrorDetailsDialog = ({
  header,
  title,
  closeText = "Close",
  errors,
  errorCount,
  nodeInfo,
  uploadedDate,
  onClose,
  open,
  ...rest
}: Props) => {
  const handleCloseDialog = () => {
    if (typeof onClose === "function") {
      onClose();
    }
  };

  return (
    <StyledDialog
      open={open}
      onClose={handleCloseDialog}
      data-testid="error-details-dialog"
      aria-labelledby="error-details-title"
      scroll="body"
      {...rest}
    >
      <StyledCloseDialogButton
        aria-label="close"
        onClick={handleCloseDialog}
        data-testid="error-details-close-icon"
      >
        <CloseIconSvg />
      </StyledCloseDialogButton>
      {header && (
        <StyledHeader variant="h3" data-testid="error-details-header">
          {header}
        </StyledHeader>
      )}
      <StyledTitle variant="h6" id="error-details-title" data-testid="error-details-title">
        {title}
      </StyledTitle>
      {uploadedDate && (
        <StyledUploadedDate data-testid="error-details-upload-date">
          Uploaded on {FormatDate(uploadedDate, "M/D/YYYY", "N/A")}
        </StyledUploadedDate>
      )}
      {nodeInfo && (
        <StyledUploadedDate data-testid="error-details-node-info">{nodeInfo}</StyledUploadedDate>
      )}
      <StyledErrorDetails direction="column" spacing={2.5}>
        <StyledSubtitle variant="body2" data-testid="error-details-error-count">
          {errorCount || `${errors?.length || 0} ${errors?.length === 1 ? "ERROR" : "ERRORS"}`}
        </StyledSubtitle>
        <StyledErrors
          direction="column"
          spacing={2.75}
          padding={1.25}
          data-testid="error-details-error-list"
        >
          {errors?.map((error: string, idx: number) => (
            // eslint-disable-next-line react/no-array-index-key
            <StyledErrorItem key={`${idx}_${error}`}>{`${idx + 1}. ${error}`}</StyledErrorItem>
          ))}
        </StyledErrors>
      </StyledErrorDetails>
      <StyledCloseButton
        id="error-dialog-close-button"
        data-testid="error-details-close-button"
        variant="contained"
        color="info"
        onClick={handleCloseDialog}
      >
        {closeText}
      </StyledCloseButton>
    </StyledDialog>
  );
};

export default React.memo(ErrorDetailsDialog);
