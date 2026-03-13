/**
 * Configuration settings for the ChatBot component.
 */
const chatConfig = {
  /**
   * The name of the support bot.
   * NOTE: Not visually displayed, but used for message metadata.
   */
  supportBotName: "CRDC Support",
  /**
   * The display name of the user.
   * NOTE: Not visually displayed, but used for message metadata.
   */
  userDisplayName: "You",
  /**
   * The initial message sent by the support bot when the chat starts a new conversation.
   */
  initialMessage: "How can I help you?",
  /**
   * The maximum number of messages to include in conversation history.
   */
  maxConversationHistoryLength: 100,
  /**
   * The maximum character length for user input text.
   */
  maxInputTextLength: 5000,
  /**
   * The height configuration for the chat drawer.
   */
  height: {
    /**
     * The height of the chat drawer when it is collapsed.
     */
    collapsed: 368,
    /**
     * The minimum height of the chat drawer.
     */
    min: 368,
  },
  /**
   * The width configuration for the chat drawer.
   */
  width: {
    /**
     * The default width of the chat drawer.
     */
    default: 400,
    /**
     * The minimum width of the chat drawer.
     */
    min: 400,
    /**
     * The width of the chat drawer when expanded.
     */
    expanded: 417,
  },
};

export default chatConfig;
