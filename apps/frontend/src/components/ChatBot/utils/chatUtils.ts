import { v4 } from "uuid";

/**
 * Determines if an error is an AbortError.
 *
 * @param {unknown} error - Error object to check
 * @return {boolean} True if error is an AbortError
 */
export const isAbortError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === "AbortError";
};

/**
 * Generates a unique identifier with the given prefix.
 *
 * @param {string} prefix - ID prefix
 * @return {string} Unique ID with prefix and UUID
 */
export const createId = (prefix: string): string => `${prefix}${v4()}`;

/**
 * Creates a chat message object with provided content and metadata.
 *
 * @param {{ text: string; sender: ChatSender; senderName: string; variant?: ChatMessageVariant; id?: string; citations?: ChatCitation[] }} args - Message text, sender, name, optional variant, optional custom id, and optional citations
 * @return {ChatMessage} New chat message object
 */
export const createChatMessage = (args: {
  text: string;
  sender: ChatSender;
  senderName: string;
  variant?: ChatMessageVariant;
  id?: string;
  citations?: ChatCitation[];
}): ChatMessage => ({
  id: args.id ?? createId("chat_msg_"),
  timestamp: new Date(),
  variant: args.variant ?? "default",
  text: args.text,
  sender: args.sender,
  senderName: args.senderName,
  citations: args.citations,
});
