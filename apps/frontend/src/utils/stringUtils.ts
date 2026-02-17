import { Logger } from "./logger";

/**
 * Capitalizes the first letter of a given string.
 * If the input string is empty, it returns an empty string.
 *
 * @param {string} str - The string to capitalize.
 * @returns {string} - The capitalized string or an empty string if the input is empty.
 */
export const capitalizeFirstLetter = (str: string): string =>
  str ? str[0].toUpperCase() + str.slice(1) : "";

/**
 * Capitalizes the first letter of each word in a given string.
 *
 * @see Utilizes {@link capitalizeFirstLetter} to capitalize each word.
 * @param str - The string to capitalize.
 * @returns The capitalized string.
 */
export const titleCase = (str: string): string => {
  if (typeof str !== "string") {
    return "";
  }

  return str
    .toLowerCase()
    .split(" ")
    .map((word) => capitalizeFirstLetter(word))
    .join(" ");
};

/**
 * Function to add a space between a number and a letter in a string.
 * @param input - The input string to be processed. It should be a string where a number is directly followed by a letter.
 * @returns The processed string with a space between the number and the letter. If the input string does not match the required pattern, the function will return the original string.
 */
export const addSpace = (input: string): string => {
  // Regular expression to match a pattern where a number is directly followed by a letter
  const regex = /(\d+)([a-zA-Z]+)/g;

  if (!regex.test(input)) {
    return input;
  }

  // Replace the matched pattern with the same pattern but with a space in between
  return input.replace(regex, "$1 $2");
};

/**
 * Format a phone number string to (###) ###-####
 *
 * @param phoneNumber input phone number string
 * @returns formatted phone number or original phoneNumber string if invalid
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove all non-digits from the string
  const cleanNumber = phoneNumber.replace(/\D/g, "");

  // Ensure we have exactly 10 digits for a valid US phone number
  if (cleanNumber.length !== 10) {
    // If we don't, return the original string
    return phoneNumber;
  }

  // Use a regex to insert the formatting elements
  const formatted = cleanNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1)$2-$3");

  return formatted;
};

/**
 * Filters out all characters from a string except for alphanumeric characters.
 * Can be customized to allow additional characters
 *
 * @param {string} input The input string to be filtered
 * @param {string} [extraChars=""] Additional characters to allow in the filtered string
 * @returns {string} The filtered string containing only alphanumeric characters and any
 * additional allowed characters. Returns formatted string, otherwise if no value is passed,
 * then it returns an empty string
 */
export const filterAlphaNumeric = (input: string, extraChars = ""): string => {
  // The base regex matches alphanumeric characters.
  // We add the `extraChars` by splitting it into individual characters, escaping each one, and then joining with "|".
  // This ensures characters with special meaning in regex (like ".") are treated as literal characters.
  const pattern = new RegExp(
    `[^a-zA-Z0-9${extraChars
      .split("")
      .map((char) => `\\${char}`)
      .join("|")}]`,
    "g"
  );

  // We replace characters that don't match the allowed set with an empty string.
  return input?.replace(pattern, "") || "";
};

/**
 * Filters a string to allow only positive integers.
 *
 * @param {string} input The input string to be filtered
 * @returns {string} A string containing only positive integers, otherwise an empty string
 */
export const filterPositiveIntegerString = (input: string): string => {
  if (!input) {
    return "";
  }

  const nonIntegerPattern = /[^0-9]/g;
  const filtered = input.replace(nonIntegerPattern, "");

  // Remove leading zeros using a regular expression
  const noLeadingZeros = filtered.replace(/^0+/, "");

  return noLeadingZeros || "";
};

/**
 * Compares two string values for sorting in an array. Non-empty strings are sorted
 * alphabetically, and `null` or empty strings are placed at the beginning.
 *
 * @param {string | null} a - The first string to compare.
 * @param {string | null} b - The second string to compare.
 * @returns {number} - A negative number if `a` should come before `b`, a positive number
 * if `a` should come after `b`, or zero if they are considered equal for sorting purposes.
 */
export const compareStrings = (a: string | null, b: string | null): number => {
  if (a === b) return 0;
  if (!a || a === "") return -1;
  if (!b || b === "") return 1;

  return a.localeCompare(b);
};

/**
 * Moves the specified key element to the front of the array.
 * If the key element does not exist in the array, the original array is returned.
 *
 * @param {string[]} array - The array of strings to be reordered.
 * @param {string} keyElement - The key element to move to the front of the array.
 * @returns {string[]} A new array with the key element moved to the front if present.
 */
export const moveToFrontOfArray = (array: string[], keyElement: string): string[] => {
  if (!array?.length) {
    return [];
  }
  if (!keyElement?.length) {
    return array;
  }

  const index = array.indexOf(keyElement);

  // Return original array if keyElement is not found or already at the first position
  if (index <= 0) {
    return array;
  }

  const newArray = [...array];
  newArray.splice(index, 1);
  newArray.unshift(keyElement);

  return newArray;
};

/**
 * Rearranges the order of specified keys in an array and appends the remaining keys to the end.
 *
 * @param {string[]} keysArray - The array of keys to be processed.
 * @param {string[]} keyOrder - An array specifying the desired order of keys.
 * @returns {string[]} A new array with keys in the specified order, followed by the remaining keys.
 */
export const rearrangeKeys = (keysArray: string[], keyOrder: string[]): string[] => {
  if (!Array.isArray(keysArray) || !Array.isArray(keyOrder)) {
    return keysArray || [];
  }

  const orderedKeys = keyOrder.filter((key) => keysArray.includes(key));
  const remainingKeys = keysArray.filter((key) => !orderedKeys.includes(key));

  return [...orderedKeys, ...remainingKeys];
};

/**
 * Checks if the length of a given string is between the specified minimum and maximum values.
 *
 * @param str - The string to check. Can be null or undefined.
 * @param minLength - The minimum allowable length of the string.
 * @param maxLength - The maximum allowable length of the string.
 * @returns True if the string's length is strictly between minLength and maxLength, exclusive; otherwise, false.
 */
export const isStringLengthBetween = (
  str: string,
  minLength: number,
  maxLength: number
): boolean => {
  if (typeof str !== "string") {
    return false;
  }

  return str?.length > minLength && str?.length < maxLength;
};

/**
 * Extracts the major and minor version numbers from a version string.
 *
 * @param {string} version - The version string to parse.
 * @returns {string} A string representing the major and minor version numbers.
 * Otherwise, an empty string.
 */
export const extractVersion = (version: string): string => {
  if (!version || typeof version !== "string") {
    Logger.error(`extractVersion: Invalid version value provided.`, version);
    return "";
  }

  const firstPeriodIndex: number = version.indexOf(".");
  if (firstPeriodIndex === -1) {
    Logger.error(
      `extractVersion: Invalid version string: "${version}". Expected at least one period to separate major and minor versions.`
    );
    return "";
  }

  const majorPart: string = version.substring(0, firstPeriodIndex);
  const remainder: string = version.substring(firstPeriodIndex + 1);

  const majorMatch: RegExpMatchArray | null = majorPart.match(/\d+/);
  if (!majorMatch) {
    Logger.error(`extractVersion: Invalid major version in string: "${version}"`);
    return "";
  }
  const major: string = majorMatch[0];

  const minorMatch: RegExpMatchArray | null = remainder.match(/^\d+/);
  if (!minorMatch) {
    Logger.error(`extractVersion: Invalid minor version in string: "${version}"`);
    return "";
  }
  const minor: string = minorMatch[0];

  return `${major}.${minor}`;
};

/**
 * A utility function to safely convert an unknown value to a string.
 *
 * Notes on handling:
 * - Objects and arrays are converted to JSON strings.
 * - Dates are converted to ISO strings.
 * - Other types are converted using their `toString` method if available.
 * - `null` and `undefined` are converted to empty strings.
 *
 * @note This handles a wider range of types than `lodash.toString`
 * @param value The unknown value to coerce
 * @returns The coerced string or empty if unhandled type
 */
export const coerceToString = (value: unknown): string => {
  // Handle null or undefined values
  if (value === undefined || value === null) {
    return "";
  }

  // Short-circuit for strings
  if (typeof value === "string") {
    return value;
  }

  // Handle valid date objects
  if (value instanceof Date && isFinite(+value)) {
    return value.toISOString();
  }

  // Handle arrays or objects by converting to JSON
  if (typeof value === "object" && !(value instanceof Date)) {
    return JSON.stringify(value);
  }

  // Handle other native types with toString method
  if (
    ["boolean", "number", "bigint"].includes(typeof value) &&
    typeof value?.toString === "function"
  ) {
    return value.toString();
  }

  Logger.error(`coerceToString: Unhandled type received '${typeof value}'`);
  return "";
};
