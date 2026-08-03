export type UrlCandidate = {
  rawText: string;
  url: string;
  startIndex: number;
  endIndex: number;
};

const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:"]);
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const TOP_LEVEL_DOMAIN_PATTERN = /^[a-z]{2,63}$/i;
const EDGE_OPENING_CHARACTERS = new Set(["(", "[", "{", "<", '"', "'"]);
const EDGE_CLOSING_CHARACTERS = new Set([")", "]", "}", ">", '"', "'"]);
const TRAILING_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?"]);

const isWhitespace = (character: string): boolean => /\s/.test(character);

const tryCreateUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const hasAllowedProtocol = (url: URL): boolean => ALLOWED_URL_PROTOCOLS.has(url.protocol);

const isValidWebHostname = (hostname: string): boolean => {
  const labels = hostname.split(".");
  const topLevelDomain = labels[labels.length - 1];

  if (labels.length < 2 || !TOP_LEVEL_DOMAIN_PATTERN.test(topLevelDomain)) {
    return false;
  }

  return labels.every((label) => HOST_LABEL_PATTERN.test(label));
};

const isLikelyBareWebUrl = (value: string): boolean => {
  const normalizedValue = `https://${value}`;
  const parsedUrl = tryCreateUrl(normalizedValue);

  if (!parsedUrl) {
    return false;
  }

  return isValidWebHostname(parsedUrl.hostname);
};

const removeWrappingAngleBrackets = (value: string): string => {
  const hasWrappingAngleBrackets = value.startsWith("<") && value.endsWith(">");

  if (!hasWrappingAngleBrackets) {
    return value;
  }

  return value.slice(1, -1);
};

/**
 * Converts a user-entered URL-ish value into a canonical URL that can be stored on a link node.
 */
export const normalizeUrl = (value: string): string | null => {
  const trimmedValue = removeWrappingAngleBrackets(value.trim());

  if (!trimmedValue || /\s/.test(trimmedValue)) {
    return null;
  }

  const valueWithProtocol = (() => {
    if (trimmedValue.startsWith("//")) {
      return `https:${trimmedValue}`;
    }

    if (URL_SCHEME_PATTERN.test(trimmedValue)) {
      return trimmedValue;
    }

    if (trimmedValue.startsWith("www.") || isLikelyBareWebUrl(trimmedValue)) {
      return `https://${trimmedValue}`;
    }

    return trimmedValue;
  })();

  const parsedUrl = tryCreateUrl(valueWithProtocol);

  if (!parsedUrl || !hasAllowedProtocol(parsedUrl)) {
    return null;
  }

  if (parsedUrl.username || parsedUrl.password) {
    return null;
  }

  if (!isValidWebHostname(parsedUrl.hostname)) {
    return null;
  }

  return parsedUrl.href;
};

export const isValidUrl = (value: string): boolean => Boolean(normalizeUrl(value));

const trimCandidateEdges = (
  rawText: string,
  startIndex: number,
  endIndex: number
): { text: string; startIndex: number; endIndex: number } => {
  let nextText = rawText;
  let nextStartIndex = startIndex;
  let nextEndIndex = endIndex;

  while (nextText && EDGE_OPENING_CHARACTERS.has(nextText[0])) {
    nextText = nextText.slice(1);
    nextStartIndex += 1;
  }

  while (nextText && EDGE_CLOSING_CHARACTERS.has(nextText[nextText.length - 1])) {
    nextText = nextText.slice(0, -1);
    nextEndIndex -= 1;
  }

  while (nextText && TRAILING_PUNCTUATION.has(nextText[nextText.length - 1])) {
    nextText = nextText.slice(0, -1);
    nextEndIndex -= 1;
  }

  return {
    text: nextText,
    startIndex: nextStartIndex,
    endIndex: nextEndIndex,
  };
};

const createUrlCandidate = (
  rawText: string,
  startIndex: number,
  endIndex: number
): UrlCandidate | null => {
  const trimmedCandidate = trimCandidateEdges(rawText, startIndex, endIndex);
  const normalizedUrl = normalizeUrl(trimmedCandidate.text);

  if (!normalizedUrl) {
    return null;
  }

  return {
    rawText: trimmedCandidate.text,
    url: normalizedUrl,
    startIndex: trimmedCandidate.startIndex,
    endIndex: trimmedCandidate.endIndex,
  };
};

/**
 * Finds URL-like tokens in plain text without scanning editor nodes or relying on a large URL regex.
 */
export const findUrlCandidates = (text: string): UrlCandidate[] => {
  const candidates: UrlCandidate[] = [];
  let tokenStartIndex: number | null = null;

  Array.from(text).forEach((character, index) => {
    const isTokenBoundary = isWhitespace(character);

    if (isTokenBoundary && tokenStartIndex !== null) {
      const rawText = text.slice(tokenStartIndex, index);
      const candidate = createUrlCandidate(rawText, tokenStartIndex, index);

      if (candidate) {
        candidates.push(candidate);
      }

      tokenStartIndex = null;
      return;
    }

    if (!isTokenBoundary && tokenStartIndex === null) {
      tokenStartIndex = index;
    }
  });

  if (tokenStartIndex !== null) {
    const rawText = text.slice(tokenStartIndex);
    const candidate = createUrlCandidate(rawText, tokenStartIndex, text.length);

    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates;
};

/**
 * Finds a URL-like token that ends exactly at the end of the given string.
 */
export const findUrlCandidateAtTextEnd = (text: string): UrlCandidate | null => {
  const [lastCandidate] = findUrlCandidates(text).slice(-1);

  if (!lastCandidate || lastCandidate.endIndex !== text.length) {
    return null;
  }

  return lastCandidate;
};
