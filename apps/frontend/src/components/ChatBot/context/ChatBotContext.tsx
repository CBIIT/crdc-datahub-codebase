import React, { createContext, useContext, useMemo } from "react";

import chatConfig from "../config/chatConfig";

type ChatBotContextValue = {
  label: string;
  knowledgeBaseUrl: string;
};

const ChatBotContext = createContext<ChatBotContextValue | null>(null);

export const useChatBotContext = (): ChatBotContextValue => {
  const context = useContext(ChatBotContext);

  if (!context) {
    throw new Error("useChatBotContext must be used within ChatBotProvider");
  }

  return context;
};

export type ChatBotProviderProps = {
  label?: string;
  knowledgeBaseUrl?: string;
  children: React.ReactNode;
};

export const ChatBotProvider: React.FC<ChatBotProviderProps> = ({
  label = chatConfig.floatingButton.label,
  knowledgeBaseUrl = "",
  children,
}) => {
  const value = useMemo<ChatBotContextValue>(
    () => ({
      label,
      knowledgeBaseUrl,
    }),
    [label, knowledgeBaseUrl]
  );

  return <ChatBotContext.Provider value={value}>{children}</ChatBotContext.Provider>;
};
