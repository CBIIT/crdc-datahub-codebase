type ChatSender = "user" | "bot";

type ChatStatus = "idle" | "bot_typing";

type ChatMessageVariant = "default" | "error" | "info";

type ChatMessage = {
  id: string;
  text: string;
  sender: ChatSender;
  timestamp: Date;
  senderName: string;
  variant?: ChatMessageVariant;
};
