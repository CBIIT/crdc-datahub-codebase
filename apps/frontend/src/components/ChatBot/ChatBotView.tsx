import React, { useMemo } from "react";

import { FloatingWindow, useFloatingWindowContext } from "@/components/FloatingWindow";
import type { FloatingWindowLabels } from "@/components/FloatingWindow";

import ChatPanel from "./ChatPanel";
import { useChatBotContext } from "./context/ChatBotContext";
import EndConversationConfirm from "./EndConversationConfirm";
import FloatingChatButton from "./FloatingChatButton";

const WINDOW_LABELS: FloatingWindowLabels = {
  expand: "Expand chat drawer",
  collapse: "Collapse chat drawer",
  enterFullscreen: "Enter full screen",
  exitFullscreen: "Exit full screen",
  minimize: "Minimize chat",
  close: "End conversation",
};

/**
 * The view component for the entire ChatBot.
 */
const ChatBot = (): JSX.Element => {
  const { label } = useChatBotContext();
  const { isOpen, openWindow, isMinimized } = useFloatingWindowContext();

  const showFloatingButton = useMemo(() => !isOpen || isMinimized, [isOpen, isMinimized]);

  return (
    <>
      {showFloatingButton && <FloatingChatButton label={label} onClick={openWindow} />}

      {isOpen && (
        <FloatingWindow
          id="chat-drawer"
          labels={WINDOW_LABELS}
          confirmCloseContent={<EndConversationConfirm />}
        >
          <ChatPanel />
        </FloatingWindow>
      )}
    </>
  );
};

export default React.memo(ChatBot);
