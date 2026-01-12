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
  /**
   * The title appearing within the chat.
   */
  title?: string;
};

/**
 * Controls the visibility of the ChatBot component and manages its providers.
 */
const ChatController: FC<Props> = ({ label = "Chat", title = "Chat" }) => {
  const chatbotEnabled = (env.VITE_CHATBOT_ENABLED || "true")?.toLowerCase() === "true";
  const knowledgeBaseUrl =
    env.VITE_KNOWLEDGE_BASE_URL ||
    "https://qimghguigfq2bmnfqqqyze6cva0yscgr.lambda-url.us-east-1.on.aws/";

  if (!chatbotEnabled) {
    return null;
  }

  return (
    <MemoizedChatBotProvider title={title} label={label} knowledgeBaseUrl={knowledgeBaseUrl}>
      <MemoizedChatConversationProvider>
        <MemoizedChatDrawerProvider>
          <ChatBotView />
        </MemoizedChatDrawerProvider>
      </MemoizedChatConversationProvider>
    </MemoizedChatBotProvider>
  );
};

export default ChatController;
