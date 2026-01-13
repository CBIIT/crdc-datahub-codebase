/**
 * A safe JSON parse function that returns null if parsing fails.
 *
 * @param jsonString - The JSON string to parse.
 * @returns The parsed object or null if parsing fails.
 */
export const safeParseJSON = <T,>(jsonString: string): T | null => {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
};
