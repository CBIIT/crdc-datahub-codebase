import { Factory } from "../Factory";

/**
 * Base chat message object
 */
export const baseChatMessage: ChatMessage = {
  id: "",
  text: "",
  sender: "user",
  timestamp: new Date(),
  senderName: "",
  variant: "default",
};

/**
 * Chat message factory for creating chat message instances
 */
export const chatMessageFactory = new Factory<ChatMessage>((overrides) => ({
  ...baseChatMessage,
  ...overrides,
}));
