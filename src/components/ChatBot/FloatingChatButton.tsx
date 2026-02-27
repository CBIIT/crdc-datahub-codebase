import { Typography, styled } from "@mui/material";
import React, { useEffect, useState } from "react";

import ChatBotLogo from "./components/ChatBotLogo";

const StyledFloatingButtonWrapper = styled("div")({
  position: "fixed",
  right: 0,
  top: "65%",
  transform: "translateY(-50%)",
  zIndex: 10000,
});

const StyledSpeechBubble = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "visible",
})<{ visible: boolean }>(({ visible }) => ({
  position: "fixed",
  right: "29px",
  top: "calc(65% - 30px + 21px)",
  minWidth: "187px",
  zIndex: 9999,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  padding: "17.5px 42px 17.5px 20px",
  gap: "10px",
  background: "#FFFFFF",
  boxShadow: "0px 4px 4px rgba(0, 0, 0, 0.25)",
  borderRadius: "18px",
  fontFamily: "Inter",
  fontStyle: "normal",
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "18px",
  letterSpacing: 0,
  color: "#0A3E7F",
  opacity: visible ? 1 : 0,
  transition: "opacity 0.5s ease-in-out",
  pointerEvents: visible ? "auto" : "none",
}));

type Props = {
  label: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
};

const INITIAL_DELAY_MS = 3_000;
const SHOW_DURATION_MS = 7_000;
const SESSION_KEY = "chatbot_bubble_shown";

const FloatingChatButton = ({ label, onClick }: Props): JSX.Element => {
  const [bubbleVisible, setBubbleVisible] = useState(false);

  useEffect(() => {
    const hasShown = sessionStorage.getItem(SESSION_KEY);
    if (hasShown) {
      return undefined;
    }

    const showTimeout = setTimeout(() => {
      setBubbleVisible(true);
      sessionStorage.setItem(SESSION_KEY, "true");
    }, INITIAL_DELAY_MS);

    const hideTimeout = setTimeout(() => {
      setBubbleVisible(false);
    }, INITIAL_DELAY_MS + SHOW_DURATION_MS);

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, []);

  return (
    <>
      <StyledFloatingButtonWrapper>
        <ChatBotLogo
          variant="floating"
          animated={bubbleVisible}
          onClick={onClick}
          ariaLabel={label}
        />
      </StyledFloatingButtonWrapper>
      <StyledSpeechBubble visible={bubbleVisible}>{label}</StyledSpeechBubble>
    </>
  );
};

export default React.memo<Props>(FloatingChatButton);
