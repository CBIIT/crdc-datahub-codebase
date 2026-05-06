import { Check, ContentCopy } from "@mui/icons-material";
import { Box, Chip, IconButton, Typography, styled } from "@mui/material";
import React, { CSSProperties, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useChatDrawerContext } from "../context/ChatDrawerContext";

const MessageRow = styled(Box)({
  display: "flex !important",
  justifyContent: "flex-start !important",
  marginBottom: "12px !important",
  '&[data-is-user="true"]': {
    justifyContent: "flex-end !important",
  },
});

const MessageColumn = styled(Box)({
  maxWidth: "100% !important",
  width: "100% !important",
  display: "flex !important",
  flexDirection: "column !important" as never,
  alignItems: "flex-start !important",
  '&[data-is-user="true"]': {
    alignItems: "flex-end !important",
    width: "auto !important",
  },
});

const MessageMetaRow = styled(Box)({
  display: "flex !important",
  alignItems: "center !important",
  gap: "8px !important",
  marginBottom: "4px !important",
  paddingInline: "4px !important",
});

const MessageDateText = styled(Typography)({
  fontFamily: "Nunito !important",
  fontStyle: "normal !important",
  fontWeight: "300 !important",
  fontSize: "11px !important",
  lineHeight: "19px !important",
  color: "#3E3E3E !important",
});

const MessageDateDivider = styled(Box)({
  width: "0.5px !important",
  height: "12px !important",
  backgroundColor: "#3E3E3E !important",
});

const MessageTimestamp = styled(Typography)({
  fontFamily: "Nunito !important",
  fontStyle: "normal !important",
  fontWeight: "300 !important",
  fontSize: "11px !important",
  lineHeight: "19px !important",
  color: "#3E3E3E !important",
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
    width: "100% !important",
    wordWrap: "break-word !important" as never,
    paddingInline: isFullscreen ? "16px !important" : "12px !important",
    paddingBlock: isFullscreen ? "12px !important" : "8px !important",
    borderRadius: "12px !important",
    backgroundColor: `${style.backgroundColor} !important`,
    border: `${style.border ?? "none"} !important`,
    color: `${style.color} !important`,
    fontWeight: `${style.fontWeight ?? 400} !important`,
    fontSize: isFullscreen ? "18px !important" : "16px !important",
    lineHeight: "1.5 !important",
    whiteSpace: "pre-line !important" as never,
    fontFamily: "Inter !important",

    '&[data-is-user="true"]': {
      position: "relative !important" as never,
      isolation: "isolate !important" as never,
      width: "fit-content !important",
      borderRadius: "8px !important",
      color: "#FFFFFF !important",
      boxShadow: "-2px 4px 8px rgba(0, 0, 0, 0.25) !important",
      backgroundImage:
        "linear-gradient(90deg, #2596E5 0%, #2C68C2 49.67%, #5B53D8 100%) !important",
      backgroundRepeat: "no-repeat !important",
      backgroundPosition: "left top !important",
      backgroundSize: "100% 100% !important",
      maxWidth: "100% !important",
      minWidth: "0 !important",
      whiteSpace: "pre-wrap !important" as never,
      overflowWrap: "anywhere !important" as never,
      wordBreak: "break-word !important" as never,

      "&::before": {
        content: '""',
        position: "absolute !important" as never,
        left: "0 !important",
        bottom: "-7px !important",
        width: "100% !important",
        height: "17px !important",
        zIndex: "-1 !important",
        pointerEvents: "none !important",
        backgroundImage: "inherit !important",
        backgroundRepeat: "inherit !important",
        backgroundPosition: "inherit !important",
        backgroundSize: "inherit !important",
        clipPath: "circle(8.5px at calc(100% - 26.5px) 8.5px) !important",
        WebkitClipPath: "circle(8.5px at calc(100% - 26.5px) 8.5px) !important",
      },

      "&::after": {
        content: '""',
        position: "absolute !important" as never,
        left: "0 !important",
        bottom: "-12px !important",
        width: "100% !important",
        height: "8px !important",
        zIndex: "-1 !important",
        pointerEvents: "none !important",
        backgroundImage: "inherit !important",
        backgroundRepeat: "inherit !important",
        backgroundPosition: "inherit !important",
        backgroundSize: "inherit !important",
        clipPath: "circle(4px at calc(100% - 15.5px) 4px) !important",
        WebkitClipPath: "circle(4px at calc(100% - 15.5px) 4px) !important",
      },
    },

    '&[data-is-user="false"]': {
      borderTopLeftRadius: "0 !important",
      whiteSpace: "normal !important" as never,
      paddingInline: "4px !important",
      paddingBlock: "0 !important",
    },

    // Markdown styles for bot messages
    "& p": {
      margin: "0 !important",
      marginBottom: "8px !important",
      whiteSpace: "pre-line !important" as never,
      "&:last-child": {
        marginBottom: "0 !important",
      },
    },
    "& ul, & ol": {
      margin: "0 !important",
      marginBottom: "8px !important",
      paddingLeft: "20px !important",
      "&:last-child": {
        marginBottom: "0 !important",
      },
    },
    "& li": {
      marginBottom: "4px !important",
      paddingLeft: "4px !important",
      lineHeight: "1.5 !important",
    },
    "& ol li": {
      paddingLeft: "8px !important",
    },
    "& input[type='checkbox']": {
      marginRight: "8px !important",
      cursor: "pointer !important",
      appearance: "none !important" as never,
      width: "16px !important",
      height: "16px !important",
      border: "2px solid #005EA2 !important",
      borderRadius: "3px !important",
      backgroundColor: "transparent !important",
      position: "relative !important" as never,
      flexShrink: "0 !important",
      "&:checked": {
        backgroundColor: "#005EA2 !important",
        border: "2px solid #005EA2 !important",
      },
      "&:checked::after": {
        content: '""',
        position: "absolute !important" as never,
        left: "4px !important",
        top: "1px !important",
        width: "4px !important",
        height: "8px !important",
        border: "solid white !important",
        borderWidth: "0 2px 2px 0 !important",
        transform: "rotate(45deg) !important",
      },
    },
    "& li:has(input[type='checkbox'])": {
      listStyle: "none !important",
      paddingLeft: "0 !important",
      display: "flex !important",
      alignItems: "center !important",
    },
    "& code": {
      backgroundColor: "rgba(0,0,0,0.08) !important",
      padding: "2px 4px !important",
      borderRadius: "3px !important",
      fontSize: "14px !important",
      fontFamily: "monospace !important",
    },
    "& pre": {
      backgroundColor: "rgba(0,0,0,0.08) !important",
      padding: "8px !important",
      borderRadius: "4px !important",
      overflow: "auto !important",
      marginBottom: "8px !important",
      "&:last-child": {
        marginBottom: "0 !important",
      },
    },
    "& pre code": {
      backgroundColor: "transparent !important",
      padding: "0 !important",
    },
    "& strong": {
      fontWeight: "700 !important",
    },
    "& em": {
      fontStyle: "italic !important",
    },
    "& a": {
      textDecoration: "underline !important",
    },
    "& h1, & h2, & h3, & h4, & h5, & h6": {
      margin: "0 !important",
      marginBottom: "8px !important",
      fontWeight: "600 !important",
      color: "#034AA3 !important",

      "&:last-child": {
        marginBottom: "0 !important",
      },
    },
    "& h1": { fontSize: "28px !important" },
    "& h2": { fontSize: "26px !important" },
    "& h3": { fontSize: "24px !important" },
    "& h4": { fontSize: "22px !important" },
    "& h5": { fontSize: "20px !important" },
    "& h6": { fontSize: "18px !important" },
    "& blockquote": {
      borderLeft: "4px solid rgba(0,0,0,0.2) !important",
      paddingLeft: "12px !important",
      margin: "0 !important",
      marginBottom: "8px !important",
      "&:last-child": {
        marginBottom: "0 !important",
      },
    },
    "& hr": {
      border: "none !important",
      borderTop: "1px solid rgba(0,0,0,0.12) !important",
      margin: "12px 0 !important",
    },
    "& table": {
      borderCollapse: "collapse !important" as never,
      width: "fit-content !important",
      maxWidth: "100% !important",
      marginBottom: "8px !important",
      fontSize: "14px !important",
      backgroundColor: "transparent !important",
      display: "block !important",
      overflowX: "auto !important" as never,
      "&:last-child": {
        marginBottom: "0 !important",
      },
    },
    "& th, & td": {
      border: "1px solid rgba(0,0,0,0.12) !important",
      padding: "6px 8px !important",
      textAlign: "left !important" as never,
      backgroundColor: "#FFFFFF !important",
    },
    "& th": {
      backgroundColor: "#D0D0D0 !important",
      fontWeight: "600 !important",
    },
    "& img": {
      maxWidth: "100% !important",
      height: "auto !important",
      borderRadius: "4px !important",
      marginBottom: "8px !important",
      "&:last-child": {
        marginBottom: "0 !important",
      },
    },
    "& del": {
      textDecoration: "line-through !important",
      opacity: "0.7 !important",
    },
  };
});

const CitationsContainer = styled(Box)({
  display: "flex !important",
  flexWrap: "wrap !important" as never,
  gap: "5px !important",
  marginTop: "6px !important",
});

const StyledCitationChip = styled(Chip)({
  display: "flex !important",
  flexDirection: "row !important" as never,
  justifyContent: "center !important",
  alignItems: "center !important",
  padding: "1px 7px !important",
  gap: "10px !important",
  height: "auto !important",
  background: "#EBEBEB !important",
  borderRadius: "20px !important",
  border: "1px solid #B0B0B0 !important",
  cursor: "pointer !important",
  textDecoration: "none !important",
  fontFamily: "Inter !important",
  fontStyle: "normal !important",
  fontWeight: "400 !important",
  fontSize: "8px !important",
  lineHeight: "14px !important",
  letterSpacing: "0.01em !important",
  color: "#505E6D !important",
  "&:hover": {
    background: "#E0E0E0 !important",
    textDecoration: "none !important",
  },
  "&:link, &:visited, &:active": {
    textDecoration: "none !important",
  },
  "& .MuiChip-label": {
    padding: "0 !important",
    fontSize: "8px !important",
    lineHeight: "14px !important",
    color: "#505E6D !important",
  },
}) as typeof Chip;

const StyledCopyButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== "isFullscreen",
})<{ isFullscreen?: boolean }>(({ isFullscreen }) => ({
  position: "absolute !important" as never,
  top: isFullscreen ? "7.5px !important" : "6px !important",
  right: "8px !important",
  padding: "6px !important",
  minWidth: "auto !important",
  color: "rgba(0, 0, 0, 0.6) !important",
  backgroundColor: "rgba(255, 255, 255, 0.8) !important",
  backdropFilter: "blur(4px) !important",
  zIndex: "1 !important",
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.95) !important",
    color: "rgba(0, 0, 0, 0.8) !important",
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
