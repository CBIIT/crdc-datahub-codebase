import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { useChatConversation } from "../hooks/useChatConversation";
import { useChatDrawer } from "../hooks/useChatDrawer";

type ChatDrawerContextValue = {
  // Drawer open state
  isOpen: boolean;
  openDrawer: () => void;

  // Drawer state
  drawerRef: React.RefObject<HTMLDivElement>;
  heightPx: number;
  isDragging: boolean;
  isExpanded: boolean;
  isMinimized: boolean;
  isFullscreen: boolean;

  // Drawer actions
  onBeginResize: React.PointerEventHandler<HTMLDivElement>;
  onToggleExpand: () => void;
  onToggleFullscreen: () => void;
  onMinimize: () => void;

  // End conversation state
  isConfirmingEndConversation: boolean;
  onRequestEndConversation: () => void;
  onConfirmEndConversation: () => void;
  onCancelEndConversation: () => void;
};

const ChatDrawerContext = createContext<ChatDrawerContextValue | null>(null);

export const useChatDrawerContext = (): ChatDrawerContextValue => {
  const context = useContext(ChatDrawerContext);

  if (!context) {
    throw new Error("useChatDrawerContext must be used within ChatDrawerProvider");
  }

  return context;
};

export type ChatDrawerProviderProps = {
  children: React.ReactNode;
};

export const ChatDrawerProvider: React.FC<ChatDrawerProviderProps> = ({ children }) => {
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

  const value = useMemo<ChatDrawerContextValue>(
    () => ({
      isOpen,
      openDrawer: handleOpenDrawer,
      drawerRef,
      heightPx: drawerHeightPx,
      isDragging,
      isExpanded,
      isMinimized,
      isFullscreen,
      onBeginResize: beginResize,
      onToggleExpand: toggleExpand,
      onToggleFullscreen: handleToggleFullscreen,
      onMinimize: handleMinimizeDrawer,
      isConfirmingEndConversation,
      onRequestEndConversation: handleRequestEndConversation,
      onConfirmEndConversation: handleEndConversation,
      onCancelEndConversation: handleCancelEndConversation,
    }),
    [
      isOpen,
      handleOpenDrawer,
      drawerRef,
      drawerHeightPx,
      isDragging,
      isExpanded,
      isMinimized,
      isFullscreen,
      beginResize,
      toggleExpand,
      handleToggleFullscreen,
      handleMinimizeDrawer,
      isConfirmingEndConversation,
      handleRequestEndConversation,
      handleEndConversation,
      handleCancelEndConversation,
    ]
  );

  return <ChatDrawerContext.Provider value={value}>{children}</ChatDrawerContext.Provider>;
};
