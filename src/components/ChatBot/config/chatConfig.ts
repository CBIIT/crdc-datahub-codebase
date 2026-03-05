/**
 * Configuration settings for the ChatBot component.
 */
const chatConfig = {
  /**
   * The name of the support bot.
   */
  supportBotName: "CRDC Support",
  /**
   * The display name of the user.
   */
  userDisplayName: "You",
  /**
   * The initial message sent by the support bot when the chat starts a new conversation.
   */
  initialMessage: "How can I help you?",
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
    /**
     * The threshold in pixels at which the chat drawer will snap to its expanded height.
     */
    expandedSnapThreshold: 8,
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
