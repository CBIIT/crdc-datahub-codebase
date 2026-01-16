import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { Button, Typography, styled } from "@mui/material";
import React from "react";

const StyledFloatingButton = styled(Button)({
  position: "fixed",
  right: 0,
  top: "65%",
  transform: "translateY(-50%)",
  zIndex: 10000,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  paddingInline: "20px",
  paddingBlock: "16px",
  borderRadius: "16px 0 0 16px",
  backgroundImage: "linear-gradient(to bottom, #005EA2, #1A8199)",
  color: "#ffffff",
  boxShadow: "0 8px 16px rgba(0, 0, 0, 0.25)",
  borderLeft: "4px solid #0f4555",
  textTransform: "none",
  transition: "transform 0.3s ease-out, box-shadow 0.3s ease-out",
  "&:hover": {
    boxShadow: "0 12px 24px rgba(0, 0, 0, 0.35)",
    transform: "translateY(-50%) scale(1.05)",
    backgroundImage: "linear-gradient(to bottom, #005EA2, #1A8199)",
  },
  "&:active": {
    transform: "translateY(-50%) scale(0.95)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
  },
});

const StyledChatIcon = styled(ChatBubbleOutlineIcon)({
  width: "24px",
  height: "24px",
});

const StyledLabel = styled(Typography)({
  fontWeight: 700,
  letterSpacing: "1px",
});

type Props = {
  label: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
};

const FloatingChatButton = ({ label, onClick }: Props): JSX.Element => (
  <StyledFloatingButton onClick={onClick} aria-label="Chat button">
    <StyledChatIcon />
    <StyledLabel variant="body2">{label}</StyledLabel>
  </StyledFloatingButton>
);

export default React.memo<Props>(FloatingChatButton);
