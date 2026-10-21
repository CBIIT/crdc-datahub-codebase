import { Box, Chip, styled } from "@mui/material";
import React from "react";

import { MessageItem } from "@/components/Conversation";

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
 * Renders a single chat message with sender info, timestamp, styled bubble, and citations.
 */
const ChatMessageItem = ({ message, isFirstMessage = false }: Props): JSX.Element => {
  if (!message) {
    return null;
  }

  const hasCitations = message?.citations?.length > 0;

  return (
    <MessageItem
      message={message}
      isUser={message.sender === "user"}
      isFirstMessage={isFirstMessage}
    >
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
    </MessageItem>
  );
};

export default React.memo<Props>(ChatMessageItem);
