import React, { useCallback, useState } from "react";

import ChatDrawer from "./ChatDrawer";
import ChatPanel from "./ChatPanel";
import FloatingChatButton from "./FloatingChatButton";
import { useChatConversation } from "./hooks/useChatConversation";
import { useChatDrawer } from "./hooks/useChatDrawer";

export type Props = {
  /**
   * The floating button label.
   */
  label?: string;
  /**
   * The title appearing within the chat.
   */
  title?: string;
};

/**
 * ChatBot component manages the chat interface including the floating button, drawer, and panel states.
 */
const ChatBot = ({ label = "Chat", title = "Chat" }: Props): JSX.Element => {
  const {
    drawerRef,
    isOpen,
    isDragging,
    isExpanded,
    drawerHeightPx,
    openDrawer,
    closeDrawer,
    beginResize,
    toggleExpand,
  } = useChatDrawer();

  const { endConversation } = useChatConversation();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConfirmingEndConversation, setIsConfirmingEndConversation] = useState(false);

  /**
   * Opens the chat drawer and removes the minimized state when the floating button is clicked.
   */
  const handleOpenDrawer = useCallback((): void => {
    setIsMinimized(false);
    setIsConfirmingEndConversation(false);

    if (!isOpen) {
      openDrawer();
    }
  }, [isOpen, openDrawer]);

  /**
   * Minimizes the chat drawer when the minimize button is clicked.
   */
  const handleMinimizeDrawer = useCallback((): void => {
    if (!isOpen) {
      return;
    }

    setIsMinimized(true);
  }, [isOpen]);

  /**
   * Toggles the fullscreen state of the chat drawer.
   */
  const handleToggleFullscreen = useCallback((): void => {
    setIsFullscreen((prev) => !prev);
  }, []);

  /**
   * Begins the "End Conversation" confirmation flow.
   */
  const handleRequestEndConversation = useCallback((): void => {
    setIsConfirmingEndConversation(true);
  }, []);

  /**
   * Cancels the "End Conversation" confirmation flow.
   */
  const handleCancelEndConversation = useCallback((): void => {
    setIsConfirmingEndConversation(false);
  }, []);

  /**
   * Closes the chat drawer, clears the session, and resets state when the conversation ends.
   */
  const handleEndConversation = useCallback((): void => {
    endConversation();
    setIsConfirmingEndConversation(false);
    setIsMinimized(false);
    setIsFullscreen(false);
    closeDrawer();
  }, [endConversation, closeDrawer]);

  return (
    <>
      <FloatingChatButton label={label} onClick={handleOpenDrawer} />

      {isOpen ? (
        <ChatDrawer
          ref={drawerRef}
          heightPx={drawerHeightPx}
          isDragging={isDragging}
          isExpanded={isExpanded}
          isMinimized={isMinimized}
          isFullscreen={isFullscreen}
          title={title}
          onBeginResize={beginResize}
          onToggleExpand={toggleExpand}
          onToggleFullscreen={handleToggleFullscreen}
          onMinimize={handleMinimizeDrawer}
          onRequestEndConversation={handleRequestEndConversation}
          isConfirmingEndConversation={isConfirmingEndConversation}
          onConfirmEndConversation={handleEndConversation}
          onCancelEndConversation={handleCancelEndConversation}
        >
          <ChatPanel />
        </ChatDrawer>
      ) : null}
    </>
  );
};

export default React.memo(ChatBot);
