import { z } from "zod";

export type TrailingUrlMatch = {
  index: number;
  length: number;
  url: string;
};

/**
 * Schema for validating link URLs. Accepts bare domains ("google.com") and full
 * http/https URLs, rejects all other schemes, and resolves bare domains to https.
 */
export const LINK_URL_SCHEMA = z
  .string()
  .refine((value) => !value.includes(":") || /^https?:\/\//i.test(value))
  .transform((value) => {
    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    return `https://${value}`;
  })
  .pipe(z.url({ protocol: /^https?$/, hostname: z.regexes.domain }));

/**
 * Parses a user-entered value into a link URL.
 *
 * @param {string} candidate - The raw value to parse.
 * @returns {string | null} The URL, or null when the value is not a valid link URL.
 *
 * @example
 * readUrl("google.com"); // "https://google.com"
 * readUrl("javascript:alert(1)"); // null
 */
export const readUrl = (candidate: string): string | null => {
  const result = LINK_URL_SCHEMA.safeParse(candidate);

  if (!result.success) {
    return null;
  }

  return result.data;
};

/**
 * Finds a link URL at the end of a line of text.
 *
 * @param {string} text - The line text to search.
 * @returns {TrailingUrlMatch | null} The match position and canonical URL, or null.
 *
 * @example
 * findTrailingUrl("visit google.com"); // { index: 6, length: 10, url: "https://google.com" }
 * findTrailingUrl("google.com was down"); // null
 */
export const findTrailingUrl = (text: string): TrailingUrlMatch | null => {
  const words = text.split(/\s/);
  const lastWord = words[words.length - 1];

  if (!lastWord) {
    return null;
  }

  const url = readUrl(lastWord);

  if (!url) {
    return null;
  }

  return {
    index: text.length - lastWord.length,
    length: lastWord.length,
    url,
  };
};
