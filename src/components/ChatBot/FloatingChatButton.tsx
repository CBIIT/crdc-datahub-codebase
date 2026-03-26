import { Typography, styled } from "@mui/material";
import React, { useEffect, useState } from "react";

import ChatBotLogo from "./components/ChatBotLogo";
import chatConfig from "./config/chatConfig";

const StyledFloatingButtonWrapper = styled("div")({
  position: "fixed !important" as never,
  right: "0 !important",
  top: "65% !important",
  transform: "translateY(-50%) !important",
  zIndex: "1250 !important",
  display: "flex !important",
  flexDirection: "row !important" as never,
  alignItems: "stretch !important",
});

const StyledLabel = styled(Typography)({
  fontFamily: "'Inter', 'Rubik', sans-serif !important",
  fontStyle: "normal",
  fontWeight: "600 !important",
  fontSize: "15px !important",
  lineHeight: "16px !important",
  display: "flex !important",
  alignItems: "center !important",
  color: "#F9F9F9 !important",
  paddingRight: "10px !important",
  textAlign: "left !important" as never,
  whiteSpace: "pre-line !important" as never,
  textTransform: "none !important" as never,
});

type Props = {
  label: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  forceExpanded?: boolean;
};

const FloatingChatButton = ({ label, onClick, forceExpanded = false }: Props): JSX.Element => {
  const [expanded, setExpanded] = useState(forceExpanded);

  const { initialDelayMs, showDurationMs, sessionKey } = chatConfig.floatingButton;

  useEffect(() => {
    if (forceExpanded) {
      return undefined;
    }

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
