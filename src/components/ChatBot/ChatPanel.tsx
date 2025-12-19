import { Stack } from "@mui/material";
import React, { useCallback, useMemo } from "react";

import { useChatConversation } from "./hooks/useChatConversation";
import ChatComposer from "./panel/ChatComposer";
import MessageList from "./panel/MessageList";

/**
 * Renders the main chat interface with message history and user input composer.
 */
const ChatPanel = (): JSX.Element => {
  const {
    greetingTimestamp,
    messages,
    inputValue,
    isBotTyping,
    setInputValue,
    sendMessage,
    handleKeyDown,
  } = useChatConversation();

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
    <Stack direction="column" height="100%">
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
    </Stack>
  );
};

export default React.memo(ChatPanel);
