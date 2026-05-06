import { CircularProgress, Stack, styled } from "@mui/material";
import React from "react";

import ChatBotLogo from "../components/ChatBotLogo";

const StyledContainer = styled(Stack)({
  alignItems: "center !important",
  marginBottom: "12px !important",
});

const StyledLogoWrapper = styled("div")({
  marginRight: "2px !important",
  display: "flex !important",
  alignItems: "center !important",
  justifyContent: "center !important",
  "& > button": {
    transform: "scale(0.6667) !important",
    transformOrigin: "center !important",
  },
});

const StyledProgress = styled(CircularProgress)({
  color: "#005EA2 !important",
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
