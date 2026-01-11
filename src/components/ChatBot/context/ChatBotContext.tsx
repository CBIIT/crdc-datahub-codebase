import React, { createContext, useContext, useMemo } from "react";

type ChatBotContextValue = {
  title: string;
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
  title?: string;
  label?: string;
  knowledgeBaseUrl?: string;
  children: React.ReactNode;
};

export const ChatBotProvider: React.FC<ChatBotProviderProps> = ({
  title = "Chat",
  label = "Chat",
  knowledgeBaseUrl = "",
  children,
}) => {
  const value = useMemo<ChatBotContextValue>(
    () => ({
      title,
      label,
      knowledgeBaseUrl,
    }),
    [title, label, knowledgeBaseUrl]
  );

  return <ChatBotContext.Provider value={value}>{children}</ChatBotContext.Provider>;
};
