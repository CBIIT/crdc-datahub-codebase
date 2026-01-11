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
  const { isOpen, openDrawer } = useChatDrawerContext();

  return (
    <>
      <FloatingChatButton label={label} onClick={openDrawer} />

      {isOpen ? (
        <ChatDrawer>
          <ChatPanel />
        </ChatDrawer>
      ) : null}
    </>
  );
};

export default React.memo(ChatBot);
