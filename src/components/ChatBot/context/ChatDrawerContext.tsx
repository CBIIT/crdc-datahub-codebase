import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { RndDragCallback, RndResizeCallback } from "react-rnd";

import { useChatDrawer } from "../hooks/useChatDrawer";

import { useChatConversationContext } from "./ChatConversationContext";

type ChatDrawerContextValue = {
  // Drawer open state
  isOpen: boolean;
  openDrawer: () => void;

  // Drawer state
  drawerRef: React.RefObject<HTMLDivElement>;
  heightPx: number;
  widthPx: number;
  x: number;
  y: number;
  isExpanded: boolean;
  isMinimized: boolean;
  isFullscreen: boolean;

  // Drawer actions
  onDragStop: RndDragCallback;
  onResizeStop: RndResizeCallback;
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
    isExpanded,
    drawerHeightPx,
    drawerWidthPx,
    drawerX,
    drawerY,
    openDrawer,
    closeDrawer,
    handleDragStop,
    handleResizeStop,
    toggleExpand,
  } = useChatDrawer();

  const { endConversation } = useChatConversationContext();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConfirmingEndConversation, setIsConfirmingEndConversation] = useState(false);

  /**
   * Hide the page scrollbar when fullscreen mode is active to avoid double scrollbars.
   */
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

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
   * Handles the drawer expand button click.
   * If in fullscreen, exits fullscreen and enters expanded mode.
   * Otherwise, toggles the expanded state.
   */
  const handleToggleExpand = useCallback((): void => {
    if (isFullscreen && isExpanded) {
      setIsFullscreen(false);
      return;
    }

    if (isFullscreen) {
      setIsFullscreen(false);
      toggleExpand();
      return;
    }

    toggleExpand();
  }, [isFullscreen, isExpanded, toggleExpand]);

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
      widthPx: drawerWidthPx,
      x: drawerX,
      y: drawerY,
      isExpanded,
      isMinimized,
      isFullscreen,
      onDragStop: handleDragStop,
      onResizeStop: handleResizeStop,
      onToggleExpand: handleToggleExpand,
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
      drawerWidthPx,
      drawerX,
      drawerY,
      isExpanded,
      isMinimized,
      isFullscreen,
      handleDragStop,
      handleResizeStop,
      handleToggleExpand,
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
