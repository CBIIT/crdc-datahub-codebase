import { Check, ContentCopy } from "@mui/icons-material";
import { Box, Chip, IconButton, Typography, styled } from "@mui/material";
import React, { CSSProperties, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useChatDrawerContext } from "../context/ChatDrawerContext";

const MessageRow = styled(Box)({
  display: "flex",
  justifyContent: "flex-start",
  marginBottom: "12px",
  '&[data-is-user="true"]': {
    justifyContent: "flex-end",
  },
});

const MessageColumn = styled(Box)({
  maxWidth: "100%",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  '&[data-is-user="true"]': {
    alignItems: "flex-end",
    width: "auto",
  },
});

const MessageMetaRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: "4px",
  paddingInline: "4px",
});

const MessageDateText = styled(Typography)({
  fontFamily: "Nunito",
  fontStyle: "normal",
  fontWeight: 300,
  fontSize: "11px",
  lineHeight: "19px",
  color: "#3E3E3E",
});

const MessageDateDivider = styled(Box)({
  width: "0.5px",
  height: "12px",
  backgroundColor: "#3E3E3E",
});

const MessageTimestamp = styled(Typography)({
  fontFamily: "Nunito",
  fontStyle: "normal",
  fontWeight: 300,
  fontSize: "11px",
  lineHeight: "19px",
  color: "#3E3E3E",
});

/**
 * Style definitions for message bubbles based on message variant.
 */
const BOT_BUBBLE_STYLES: Record<ChatMessageVariant, CSSProperties> = {
  default: {
    backgroundColor: "transparent",
    color: "#3D4143",
  },
  info: {
    backgroundColor: "transparent",
    color: "#005EA2",
    fontWeight: 600,
  },
  error: {
    backgroundColor: "transparent",
    color: "#C05239",
    fontWeight: 600,
  },
};

const MessageBubble = styled(Box, {
  shouldForwardProp: (prop) => prop !== "variant" && prop !== "isFullscreen",
})<{ variant?: ChatMessageVariant; isFullscreen?: boolean }>(({ variant, isFullscreen }) => {
  const safeVariant = (variant ?? "default") as ChatMessageVariant;
  const style = BOT_BUBBLE_STYLES[safeVariant];

  return {
    width: "100%",
    wordWrap: "break-word",
    paddingInline: isFullscreen ? "16px" : "12px",
    paddingBlock: isFullscreen ? "12px" : "8px",
    borderRadius: "12px",
    backgroundColor: style.backgroundColor,
    border: style.border ?? "none",
    color: style.color,
    fontWeight: style.fontWeight ?? 400,
    fontSize: isFullscreen ? "18px" : "16px",
    lineHeight: 1.5,
    whiteSpace: "pre-line",
    fontFamily: "Inter",

    '&[data-is-user="true"]': {
      position: "relative",
      isolation: "isolate",
      width: "fit-content",
      borderRadius: "8px",
      color: "#FFFFFF",
      boxShadow: "-2px 4px 8px rgba(0, 0, 0, 0.25)",
      backgroundImage: "linear-gradient(90deg, #2596E5 0%, #2C68C2 49.67%, #5B53D8 100%)",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "left top",
      backgroundSize: "100% 100%",
      maxWidth: "100%",
      minWidth: 0,
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      wordBreak: "break-word",

      "&::before": {
        content: '""',
        position: "absolute",
        left: 0,
        bottom: "-7px",
        width: "100%",
        height: "17px",
        zIndex: -1,
        pointerEvents: "none",
        backgroundImage: "inherit",
        backgroundRepeat: "inherit",
        backgroundPosition: "inherit",
        backgroundSize: "inherit",
        clipPath: "circle(8.5px at calc(100% - 26.5px) 8.5px)",
        WebkitClipPath: "circle(8.5px at calc(100% - 26.5px) 8.5px)",
      },

      "&::after": {
        content: '""',
        position: "absolute",
        left: 0,
        bottom: "-12px",
        width: "100%",
        height: "8px",
        zIndex: -1,
        pointerEvents: "none",
        backgroundImage: "inherit",
        backgroundRepeat: "inherit",
        backgroundPosition: "inherit",
        backgroundSize: "inherit",
        clipPath: "circle(4px at calc(100% - 15.5px) 4px)",
        WebkitClipPath: "circle(4px at calc(100% - 15.5px) 4px)",
      },
    },

    '&[data-is-user="false"]': {
      borderTopLeftRadius: 0,
      whiteSpace: "normal",
      paddingInline: "4px",
      paddingBlock: 0,
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
      color: "#034AA3",

      "&:last-child": {
        marginBottom: 0,
      },
    },
    "& h1": { fontSize: "28px" },
    "& h2": { fontSize: "26px" },
    "& h3": { fontSize: "24px" },
    "& h4": { fontSize: "22px" },
    "& h5": { fontSize: "20px" },
    "& h6": { fontSize: "18px" },
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
      width: "fit-content",
      maxWidth: "100%",
      marginBottom: "8px",
      fontSize: "14px",
      backgroundColor: "transparent",
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

const CitationsContainer = styled(Box)({
  display: "flex",
  flexWrap: "wrap",
  gap: "5px",
  marginTop: "6px",
});

const StyledCitationChip = styled(Chip)({
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  padding: "1px 7px",
  gap: "10px",
  height: "auto",
  background: "#EBEBEB",
  borderRadius: "20px",
  border: "1px solid #B0B0B0",
  cursor: "pointer",
  textDecoration: "none !important",
  fontFamily: "Inter",
  fontStyle: "normal",
  fontWeight: 400,
  fontSize: "8px",
  lineHeight: "14px",
  letterSpacing: "0.01em",
  color: "#505E6D",
  "&:hover": {
    background: "#E0E0E0",
    textDecoration: "none !important",
  },
  "&:link, &:visited, &:active": {
    textDecoration: "none !important",
  },
  "& .MuiChip-label": {
    padding: 0,
    fontSize: "8px",
    lineHeight: "14px",
    color: "#505E6D",
  },
}) as typeof Chip;

const StyledCopyButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== "isFullscreen",
})<{ isFullscreen?: boolean }>(({ isFullscreen }) => ({
  position: "absolute",
  top: isFullscreen ? 7.5 : 6,
  right: 8,
  padding: "6px",
  minWidth: "auto",
  color: "rgba(0, 0, 0, 0.6)",
  backgroundColor: "rgba(255, 255, 255, 0.8)",
  backdropFilter: "blur(4px)",
  zIndex: 1,
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    color: "rgba(0, 0, 0, 0.8)",
  },
}));

/**
 * Custom anchor component for ReactMarkdown that opens links in new tabs.
 */
const LinkComponent = ({
  node,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => (
  <a {...props} target="_blank" rel="noopener noreferrer">
    {props.children}
  </a>
);

/**
 * Custom pre component for ReactMarkdown that includes a copy to clipboard button for code blocks.
 */
const PreComponent = ({ children }: { children: React.ReactNode }) => {
  const { isFullscreen } = useChatDrawerContext();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const codeElement = React.Children.toArray(children).find(
      (child) => React.isValidElement(child) && child.type === "code"
    );

    if (codeElement && React.isValidElement(codeElement)) {
      const codeText = String(codeElement.props.children ?? "").replace(/\n$/, "");
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Box sx={{ position: "relative" }}>
      <StyledCopyButton
        onClick={handleCopy}
        size="small"
        title={copied ? "Copied!" : "Copy to clipboard"}
        isFullscreen={isFullscreen}
      >
        {copied ? <Check sx={{ fontSize: 16 }} /> : <ContentCopy sx={{ fontSize: 16 }} />}
      </StyledCopyButton>
      <pre style={{ paddingRight: "48px" }}>{children}</pre>
    </Box>
  );
};

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

/**
 * Formats a date object into a full date string.
 *
 * @param date - The date to format
 * @return Formatted date string
 * @example "February 19, 2026"
 */
export const formatMessageDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);

type Props = {
  /**
   * The chat message object to render.
   */
  message: ChatMessage;
  /**
   * Whether this is the first message in the conversation (greeting).
   */
  isFirstMessage?: boolean;
};

/**
 * Renders a single chat message with sender info, timestamp, and styled bubble.
 */
const ChatMessageItem = ({ message, isFirstMessage = false }: Props): JSX.Element => {
  const { isFullscreen } = useChatDrawerContext();

  if (!message) {
    return null;
  }

  const isUser = message.sender === "user";
  const dataIsUser = isUser ? "true" : "false";
  const hasCitations = message?.citations?.length > 0;

  return (
    <MessageRow data-is-user={dataIsUser}>
      <MessageColumn data-is-user={dataIsUser}>
        <MessageMetaRow>
          {isFirstMessage && (
            <>
              <MessageDateText>{formatMessageDate(message.timestamp)}</MessageDateText>
              <MessageDateDivider />
            </>
          )}
          <MessageTimestamp>{formatMessageTime(message.timestamp)}</MessageTimestamp>
        </MessageMetaRow>

        <MessageBubble
          data-is-user={dataIsUser}
          variant={message.variant}
          isFullscreen={isFullscreen}
        >
          {isUser ? (
            message.text
          ) : (
            <>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: LinkComponent,
                  pre: PreComponent,
                }}
              >
                {message.text}
              </ReactMarkdown>
              {hasCitations && (
                <CitationsContainer>
                  {message.citations?.map((citation, index) => (
                    <StyledCitationChip
                      // eslint-disable-next-line react/no-array-index-key
                      key={`${message.id}-citation-${index}`}
                      label={citation?.documentName || `[${index + 1}]`}
                      size="small"
                      component="a"
                      href={citation?.documentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                    />
                  ))}
                </CitationsContainer>
              )}
            </>
          )}
        </MessageBubble>
      </MessageColumn>
    </MessageRow>
  );
};

export default React.memo<Props>(ChatMessageItem);
