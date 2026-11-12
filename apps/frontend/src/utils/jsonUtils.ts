/**
 * Checks whether a JSON value is a non-null, non-array object.
 *
 * @param value The value to check.
 * @returns True if the value is a non-null, non-array object, false otherwise.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

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
