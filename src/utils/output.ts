import type { APICitationEvent, APIPulseEvent, Citation } from "../schemas/api.ts";

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
