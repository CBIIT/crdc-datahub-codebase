import { Logger } from "@/utils";

const SESSION_STORAGE_KEY = "chatbot_session_id";

/**
 * Retrieves the stored session ID from session storage.
 *
 * @returns {string | null} The stored session ID, or null if not found.
 */
export const getStoredSessionId = (): string | null => {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    Logger.error("Failed to retrieve session ID from session storage");
    return null;
  }
};

/**
 * Stores the session ID in session storage.
 *
 * @param {string} sessionId - The session ID to store.
 * @returns {void}
 */
export const storeSessionId = (sessionId: string): void => {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    Logger.error("Failed to store session ID in session storage");
  }
};

/**
 * Clears the stored session ID from session storage.
 *
 * @returns {void}
 */
export const clearStoredSessionId = (): void => {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    Logger.error("Failed to clear session ID from session storage");
  }
};
