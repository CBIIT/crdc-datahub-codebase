import { Typography, styled } from "@mui/material";
import { FC } from "react";
import { Link } from "react-router-dom";

import { DataSubmissionInstructionsLink } from "../../config/HeaderConfig";

const StyledText = styled(Typography)({
  fontFamily: "Nunito",
  fontWeight: 400,
  fontSize: "16px",
  marginBottom: "16px",
  "& a": {
    fontWeight: 700,
    color: "#005999",
  },
});

/**
 * Provides contextual information about the Data Submission flow.
 *
 * @returns {React.FC}
 */
export const UserGuide: FC = () => (
  <StyledText variant="body1">
    Prior to beginning uploading process, read detailed instructions available in the{" "}
    <Link to={DataSubmissionInstructionsLink} target="_blank">
      Data Submission Instructions
    </Link>
    .
  </StyledText>
);
