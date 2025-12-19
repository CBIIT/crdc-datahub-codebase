import { Box, Typography, styled } from "@mui/material";
import React, { CSSProperties } from "react";

const MessageRow = styled(Box)({
  display: "flex",
  justifyContent: "flex-start",
  marginBottom: "12px",
  '&[data-is-user="true"]': {
    justifyContent: "flex-end",
  },
});

const MessageColumn = styled(Box)({
  maxWidth: "80%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  '&[data-is-user="true"]': {
    alignItems: "flex-end",
  },
});

const MessageMetaRow = styled(Box)({
  display: "flex",
  gap: 8,
  marginBottom: "4px",
  paddingInline: "4px",
});

const MessageSender = styled(Typography)({
  fontSize: "12px",
  fontWeight: 500,
  color: "rgba(0,0,0,0.7)",
});

const MessageTimestamp = styled(Typography)({
  fontSize: "12px",
  color: "rgba(0,0,0,0.54)",
});

/**
 * Style definitions for message bubbles based on message variant.
 */
const BOT_BUBBLE_STYLES: Record<ChatMessageVariant, CSSProperties> = {
  default: {
    backgroundColor: "#F5F5F5",
    color: "#212121",
  },
  info: {
    backgroundColor: "#DCEEFB",
    color: "#0B2540",
  },
  error: {
    backgroundColor: "#C05239",
    color: "#FFFFFF",
    fontWeight: 600,
  },
};

const MessageBubble = styled(Box, {
  shouldForwardProp: (prop) => prop !== "variant",
})<{ variant?: ChatMessageVariant }>(({ variant }) => {
  const safeVariant = (variant ?? "default") as ChatMessageVariant;
  const style = BOT_BUBBLE_STYLES[safeVariant];

  return {
    paddingInline: "12px",
    paddingBlock: "8px",
    borderRadius: "12px",
    backgroundColor: style.backgroundColor,
    border: style.border ?? "none",
    color: style.color,
    fontWeight: style.fontWeight ?? 400,
    fontSize: "16px",
    lineHeight: 1.5,

    '&[data-is-user="true"]': {
      borderTopRightRadius: 0,
      backgroundColor: "#005EA2",
      color: "#FFFFFF",
    },

    '&[data-is-user="false"]': {
      borderTopLeftRadius: 0,
    },
  };
});

/**
 * Formats a date object into a localized time string.
 *
 * @param date - The date to format
 * @return Formatted time string in 12-hour format
 * @example "02:30 PM"
 */
export const formatMessageTime = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);

type Props = {
  /**
   * The chat message object to render.
   */
  message: ChatMessage;
};

/**
 * Renders a single chat message with sender info, timestamp, and styled bubble.
 */
const ChatMessageItem = ({ message }: Props): JSX.Element => {
  if (!message) {
    return null;
  }

  const isUser = message.sender === "user";
  const dataIsUser = isUser ? "true" : "false";

  return (
    <MessageRow data-is-user={dataIsUser}>
      <MessageColumn data-is-user={dataIsUser}>
        <MessageMetaRow>
          {!isUser ? <MessageSender>{message.senderName}</MessageSender> : null}
          <MessageTimestamp>{formatMessageTime(message.timestamp)}</MessageTimestamp>
        </MessageMetaRow>

        <MessageBubble data-is-user={dataIsUser} variant={message.variant}>
          {message.text}
        </MessageBubble>
      </MessageColumn>
    </MessageRow>
  );
};

export default React.memo<Props>(ChatMessageItem);
