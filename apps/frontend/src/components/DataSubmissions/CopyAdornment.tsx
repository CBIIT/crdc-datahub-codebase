import { Stack, styled, Typography } from "@mui/material";
import { isEqual } from "lodash";
import { FC, memo } from "react";

import CopyTextButton from "../CopyTextButton";

const StyledCopyWrapper = styled(Stack)({
  height: "42px",
  width: "fit-content",
  minWidth: "508px",
  padding: "11px 20px",
  borderRadius: "8px 8px 0px 0px",
  border: "1.25px solid #6DADDB",
  borderBottom: 0,
  background: "#fff",
  color: "#125868",
});

const StyledCopyLabel = styled(Typography)({
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "12px",
  fontStyle: "normal",
  fontWeight: 800,
  lineHeight: "19.6px",
  letterSpacing: "0.24px",
  textTransform: "uppercase",
  userSelect: "none",
});

const StyledCopyValue = styled(Typography)({
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "19.6px",
  letterSpacing: "0.32px",
  userSelect: "all",
});

type Props = {
  /**
   * The Data Submission ID
   *
   * @note This is passed as a prop instead of using the SubmissionContext to prevent a delay in displaying the ID
   */
  _id: string;
};

/**
 * Provides Data Submission ID display and copy functionality
 *
 * @returns {React.FC}
 */
const CopyAdornment: FC<Props> = ({ _id }) => (
  <StyledCopyWrapper direction="row" gap="13px" alignItems="center">
    <StyledCopyLabel data-testid="data-submission-id-label" variant="body1">
      SUBMISSION ID:
    </StyledCopyLabel>
    <StyledCopyValue data-testid="data-submission-id-value" variant="body1">
      {_id}
    </StyledCopyValue>
    <CopyTextButton
      data-testid="data-submission-copy-id-button"
      aria-label="Copy ID"
      disabled={!_id}
      copyText={_id}
    />
  </StyledCopyWrapper>
);

export default memo(CopyAdornment, isEqual);
