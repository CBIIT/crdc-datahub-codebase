import type {
  APICitationEvent,
  APIErrorEvent,
  APIPulseEvent,
  APIResponseEvent,
  APISessionEvent,
  Citation,
} from "../schemas/api.ts";

/**
 * A utility function to generate an API event of type "pulse".
 *
 * @param description The description of the event.
 * @returns An APIEvent object with the specified description.
 */
export const generatePulseEvent = (description: string): APIPulseEvent => ({
  type: "pulse",
  description,
});

/**
 * A utility function to generate an API event of type "citations".
 *
 * @param citations An array of Citation objects to include in the event.
 * @returns An APIEvent object with the specified citations.
 */
export const generateCitationEvent = (citations: Citation[]): APICitationEvent => ({
  type: "citations",
  citations,
});

/**
 * A utility function to generate an API event of type "session".
 *
 * @param sessionId The session ID to include in the event.
 * @returns An APIEvent object with the specified session ID.
 */
export const generateSessionEvent = (sessionId: string): APISessionEvent => ({
  type: "session",
  sessionId,
});

/**
 * A utility function to generate an API event of type "response".
 *
 * @param output The output text to include in the event.
 * @returns An APIEvent object with the specified output.
 */
export const generateResponseEvent = (output: string): APIResponseEvent => ({
  type: "response",
  output,
});

/**
 * A utility function to generate an API event of type "error".
 *
 * @param message The error message to include in the event.
 * @returns An APIEvent object with the specified error message.
 */
export const generateErrorEvent = (message: string): APIErrorEvent => ({
  type: "error",
  message,
});
