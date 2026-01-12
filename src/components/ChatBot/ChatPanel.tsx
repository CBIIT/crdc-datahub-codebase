import { Stack, styled } from "@mui/material";
import React, { useCallback, useMemo } from "react";

import { useChatConversationContext } from "./context/ChatConversationContext";
import { useChatDrawerContext } from "./context/ChatDrawerContext";
import ChatComposer from "./panel/ChatComposer";
import MessageList from "./panel/MessageList";

const StyledStack = styled(Stack, {
  shouldForwardProp: (prop) => prop !== "isFullscreen",
})<{ isFullscreen?: boolean }>(({ isFullscreen }) => ({
  height: "100%",
  ...(isFullscreen && {
    fontSize: "18px",
  }),
}));

/**
 * Renders the main chat interface with message history and user input composer.
 */
const ChatPanel = (): JSX.Element => {
  const { isFullscreen } = useChatDrawerContext();
  const {
    greetingTimestamp,
    messages,
    inputValue,
    isBotTyping,
    setInputValue,
    sendMessage,
    handleKeyDown,
  } = useChatConversationContext();

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

  return (
    <StyledStack direction="column" isFullscreen={isFullscreen}>
      <MessageList
        greetingTimestamp={greetingTimestamp}
        messages={messages}
        isBotTyping={isBotTyping}
      />
      <ChatComposer
        value={inputValue}
        onChange={handleValueChange}
        onSend={sendMessage}
        onKeyDown={handleKeyDown}
        isSendDisabled={isSendDisabled}
      />
    </StyledStack>
  );
};

export default React.memo(ChatPanel);
