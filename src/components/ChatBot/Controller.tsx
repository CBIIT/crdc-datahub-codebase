import { FC, memo } from "react";

import env from "@/env";

import ChatBotView from "./ChatBotView";
import { ChatBotProvider } from "./context/ChatBotContext";
import { ChatConversationProvider } from "./context/ChatConversationContext";
import { ChatDrawerProvider } from "./context/ChatDrawerContext";

const MemoizedChatBotProvider = memo(ChatBotProvider);
const MemoizedChatConversationProvider = memo(ChatConversationProvider);
const MemoizedChatDrawerProvider = memo(ChatDrawerProvider);

type Props = {
  /**
   * The floating button label.
   */
  label?: string;
};

/**
 * Controls the visibility of the ChatBot component and manages its providers.
 */
const ChatController: FC<Props> = ({ label }) => {
  const { VITE_CHATBOT_API_BASE_URL } = env || {};

  if (!VITE_CHATBOT_API_BASE_URL?.trim()) {
    return null;
  }

  return (
    <MemoizedChatBotProvider label={label} knowledgeBaseUrl={VITE_CHATBOT_API_BASE_URL}>
      <MemoizedChatConversationProvider>
        <MemoizedChatDrawerProvider>
          <ChatBotView />
        </MemoizedChatDrawerProvider>
      </MemoizedChatConversationProvider>
    </MemoizedChatBotProvider>
  );
};

export default ChatController;
