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

/**
 * Processes a single line from the streaming response.
 *
 * @param {string} line - The JSON line to process
 * @param {boolean} isFirstChunk - Whether this is the first chunk being processed
 * @param {(chunk: string) => void} [onChunk] - Optional callback to invoke with output text
 * @returns {string | undefined} The session ID if found on first chunk, otherwise undefined
 */
export function processLine(
  line: string,
  isFirstChunk: boolean,
  onChunk?: (chunk: string) => void
): string | undefined {
  try {
    const parsed = JSON.parse(line);

    if (isFirstChunk && parsed.sessionId !== undefined) {
      return parsed.sessionId;
    }

    const outputText = typeof parsed.output === "string" ? parsed.output : parsed.output?.text;

    if (outputText && onChunk) {
      onChunk(outputText);
    }

    if (parsed.citation && Object.keys(parsed.citation).length > 0) {
      Logger.info("Citations:", parsed.citation);
    }

    if (parsed.error) {
      Logger.error("Error:", parsed.error);
    }

    return undefined;
  } catch (e) {
    Logger.error("Failed to parse line:", line, e);
    return undefined;
  }
}

/**
 * Processes the streaming response from the knowledge base API.
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader - The stream reader for the response body
 * @param {(chunk: string) => void} [onChunk] - Optional callback to invoke with each text chunk
 * @returns {Promise<string | null>} The session ID from the response, or null if not found
 */
export async function processStreamingResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk?: (chunk: string) => void
): Promise<string | null> {
  const decoder = new TextDecoder();
  let buffer = "";
  let currentSessionId: string | null = null;
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
      const sessionId = processLine(line, isFirstChunk, onChunk);

      if (sessionId) {
        currentSessionId = sessionId;
        isFirstChunk = false;
      }
    }
  }

  return currentSessionId;
}

/**
 * Sends a question to the knowledge base API and streams the response.
 *
 * @param {AskQuestionArgs} args - The question arguments
 * @param {string} args.question - The question text to send
 * @param {string | null} [args.sessionId] - Optional session ID to continue a conversation
 * @param {(chunk: string) => void} [args.onChunk] - Optional callback invoked with each text chunk as it arrives
 * @param {AbortSignal} [args.signal] - Optional abort signal to cancel the request
 * @param {string} args.url - The knowledge base API endpoint URL
 * @returns {Promise<string | null>} The session ID from the response, or null if not found
 * @throws {Error} If the URL is not provided or the HTTP request fails
 */
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
    const currentSessionId = await processStreamingResponse(reader, onChunk);

    if (currentSessionId) {
      storeSessionId(currentSessionId);
    }

    return currentSessionId;
  } catch (error) {
    Logger.error("Error:", error);
    throw error;
  }
}
