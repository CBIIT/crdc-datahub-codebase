/**
 * Configuration settings for the ChatBot component.
 */
const chatConfig = {
  /**
   * The name of the support bot.
   */
  supportBotName: "Support Bot",
  /**
   * The display name of the user.
   */
  userDisplayName: "You",
  /**
   * The initial message sent by the support bot when the chat starts a new conversation.
   */
  initialMessage: "Hi there! 👋 How can I help you today?",
  /**
   * The height configuration for the chat drawer.
   */
  height: {
    /**
     * The height of the chat drawer when it is collapsed.
     */
    collapsed: 475,
    /**
     * The minimum height of the chat drawer.
     */
    min: 475,
    /**
     * The threshold in pixels at which the chat drawer will snap to its expanded height.
     */
    expandedSnapThreshold: 8,
  },
};

export default chatConfig;
