/**
 * Safely parse a JSON string into an object. Optionally assert the type of the parsed object.
 *
 * @param unsafeJson The JSON string to parse.
 * @param fallback The value to return if the JSON string is invalid.
 * @returns The parsed JSON object or the fallback value if the JSON string is invalid.
 */
export const safeParse = <T = never>(unsafeJson: string, fallback: T = {} as T): T => {
  try {
    const result = JSON.parse(unsafeJson) as T;

    if (result === null || result === undefined) {
      return fallback;
    }

    return result;
  } catch (e) {
    return fallback;
  }
};
