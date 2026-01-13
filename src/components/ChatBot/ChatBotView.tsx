import React, { useMemo } from "react";

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

  const showFloatingButton = useMemo(() => !isOpen || isMinimized, [isOpen, isMinimized]);

  return (
    <>
      {showFloatingButton && <FloatingChatButton label={label} onClick={openDrawer} />}

      {isOpen && (
        <ChatDrawer>
          <ChatPanel />
        </ChatDrawer>
      )}
    </>
  );
};

export default React.memo(ChatBot);
