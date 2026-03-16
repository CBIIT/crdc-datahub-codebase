/**
 * Configuration settings for the ChatBot component.
 */
const chatConfig = {
  /**
   * The name of the bot.
   * NOTE: Not visually displayed, but used for message metadata.
   */
  botName: "Bot",
  /**
   * The name of the user.
   * NOTE: Not visually displayed, but used for message metadata.
   */
  userName: "User",
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
  /**
   * The floating button configuration.
   */
  floatingButton: {
    /**
     * The default label displayed on the floating chat button.
     */
    label: "CRDC\nAssistant",
    /**
     * The delay in milliseconds before the floating button expands.
     */
    initialDelayMs: 3_000,
    /**
     * The duration in milliseconds the floating button stays expanded.
     */
    showDurationMs: 7_000,
    /**
     * The session storage key used to track whether the bubble has been shown.
     */
    sessionKey: "chatbot_bubble_shown",
  },
};

export default chatConfig;
