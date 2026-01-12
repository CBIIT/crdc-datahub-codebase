import { Logger } from "@/utils";

import { storeSessionId } from "../utils/sessionStorageUtils";

export type KnowledgeBaseCitation = {
  title?: string;
  url?: string;
  snippet?: string;
};

export type AskKnowledgeBaseResponse = {
  question: string;
  answer: string;
  citations?: KnowledgeBaseCitation[];
  sessionId?: string;
};

type AskQuestionArgs = {
  question: string;
  sessionId?: string | null;
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
  url: string;
};

export async function askQuestion({
  question,
  sessionId = null,
  onChunk,
  signal,
  url,
}: AskQuestionArgs): Promise<string | null> {
  if (!url) {
    throw new Error("Knowledge base URL is required but was not provided");
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ question, sessionId }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentSessionId = null;
    let isFirstChunk = true;

    let done = false;
    while (!done) {
      // eslint-disable-next-line no-await-in-loop
      const result = await reader.read();
      done = result.done;

      if (done) {
        break;
      }

      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split("\n");

      buffer = lines.pop() || "";

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);

          if (isFirstChunk && parsed.sessionId !== undefined) {
            currentSessionId = parsed.sessionId;
            isFirstChunk = false;
          } else {
            const outputText =
              typeof parsed.output === "string" ? parsed.output : parsed.output?.text;

            if (outputText && onChunk) {
              onChunk(outputText);
            }

            if (parsed.citation && Object.keys(parsed.citation).length > 0) {
              Logger.info("Citations:", parsed.citation);
            }

            if (parsed.error) {
              Logger.error("Error:", parsed.error);
            }
          }
        } catch (e) {
          Logger.error("Failed to parse line:", line, e);
        }
      }
    }

    if (currentSessionId) {
      storeSessionId(currentSessionId);
    }

    return currentSessionId;
  } catch (error) {
    Logger.error("Error:", error);
    throw error;
  }
}
