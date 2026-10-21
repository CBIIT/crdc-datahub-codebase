import React, { useCallback, useMemo } from "react";

import { ConversationPanel, MessageComposer } from "@/components/Conversation";

import chatConfig from "./config/chatConfig";
import { useChatConversationContext } from "./context/ChatConversationContext";
import MessageList from "./panel/MessageList";

/**
 * Renders the main chat interface with message history and user input composer.
 */
const ChatPanel = (): JSX.Element => {
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

  return (
    <ConversationPanel>
      <MessageList messages={messages} isBotTyping={isBotTyping} onQuestionClick={sendMessage} />
      <MessageComposer
        value={inputValue}
        onChange={handleValueChange}
        onSend={sendMessage}
        onKeyDown={handleKeyDown}
        isSendDisabled={isSendDisabled}
        maxLength={chatConfig.maxInputTextLength}
      />
    </ConversationPanel>
  );
};

export default React.memo(ChatPanel);
