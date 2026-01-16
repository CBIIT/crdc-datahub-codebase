import { Box, Typography, styled } from "@mui/material";
import React, { useEffect, useRef } from "react";

import { useChatDrawerContext } from "../context/ChatDrawerContext";

import BotTypingIndicator from "./BotTypingIndicator";
import ChatMessageItem from "./ChatMessageItem";

const MessagesContainer = styled(Box)({
  flex: 1,
  overflowY: "auto",
  paddingInline: "16px",
  paddingBottom: "16px",
  overscrollBehavior: "contain",
});

const ChatHeader = styled(Box)({
  textAlign: "center",
  paddingInline: "16px",
  paddingBlock: "16px",
});

const ChatTitle = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "isFullscreen",
})<{ isFullscreen?: boolean }>(({ isFullscreen }) => ({
  fontWeight: 700,
  marginBottom: 0,
  fontSize: isFullscreen ? "24px" : "20px",
}));

const ChatSubtitle = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "isFullscreen",
})<{ isFullscreen?: boolean }>(({ isFullscreen }) => ({
  fontSize: isFullscreen ? "16px" : "12px",
  color: "rgba(0,0,0,0.54)",
}));

const formatGreetingDateTime = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);

export type Props = {
  /**
   * The timestamp when the chat session started, displayed in the greeting header.
   */
  greetingTimestamp: Date;
  /**
   * Array of chat messages to display in the message list.
   */
  messages: readonly ChatMessage[];
  /**
   * Indicates whether the bot is currently typing a response.
   */
  isBotTyping: boolean;
};

/**
 * Displays a scrollable list of chat messages with automatic scrolling to the latest message.
 */
const MessageList = ({ greetingTimestamp, messages, isBotTyping }: Props): JSX.Element => {
  const { isFullscreen } = useChatDrawerContext();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages?.length > 0 ? messages[messages.length - 1] : null;
  const lastMessageText = lastMessage?.text || "";

  useEffect(() => {
    const element = messagesContainerRef.current;
    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  }, [lastMessageText, isBotTyping]);

  return (
    <MessagesContainer ref={messagesContainerRef}>
      <ChatHeader>
        <ChatTitle variant="h6" isFullscreen={isFullscreen}>
          Welcome to the CRDC Submission Portal Support
        </ChatTitle>
        <ChatSubtitle isFullscreen={isFullscreen}>
          {formatGreetingDateTime(greetingTimestamp)}
        </ChatSubtitle>
      </ChatHeader>

      {messages?.map((message) => <ChatMessageItem key={message.id} message={message} />)}

      {isBotTyping ? <BotTypingIndicator /> : null}
    </MessagesContainer>
  );
};

export default React.memo<Props>(MessageList);
