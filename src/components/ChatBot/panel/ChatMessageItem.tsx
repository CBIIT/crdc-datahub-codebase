import { Box, Typography, styled } from "@mui/material";
import React, { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    width: "100%",
    wordWrap: "break-word",
    paddingInline: "12px",
    paddingBlock: "8px",
    borderRadius: "12px",
    backgroundColor: style.backgroundColor,
    border: style.border ?? "none",
    color: style.color,
    fontWeight: style.fontWeight ?? 400,
    fontSize: "16px",
    lineHeight: 1.5,
    whiteSpace: "pre-line",

    '&[data-is-user="true"]': {
      borderTopRightRadius: 0,
      backgroundColor: "#005EA2",
      color: "#FFFFFF",
    },

    '&[data-is-user="false"]': {
      borderTopLeftRadius: 0,
      whiteSpace: "normal",
    },

    // Markdown styles for bot messages
    "& p": {
      margin: 0,
      marginBottom: "8px",
      whiteSpace: "pre-line",
      "&:last-child": {
        marginBottom: 0,
      },
    },
    "& ul, & ol": {
      margin: 0,
      marginBottom: "8px",
      paddingLeft: "20px",
      "&:last-child": {
        marginBottom: 0,
      },
    },
    "& li": {
      marginBottom: "4px",
      paddingLeft: "4px",
      lineHeight: 1.5,
    },
    "& ol li": {
      paddingLeft: "8px",
    },
    "& input[type='checkbox']": {
      marginRight: "8px",
      cursor: "pointer",
      appearance: "none",
      width: "16px",
      height: "16px",
      border: "2px solid #005EA2",
      borderRadius: "3px",
      backgroundColor: "transparent",
      position: "relative",
      flexShrink: 0,
      "&:checked": {
        backgroundColor: "#005EA2",
        border: "2px solid #005EA2",
      },
      "&:checked::after": {
        content: '""',
        position: "absolute",
        left: "4px",
        top: "1px",
        width: "4px",
        height: "8px",
        border: "solid white",
        borderWidth: "0 2px 2px 0",
        transform: "rotate(45deg)",
      },
    },
    "& li:has(input[type='checkbox'])": {
      listStyle: "none",
      paddingLeft: 0,
      display: "flex",
      alignItems: "center",
    },
    "& code": {
      backgroundColor: "rgba(0,0,0,0.08)",
      padding: "2px 4px",
      borderRadius: "3px",
      fontSize: "14px",
      fontFamily: "monospace",
    },
    "& pre": {
      backgroundColor: "rgba(0,0,0,0.08)",
      padding: "8px",
      borderRadius: "4px",
      overflow: "auto",
      marginBottom: "8px",
      "&:last-child": {
        marginBottom: 0,
      },
    },
    "& pre code": {
      backgroundColor: "transparent",
      padding: 0,
    },
    "& strong": {
      fontWeight: 700,
    },
    "& em": {
      fontStyle: "italic",
    },
    "& a": {
      textDecoration: "underline",
    },
    "& h1, & h2, & h3, & h4, & h5, & h6": {
      margin: 0,
      marginBottom: "8px",
      fontWeight: 600,
      "&:last-child": {
        marginBottom: 0,
      },
    },
    "& blockquote": {
      borderLeft: "4px solid rgba(0,0,0,0.2)",
      paddingLeft: "12px",
      margin: 0,
      marginBottom: "8px",
      "&:last-child": {
        marginBottom: 0,
      },
    },
    "& hr": {
      border: "none",
      borderTop: "1px solid rgba(0,0,0,0.12)",
      margin: "12px 0",
    },
    "& table": {
      borderCollapse: "collapse",
      width: "100%",
      marginBottom: "8px",
      fontSize: "14px",
      backgroundColor: "#FFFFFF",
      display: "block",
      overflowX: "auto",
      "&:last-child": {
        marginBottom: 0,
      },
    },
    "& th, & td": {
      border: "1px solid rgba(0,0,0,0.12)",
      padding: "6px 8px",
      textAlign: "left",
      backgroundColor: "#FFFFFF",
    },
    "& th": {
      backgroundColor: "#D0D0D0",
      fontWeight: 600,
    },
    "& img": {
      maxWidth: "100%",
      height: "auto",
      borderRadius: "4px",
      marginBottom: "8px",
      "&:last-child": {
        marginBottom: 0,
      },
    },
    "& del": {
      textDecoration: "line-through",
      opacity: 0.7,
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
          {isUser ? (
            message.text
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          )}
        </MessageBubble>
      </MessageColumn>
    </MessageRow>
  );
};

export default React.memo<Props>(ChatMessageItem);
