import { Box, Button, Stack, Typography, styled } from "@mui/material";
import { FC } from "react";
import { useNavigate } from "react-router-dom";

import status404 from "../../assets/icons/404.png";
import usePageTitle from "../../hooks/usePageTitle";

const StyledContainer = styled(Stack)({
  background: "#114454CC",
  padding: "69px 0",
  alignItems: "center",
  justifyContent: "center",
  // NOTE: 209px is the header height. This is only visible on larger screens.
  minHeight: "calc(100vh - 209px)",
});

const StyledContent = styled(Box)({
  textAlign: "center",
});

const StyledImage = styled("img")({
  width: "380.39px",
  height: "auto",
});

const StyledHeader = styled(Typography)({
  color: "#FFFFFF",
  fontFamily: "Nunito",
  fontSize: "26px",
  fontWeight: 700,
  lineHeight: "35px",
});

const StyledBody = styled(Typography)({
  marginTop: "14px",
  marginBottom: "24px",
  fontFamily: "Inter",
  fontWeight: 400,
  fontSize: "16px",
  lineHeight: "22px",
  color: "#86E2F6",
});

const StyledButton = styled(Button)({
  margin: "0 auto",
  padding: "10px 20px",
  color: "#004A80 !important",
  background: "#FFFFFF !important",
  width: "176px",
  fontSize: "16px",
  fontWeight: 700,
});

const Page404: FC = () => {
  usePageTitle("Page Not Found");

  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/");
  };

  return (
    <StyledContainer>
      <StyledContent>
        <StyledImage src={status404} alt="404 icon" />
        <StyledHeader variant="h1">Page not found.</StyledHeader>
        <StyledBody variant="body1">Looks like you got a little turned around.</StyledBody>
        <StyledButton variant="contained" color="primary" onClick={handleClick}>
          Return Home
        </StyledButton>
      </StyledContent>
    </StyledContainer>
  );
};

export default Page404;
