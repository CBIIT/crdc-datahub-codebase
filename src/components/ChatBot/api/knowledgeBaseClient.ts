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

type AskKnowledgeBaseArgs = {
  question: string;
  sessionId?: string | null;
  signal?: AbortSignal;
  url?: string;
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

/**
 * Sends a question to the knowledge base API and retrieves the answer.
 */
export const askKnowledgeBase = async ({
  question,
  sessionId = null,
  signal,
  url = env.VITE_KNOWLEDGE_BASE_URL,
}: AskKnowledgeBaseArgs): Promise<AskKnowledgeBaseResponse> => {
  const res = await fetch(url, {
    method: "POST",
    // headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ question, sessionId }),
  });

  if (!res.ok) {
    throw new Error(`KnowledgeBase HTTP ${res.status}`);
  }

  const data = (await res.json()) as AskKnowledgeBaseResponse;

  if (!data?.answer) {
    Logger.error(
      "knowledgeBaseClient.ts: The knowledge base response is missing an 'answer'.",
      data
    );
    throw new Error("Oops! Unable to retrieve a response.");
  }

  // Store the session ID from the response for future requests
  if (data.sessionId) {
    storeSessionId(data.sessionId);
  }

  return data;
};
