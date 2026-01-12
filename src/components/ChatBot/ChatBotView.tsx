import React from "react";

import ChatDrawer from "./ChatDrawer";
import ChatPanel from "./ChatPanel";
import { useChatBotContext } from "./context/ChatBotContext";
import { useChatDrawerContext } from "./context/ChatDrawerContext";
import FloatingChatButton from "./FloatingChatButton";

/**
 * The view component for the entire ChatBot.
 */
const ChatBot = (): JSX.Element => {
  const { label } = useChatBotContext();
  const { isOpen, openDrawer, isMinimized } = useChatDrawerContext();

  if (!isOpen || isMinimized) {
    return <FloatingChatButton label={label} onClick={openDrawer} />;
  }

  return (
    <ChatDrawer>
      <ChatPanel />
    </ChatDrawer>
  );
};

export default React.memo(ChatBot);
