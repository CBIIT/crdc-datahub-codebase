import { Typography, styled } from "@mui/material";
import React, { useEffect, useState } from "react";

import ChatBotLogo from "./components/ChatBotLogo";
import chatConfig from "./config/chatConfig";

const StyledFloatingButtonWrapper = styled("div")({
  position: "fixed",
  right: 0,
  top: "65%",
  transform: "translateY(-50%)",
  zIndex: 10000,
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
});

const StyledLabel = styled(Typography)({
  fontFamily: "'Inter'",
  fontStyle: "normal",
  fontWeight: 600,
  fontSize: "15px",
  lineHeight: "16px",
  display: "flex",
  alignItems: "center",
  color: "#F9F9F9",
  paddingRight: "10px",
  textAlign: "left",
  whiteSpace: "pre-line",
});

type Props = {
  label: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
};

const FloatingChatButton = ({ label, onClick }: Props): JSX.Element => {
  const [expanded, setExpanded] = useState(false);

  const { initialDelayMs, showDurationMs, sessionKey } = chatConfig.floatingButton;

  useEffect(() => {
    const hasShown = sessionStorage.getItem(sessionKey);
    if (hasShown) {
      return undefined;
    }

    const showTimeout = setTimeout(() => {
      setExpanded(true);
      sessionStorage.setItem(sessionKey, "true");
    }, initialDelayMs);

    const hideTimeout = setTimeout(() => {
      setExpanded(false);
    }, initialDelayMs + showDurationMs);

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, []);

  return (
    <StyledFloatingButtonWrapper>
      <ChatBotLogo variant="floating" expanded={expanded} onClick={onClick} ariaLabel={label}>
        <StyledLabel>{label}</StyledLabel>
      </ChatBotLogo>
    </StyledFloatingButtonWrapper>
  );
};

export default React.memo<Props>(FloatingChatButton);
