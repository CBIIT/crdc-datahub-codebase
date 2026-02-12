import { Box, Stack, Typography, styled } from "@mui/material";
import { FC, memo } from "react";

import MaintenanceIcon from "../../assets/icons/maintenance.svg?react";
import usePageTitle from "../../hooks/usePageTitle";

const StyledContainer = styled(Stack)({
  background: "#2F4F70",
  minHeight: "100vh",
  paddingTop: "89px",
  paddingBottom: "140px",
});

const StyledContent = styled(Box)({
  textAlign: "center",
  margin: "0 auto",
  maxWidth: "795px",
});

const StyledPageTitle = styled(Typography)({
  color: "#31F7C3",
  fontWeight: 800,
  fontFamily: "Nunito Sans",
  fontSize: "45px",
});

const StyledBodyText = styled(Typography)({
  color: "#D2E9EE",
  marginTop: "10px",
  fontSize: "18px",
  fontFamily: "Inter",
  lineHeight: "26px",
});

/**
 * Provides a maintenance page for the application.
 *
 * If passed `state.data.shouldBlock` is true, it will block any navigation away.
 *
 * @returns The maintenance page component.
 */
const MaintenancePage: FC = () => {
  usePageTitle("Website Maintenance");

  return (
    <StyledContainer>
      <StyledContent>
        <MaintenanceIcon />
        <StyledPageTitle>Website Maintenance</StyledPageTitle>
        <StyledBodyText>
          The CRDC Submission Portal site is currently undergoing scheduled maintenance. Please
          check back soon. We appreciate your patience.
        </StyledBodyText>
      </StyledContent>
    </StyledContainer>
  );
};

export default memo<FC>(MaintenancePage);
