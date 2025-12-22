import { FC } from "react";

import env from "@/env";

import ChatBot, { Props } from "./ChatBotView";

/**
 * Controls the visibility of the ChatBot component.
 */
const ChatController: FC<Props> = (props) => {
  const chatbotValue = env.VITE_CHATBOT_ENABLED || "true";
  const chatbotEnabled = chatbotValue.toLowerCase() === "true";

  if (!chatbotEnabled) {
    return null;
  }

  return <ChatBot {...props} />;
};

export default ChatController;
