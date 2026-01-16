/**
 * A utility to format the user prompt with search results.
 *
 * @param question The user's prompt or question.
 * @param searchResults The aggregated search results from the knowledge base.
 * @returns A formatted string combining search results and the user's question.
 */
export const formatUserPrompt = (question: string, searchResults: string) =>
  `Search Results: <search_results>\n${searchResults}\n</search_results>\n\nUser Question: <question>\n${question}\n</question>`;
