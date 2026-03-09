import { describe, expect, it } from "vitest";
import { formatUserPrompt } from "./conversation.ts";

describe("formatUserPrompt", () => {
  it("formats search results and question with tags", () => {
    const question = "What is CRDC?";
    const searchResults = "Result A\nResult B";

    const result = formatUserPrompt(question, searchResults);

    expect(result).toBe(
      "Search Results: <search_results>\n" +
        "Result A\nResult B\n" +
        "</search_results>\n\n" +
        "User Question: <question>\n" +
        "What is CRDC?\n" +
        "</question>"
    );
  });

  it("preserves empty search results", () => {
    const result = formatUserPrompt("Q", "");
    expect(result).toBe(
      "Search Results: <search_results>\n\n</search_results>\n\nUser Question: <question>\nQ\n</question>"
    );
  });
});
