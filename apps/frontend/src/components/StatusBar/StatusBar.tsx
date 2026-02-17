import { Stack, Typography, styled } from "@mui/material";
import React, { FC } from "react";

import HistorySection from "./components/HistorySection";
import StatusSection from "./components/StatusSection";

const StyledStack = styled(Stack)({
  padding: "27px",
  paddingBottom: "28px",
  background: "#fff",
  boxShadow: "2px 4px 10px rgba(0, 0, 0, 0.35)",
  borderRadius: "8px",
  transform: "translateY(-54%)",
  marginBottom: "1px",
});

const StyledTitle = styled(Typography)({
  fontWeight: "700",
  fontSize: "19px",
  color: "#282828",
  marginRight: "-6px",
});

/**
 * Form Status Bar Primary Component
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const StatusBar: FC = () => (
  <StyledStack direction="row" justifyContent="space-between">
    <Stack direction="row" spacing={2} alignItems="center">
      <StyledTitle variant="h3">Status:</StyledTitle>
      <StatusSection />
    </Stack>
    <Stack direction="row" spacing={2} alignItems="center">
      <StyledTitle variant="h3">Last updated:</StyledTitle>
      <HistorySection />
    </Stack>
  </StyledStack>
);

export default StatusBar;
