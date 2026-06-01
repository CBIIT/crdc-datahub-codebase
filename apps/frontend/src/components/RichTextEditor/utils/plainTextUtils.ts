/**
 * Removes the markdown subset supported by this editor and returns display text.
 */
export const removeMarkdownSyntax = (content: string): string =>
  content
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
    .replace(/_(.+?)_/gs, "$1")
    .replace(/<u>(.+?)<\/u>/gs, "$1")
    .replace(/^[-*] /gm, "")
    .replace(/^\d+\. /gm, "")
    .replace(/\\([*_\\])/g, "$1")
    .trim();

/**
 * Gets user-visible text from either markdown content or legacy HTML content.
 */
export const getPlainText = (content: string): string => {
  if (!content.trim()) {
    return "";
  }

  return removeMarkdownSyntax(content);
};

/**
 * Gets the user-visible text length from stored rich-text content.
 */
export const getPlainTextLength = (content: string): number => getPlainText(content).length;
