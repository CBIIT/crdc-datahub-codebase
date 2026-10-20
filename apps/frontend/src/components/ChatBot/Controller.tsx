import { FC, ReactNode, memo } from "react";

import { FloatingWindowProvider } from "@/components/FloatingWindow";
import env from "@/env";

import ChatBotView from "./ChatBotView";
import chatConfig from "./config/chatConfig";
import { ChatBotProvider } from "./context/ChatBotContext";
import {
  ChatConversationProvider,
  useChatConversationContext,
} from "./context/ChatConversationContext";

const MemoizedChatBotProvider = memo(ChatBotProvider);
const MemoizedChatConversationProvider = memo(ChatConversationProvider);

/**
 * Provides the floating window state, ending the conversation when the window closes.
 */
const ChatWindowProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { endConversation } = useChatConversationContext();

  return (
    <FloatingWindowProvider config={chatConfig} confirmBeforeClose onClose={endConversation}>
      {children}
    </FloatingWindowProvider>
  );
};

const MemoizedChatWindowProvider = memo(ChatWindowProvider);

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

  return (
    <MemoizedChatBotProvider label={label} knowledgeBaseUrl={VITE_CHATBOT_API_BASE_URL}>
      <MemoizedChatConversationProvider>
        <MemoizedChatWindowProvider>
          <ChatBotView />
        </MemoizedChatWindowProvider>
      </MemoizedChatConversationProvider>
    </MemoizedChatBotProvider>
  );
};

export default ChatController;
