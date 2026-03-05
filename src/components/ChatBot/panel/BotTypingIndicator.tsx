import { CircularProgress, Stack, styled } from "@mui/material";
import React from "react";

import ChatBotLogo from "../components/ChatBotLogo";

const StyledContainer = styled(Stack)({
  alignItems: "center",
  marginBottom: "12px",
});

const StyledLogoWrapper = styled("div")({
  marginRight: "2px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "& > button": {
    transform: "scale(0.6667)",
    transformOrigin: "center",
  },
});

const StyledProgress = styled(CircularProgress)({
  color: "#005EA2",
});

export type Props = {
  /**
   * The name of the bot sender to display. Defaults to the configured support bot name.
   */
  senderName?: string;
};

/**
 * Displays an animated typing indicator with the ChatBot logo and a loading spinner.
 */
const BotTypingIndicator = (): JSX.Element => (
  <StyledContainer direction="row" role="status" aria-label="Assistant is typing">
    <StyledLogoWrapper>
      <ChatBotLogo animated ariaLabel="Assistant" />
    </StyledLogoWrapper>
    <StyledProgress size={20} thickness={4} aria-label="Loading" />
  </StyledContainer>
);

export default React.memo<Props>(BotTypingIndicator);
