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
};

type AskKnowledgeBaseArgs = {
  question: string;
  sessionId: string;
  signal?: AbortSignal;
  url?: string;
};

export const askKnowledgeBase = async ({
  question,
  sessionId,
  signal,
  url = env.VITE_KNOWLEDGE_BASE_URL,
}: AskKnowledgeBaseArgs): Promise<AskKnowledgeBaseResponse> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  return data;
};
