import { Box, Button, DialogProps, List, Stack, Typography, styled } from "@mui/material";
import React from "react";

import CloseIconSvg from "@/assets/icons/close_icon.svg?react";
import BaseDialog from "@/components/StyledDialogComponents/StyledDialog";
import StyledCloseDialogButton from "@/components/StyledDialogComponents/StyledDialogCloseButton";

const StyledDialog = styled(BaseDialog)({
  "& .MuiDialog-paper": {
    padding: "38px 42px 68px",
    border: "2px solid #E25C22",
  },
});

const StyledCloseButton = styled(Button)({
  minWidth: "137px",
  padding: "10px",
  fontSize: "16px",
  letterSpacing: "0.32px",
  margin: "0 auto",
  marginTop: "45px",
});

const StyledPreHeader = styled(Typography)({
  color: "#929292",
  fontSize: "13px",
  fontStyle: "normal",
  fontWeight: "400",
  lineHeight: "27px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  marginBottom: "2px",
});

const StyledHeader = styled(Typography)({
  color: "#E25C22",
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontSize: "35px",
  fontStyle: "normal",
  fontWeight: "900",
  lineHeight: "30px",
  paddingBottom: "8px",
  wordBreak: "break-word",
});

const StyledPostHeader = styled(Typography)({
  color: "#595959",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "19.6px",
});

const StyledList = styled(List)({
  overflowY: "auto",
});

const StyledIssueContainer = styled(Box)({
  "&:not(:first-of-type)": {
    paddingTop: "10px",
  },
  "&:not(:last-of-type)": {
    paddingBottom: "10px",
    borderBottom: "1px solid #A7B0C6",
  },
});

const StyledIssue = styled(Stack)({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: "10px",
});

const StyledIssueCount = styled(Typography)({
  color: "#585858",
  fontSize: "13px",
  textTransform: "uppercase",
  marginTop: "45px",
});

const StyledIssueNumber = styled(Typography)({
  width: "10px",
  fontWeight: 700,
  fontSize: "14px",
});

const StyledIssueSeverity = styled(Typography)(
  ({ severity }: Pick<ErrorDetailsIssue, "severity">) => ({
    color: severity === "error" ? "#FFF" : "#000",
    backgroundColor: severity === "error" ? "#D65219" : "#FFC700",
    fontWeight: 700,
    fontSize: "13px",
    textTransform: "uppercase",
    textAlign: "center",
    width: "78px",
    lineHeight: "23px",
  })
);

const StyledIssueMessage = styled(Typography)({
  maxWidth: "529px",
  fontSize: "16px",
  wordBreak: "break-word",
});

const StyledIssueAction = styled(Box)({
  marginLeft: "20px",
});

export type ErrorDetailsIssue = {
  /**
   * The severity of the issue. Can be either "error" or "warning".
   */
  severity: "error" | "warning";
  /**
   * The message describing the issue.
   */
  message: string;
  /**
   * (Optional) An additional action (text/component) that can be displayed below the issue.
   *
   * @note Currently only one action is allowed.
   */
  action?: React.ReactNode;
};

export type ErrorDetailsDialogV2Props = {
  /**
   * (Optional) Pre-header text displayed above the title.
   */
  preHeader?: string;
  /**
   * The main header/title of the dialog.
   */
  header: string;
  /**
   * (Optional) Additional information displayed below the title, such as node information.
   */
  postHeader?: string;
  /**
   * The list of issues to display in the dialog.
   */
  issues: ErrorDetailsIssue[];
  /**
   * Callback function to be called when the dialog is closed.
   *
   * @returns void
   */
  onClose: () => void;
} & Omit<DialogProps, "onClose" | "title">;

/**
 * A component that handles the display of issue details in a consistent format.
 *
 * @returns The ErrorDetailsDialogV2 component displays a dialog with detailed issue information.
 */
const ErrorDetailsDialogV2 = ({
  open,
  preHeader,
  header,
  postHeader,
  issues,
  onClose,
  ...rest
}: ErrorDetailsDialogV2Props) => (
  <StyledDialog
    open={open}
    onClose={onClose}
    data-testid="error-details-dialog"
    aria-labelledby="error-details-title"
    {...rest}
  >
    <StyledCloseDialogButton
      aria-label="close"
      onClick={onClose}
      data-testid="error-details-close-icon"
    >
      <CloseIconSvg />
    </StyledCloseDialogButton>
    <StyledPreHeader variant="h6" data-testid="error-details-pre-header">
      {preHeader}
    </StyledPreHeader>
    <StyledHeader variant="h1" data-testid="error-details-title">
      {header}
    </StyledHeader>
    <StyledPostHeader variant="caption" data-testid="error-details-node-info">
      {postHeader}
    </StyledPostHeader>
    <StyledIssueCount variant="body2" data-testid="error-details-error-count">
      {issues?.length || 0} {issues?.length === 1 ? "ISSUE" : "ISSUES"}:
    </StyledIssueCount>
    <StyledList>
      {issues.map((issue, idx) => (
        <StyledIssueContainer
          key={`${issue.severity}_${issue.message}`}
          data-testid={`error-details-issue-${idx}`}
        >
          <StyledIssue>
            <StyledIssueNumber data-testid="issue-count">{idx + 1}</StyledIssueNumber>
            <StyledIssueSeverity severity={issue.severity} data-testid="issue-severity">
              {issue.severity}
            </StyledIssueSeverity>
            <StyledIssueMessage data-testid="issue-message">{issue.message}</StyledIssueMessage>
          </StyledIssue>
          {issue.action && (
            <StyledIssueAction data-testid="issue-action">{issue.action}</StyledIssueAction>
          )}
        </StyledIssueContainer>
      ))}
    </StyledList>
    <StyledCloseButton
      data-testid="error-details-close-button"
      variant="contained"
      color="info"
      onClick={onClose}
    >
      Close
    </StyledCloseButton>
  </StyledDialog>
);

export default React.memo<ErrorDetailsDialogV2Props>(ErrorDetailsDialogV2);
