import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button, ButtonProps, styled } from "@mui/material";
import React, { FC } from "react";
import { useNavigate } from "react-router-dom";

const StyledBackButton = styled(Button)(() => ({
  color: "#2E5481",
  fontWeight: 700,
  fontSize: "14px",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  lineHeight: "19.6px",
  "&:hover": {
    background: "transparent",
  },
  "& svg": {
    marginRight: "4px",
  },
}));

type Props = {
  text?: string;
  navigateTo?: string;
} & ButtonProps;

const BackButton: FC<Props> = ({ text = "Back", navigateTo }) => {
  const navigate = useNavigate();

  const navigateToPath = () => {
    if (!navigateTo) {
      return;
    }

    navigate(navigateTo);
    window.scrollTo(0, 0);
  };

  return (
    <StyledBackButton
      variant="text"
      onClick={navigateToPath}
      startIcon={<ArrowBackIcon fontSize="small" />}
      disableElevation
      disableRipple
      disableFocusRipple
      disableTouchRipple
    >
      {text}
    </StyledBackButton>
  );
};

export default React.memo(BackButton);
