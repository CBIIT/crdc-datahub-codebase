import env from "@/env";
import { Logger } from "@/utils";

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

const SESSION_STORAGE_KEY = "chatbot_session_id";

/**
 * Retrieves the stored session ID from session storage.
 */
export const getStoredSessionId = (): string | null => {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Stores the session ID in session storage.
 */
export const storeSessionId = (sessionId: string): void => {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    Logger.error("Failed to store session ID in session storage");
  }
};

/**
 * Clears the stored session ID from session storage.
 */
export const clearStoredSessionId = (): void => {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    Logger.error("Failed to clear session ID from session storage");
  }
};

const knowledgeBaseUrl =
  env.VITE_KNOWLEDGE_BASE_URL ||
  "https://qimghguigfq2bmnfqqqyze6cva0yscgr.lambda-url.us-east-1.on.aws/";

type AskQuestionArgs = {
  question: string;
  sessionId?: string | null;
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
};

export async function askQuestion({
  question,
  sessionId = null,
  onChunk,
  signal,
}: AskQuestionArgs): Promise<string | null> {
  const functionUrl = knowledgeBaseUrl;

  try {
    const response = await fetch(functionUrl, {
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
            if (parsed.output?.text && onChunk) {
              onChunk(parsed.output.text);
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
