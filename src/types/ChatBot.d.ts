type ChatSender = "user" | "bot";

type ChatStatus = "idle" | "bot_typing";

type ChatMessageVariant = "default" | "error" | "info";

type ChatCitation = {
  /**
   * The title of the cited document or source.
   */
  documentName: string;
  /**
   * A link to the cited document or source.
   */
  documentLink: string | null;
};

type ChatMessage = {
  id: string;
  text: string;
  sender: ChatSender;
  timestamp: Date;
  senderName: string;
  variant?: ChatMessageVariant;
  citations?: ChatCitation[];
};

type ConversationHistory = {
  /**
   * The role of the message sender.
   */
  role: "user" | "assistant";
  /**
   * The content of the message.
   */
  content: string;
};
