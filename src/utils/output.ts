import type { APIEvent } from "../schemas/api.ts";

/**
 * A utility function to generate an API event of type "pulse".
 *
 * @param description The description of the event.
 * @returns An APIEvent object with the specified description.
 */
export const GenerateEvent = (description: string): APIEvent => {
  return {
    type: "pulse",
    description,
  };
};
