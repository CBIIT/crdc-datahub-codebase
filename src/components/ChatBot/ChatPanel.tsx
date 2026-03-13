import { Container, Stack, styled } from "@mui/material";
import React, { useCallback, useMemo } from "react";

import { useChatConversationContext } from "./context/ChatConversationContext";
import { useChatDrawerContext } from "./context/ChatDrawerContext";
import ChatComposer from "./panel/ChatComposer";
import MessageList from "./panel/MessageList";

const StyledStack = styled(Stack, {
  shouldForwardProp: (prop) => prop !== "isExpanded" && prop !== "isFullscreen",
})<{ isExpanded?: boolean; isFullscreen?: boolean }>(({ isExpanded, isFullscreen }) => ({
  height: "100%",
  background: "rgba(255, 255, 255, 0.75)",
  border: "2px solid #2982D7",
  boxShadow: "0px 4px 4px rgba(0, 0, 0, 0.45)",
  backdropFilter: "blur(10px)",
  borderRadius: "10px",
  overflow: "hidden",

  position: "relative",
  ...(isExpanded && {
    background: "#FFFFFF",
    backdropFilter: "none",
    borderRadius: 0,
    border: "none",
    boxShadow: "none",
  }),
  ...(isFullscreen && {
    background: "linear-gradient(180deg, #FFFFFF 0%, #C9E5F8 100%)",
    backdropFilter: "none",
    borderRadius: 0,
    border: "none",
    boxShadow: "none",
    overflow: "auto",
  }),
}));

const StyledContainer = styled(Container, {
  shouldForwardProp: (prop) => prop !== "isFullscreen",
})<{ isFullscreen?: boolean }>(({ isFullscreen }) => ({
  height: isFullscreen ? "auto" : "100%",
  minHeight: isFullscreen ? "100%" : undefined,
  display: "flex",
  flexDirection: "column",
  background: "transparent",
}));

/**
 * Renders the main chat interface with message history and user input composer.
 */
const ChatPanel = (): JSX.Element => {
  const { isExpanded, isFullscreen } = useChatDrawerContext();
  const { messages, inputValue, isBotTyping, setInputValue, sendMessage, handleKeyDown } =
    useChatConversationContext();

  /**
   * Determines if the send button should be disabled based on input state and bot typing status.
   */
  const isSendDisabled = useMemo((): boolean => {
    if (isBotTyping) {
      return true;
    }

    return inputValue?.trim()?.length === 0;
  }, [inputValue, isBotTyping]);

  /**
   * Handles input value changes and updates the state.
   */
  const handleValueChange = useCallback(
    (value: string): void => setInputValue(value),
    [setInputValue]
  );

  const content = (
    <>
      <MessageList messages={messages} isBotTyping={isBotTyping} onQuestionClick={sendMessage} />
      <ChatComposer
        value={inputValue}
        onChange={handleValueChange}
        onSend={sendMessage}
        onKeyDown={handleKeyDown}
        isSendDisabled={isSendDisabled}
      />
    </>
  );

  return (
    <StyledStack direction="column" isExpanded={isExpanded} isFullscreen={isFullscreen}>
      {isFullscreen ? (
        <StyledContainer maxWidth="md" isFullscreen={isFullscreen}>
          {content}
        </StyledContainer>
      ) : (
        content
      )}
    </StyledStack>
  );
};

export default React.memo(ChatPanel);
