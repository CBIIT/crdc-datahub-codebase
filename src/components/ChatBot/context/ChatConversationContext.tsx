import React, { createContext, useContext, useMemo } from "react";

import { useChatConversation } from "../hooks/useChatConversation";

type ChatConversationContextValue = ReturnType<typeof useChatConversation>;

const ChatConversationContext = createContext<ChatConversationContextValue | null>(null);

export const useChatConversationContext = (): ChatConversationContextValue => {
  const context = useContext(ChatConversationContext);

  if (!context) {
    throw new Error("useChatConversationContext must be used within ChatConversationProvider");
  }

  return context;
};

export type ChatConversationProviderProps = {
  children: React.ReactNode;
};

export const ChatConversationProvider: React.FC<ChatConversationProviderProps> = ({ children }) => {
  const conversationHook = useChatConversation();

  const value = useMemo<ChatConversationContextValue>(() => conversationHook, [conversationHook]);

  return (
    <ChatConversationContext.Provider value={value}>{children}</ChatConversationContext.Provider>
  );
};
