import { Box, Button, Stack, Typography, styled } from "@mui/material";
import React, { useEffect, useRef } from "react";

import ChatBotLogo from "../components/ChatBotLogo";
import chatConfig from "../config/chatConfig";
import { useChatDrawerContext } from "../context/ChatDrawerContext";

import BotTypingIndicator from "./BotTypingIndicator";
import ChatMessageItem from "./ChatMessageItem";

const MessagesContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== "isExpanded" && prop !== "isFullscreen",
})<{ isExpanded?: boolean; isFullscreen?: boolean }>(({ isExpanded, isFullscreen }) => ({
  flex: isFullscreen ? "none" : 1,
  overflowY: isFullscreen ? "visible" : "auto",
  paddingInline: "24.5px",
  paddingTop: isExpanded ? "25px" : 0,
  marginTop: 0,
  marginRight: isFullscreen ? 0 : "10px",
  overscrollBehavior: "contain",
  ...(!isFullscreen && {
    "&::-webkit-scrollbar": {
      width: "7px",
    },
    "&::-webkit-scrollbar-track": {
      background: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      background: "#7C7C7C",
      borderRadius: "4px",
    },
  }),
}));

const ChatHeader = styled(Box, {
  shouldForwardProp: (prop) => prop !== "isExpanded",
})<{ isExpanded?: boolean }>(({ isExpanded }) => ({
  textAlign: "center",
  paddingTop: isExpanded ? 0 : "25px",
}));

const StyledLogoWrapper = styled(Box)({
  display: "flex",
  justifyContent: "center",
  marginBottom: "12px",
});

const ChatTitle = styled(Typography)({
  marginBottom: "8px",
  fontFamily: "Inter",
  fontStyle: "normal",
  fontWeight: "600",
  fontSize: "14px",
  lineHeight: "18px",
  color: "#3D4143",
});

const ChatSubtitle = styled(Typography)({
  fontFamily: "Inter",
  fontStyle: "normal",
  fontWeight: 400,
  fontSize: "13px",
  lineHeight: "18px",
  color: "#3E3E3E",
});

const StyledQuestionWrapper = styled(Stack)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  columnGap: "12px",
  rowGap: "5px",
  margin: "12px 0 0",
});

const StyledQuestion = styled(Button)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  padding: "0px 8px",
  background: "#FFFFFF",
  opacity: 0.8,
  border: "1px solid #828282",
  borderRadius: "8px",

  fontFamily: "Nunito",
  fontStyle: "normal",
  fontWeight: 600,
  fontSize: "11px",
  lineHeight: "22px",
  textAlign: "center",
  letterSpacing: "-0.0015em",
  color: "#334B5A",
  transition: "background 0.1s ease-in-out",

  "&:hover": {
    color: "#FFFFFF",
    background: "linear-gradient(90deg, #0081DF 0%, #2A70D8 48.08%, #554BEE 100%)",
  },
});

const defaultQuestions = [
  "What is a Submission Request",
  "How do I request access?",
  "How do I start a submission?",
  "How do I upload data files",
];

export type Props = {
  /**
   * Array of chat messages to display in the message list.
   */
  messages: readonly ChatMessage[];
  /**
   * Indicates whether the bot is currently typing a response.
   */
  isBotTyping: boolean;
  /**
   * Callback when a default question is clicked.
   */
  onQuestionClick?: (question: string) => void;
};

/**
 * Displays a scrollable list of chat messages with automatic scrolling to the latest message.
 */
const MessageList = ({ messages, isBotTyping, onQuestionClick }: Props): JSX.Element => {
  const { isExpanded, isFullscreen } = useChatDrawerContext();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages?.length > 0 ? messages[messages.length - 1] : null;
  const lastMessageText = lastMessage?.text || "";

  /**
   * Gets the current scroll container based on view mode.
   */
  const getScrollContainer = (): HTMLElement | null => {
    const element = messagesContainerRef.current;
    if (!element) {
      return null;
    }

    if (isFullscreen) {
      return element.parentElement?.parentElement ?? null;
    }
    return element;
  };

  useEffect(() => {
    const container = getScrollContainer();
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [isFullscreen, isExpanded]);

  useEffect(() => {
    const container = getScrollContainer();
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [lastMessageText, isBotTyping]);

  const hasMessages = messages.length > 1;

  return (
    <MessagesContainer
      ref={messagesContainerRef}
      isExpanded={isExpanded}
      isFullscreen={isFullscreen}
    >
      <ChatHeader isExpanded={isExpanded}>
        <StyledLogoWrapper>
          <ChatBotLogo ariaLabel="CRDC Assistant Logo" />
        </StyledLogoWrapper>
        {!hasMessages && (
          <>
            <ChatTitle variant="h6">{chatConfig.initialMessage}</ChatTitle>
            <ChatSubtitle>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
              exercitation ullamco laboris nisi ut aliquip.
            </ChatSubtitle>

            <StyledQuestionWrapper direction="row" flexWrap="wrap">
              {defaultQuestions.map((question) => (
                <StyledQuestion
                  key={question}
                  aria-label={question}
                  onClick={() => onQuestionClick?.(question)}
                >
                  {question}
                </StyledQuestion>
              ))}
            </StyledQuestionWrapper>
          </>
        )}
      </ChatHeader>

      {hasMessages &&
        messages?.map((message, index) => (
          <ChatMessageItem key={message.id} message={message} isFirstMessage={index === 0} />
        ))}

      {isBotTyping ? <BotTypingIndicator /> : null}
    </MessagesContainer>
  );
};

export default React.memo<Props>(MessageList);
