import { clamp } from "lodash";
import { v4 } from "uuid";

import chatConfig from "../chatConfig";

/**
 * Gets the current viewport height, or returns a fallback value if window is unavailable.
 *
 * @param fallback - Default height if window is unavailable
 * @return Current viewport height in pixels
 */
export const getViewportHeightPx = (fallback: number): number => {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.innerHeight;
};

/**
 * Calculates the next drawer height based on mouse position, clamped to min/max bounds.
 *
 * @param args - Drawer element and mouse Y position
 * @return Clamped drawer height and current viewport height
 */
export const computeNextHeightPx = (args: {
  drawerElement: HTMLDivElement;
  clientY: number;
}): { heightPx: number; viewportHeightPx: number } => {
  const rect = args.drawerElement.getBoundingClientRect();
  const rawHeightPx = rect.bottom - args.clientY;

  const viewportHeightPx = getViewportHeightPx(chatConfig.height.collapsed);
  const heightPx = clamp(rawHeightPx, chatConfig.height.min, viewportHeightPx);

  return { heightPx, viewportHeightPx };
};

/**
 * Determines if an error is an AbortError.
 *
 * @param error - Error object to check
 * @return True if error is an AbortError
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
 * @param prefix - ID prefix
 * @return Unique ID with prefix and UUID
 */
export const createId = (prefix: string): string => `${prefix}${v4()}`;

/**
 * Creates a chat message object with provided content and metadata.
 *
 * @param args - Message text, sender, name, optional variant, and optional custom id
 * @return New chat message object
 */
export const createChatMessage = (args: {
  text: string;
  sender: ChatSender;
  senderName: string;
  variant?: ChatMessageVariant;
  id?: string;
}): ChatMessage => ({
  id: args.id ?? createId("chat_msg_"),
  timestamp: new Date(),
  variant: args.variant ?? "default",
  text: args.text,
  sender: args.sender,
  senderName: args.senderName,
});
