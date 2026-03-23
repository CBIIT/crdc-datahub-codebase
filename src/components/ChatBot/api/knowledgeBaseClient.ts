import { Logger } from "@/utils";

import chatConfig from "../config/chatConfig";
import { storeSessionId } from "../utils/sessionStorageUtils";

export type AskKnowledgeBaseResponse = {
  question: string;
  answer: string;
  citations?: ChatCitation[];
  sessionId?: string;
};

type AskQuestionArgs = {
  question: string;
  sessionId?: string | null;
  conversationHistory?: ConversationHistory[];
  onChunk?: (chunk: string) => void;
  onCitation?: (citation: ChatCitation) => void;
  onPulse?: (description: string) => void;
  signal?: AbortSignal;
  url: string;
  typewriterDelay?: number;
};

type AskQuestionResult = {
  sessionId: string | null;
  citations: ChatCitation[];
};

/**
 * Emits text with a typewriter effect (character by character) using a configurable delay.
 *
 * @param {string} text - The text to emit character by character
 * @param {(chunk: string) => void} [onChunk] - Optional callback to invoke with each character
 * @param {number} [typewriterDelay=10] - Delay in milliseconds between characters (0 to disable typewriter effect)
 * @param {AbortSignal} [signal] - Optional abort signal to stop the typewriter effect
 * @returns {Promise<void>}
 */
export async function emitWithTypewriter(
  text: string,
  onChunk?: (chunk: string) => void,
  typewriterDelay = 10,
  signal?: AbortSignal
): Promise<void> {
  if (!onChunk || !text) {
    return;
  }

  // If typewriter delay is 0, emit the whole text at once
  if (typewriterDelay === 0) {
    onChunk(text);
    return;
  }

  for (let i = 0; i < text.length; i += 1) {
    if (signal?.aborted) {
      return;
    }
    onChunk(text[i]);
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      setTimeout(resolve, typewriterDelay);
    });
  }
}

/**
 * Processes the streaming response from the knowledge base API with typewriter effect.
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader - The stream reader for the response body
 * @param {(chunk: string) => void} [onChunk] - Optional callback to invoke with each text chunk
 * @param {(citation: ChatCitation) => void} [onCitation] - Optional callback to invoke with each citation
 * @param {number} [typewriterDelay=10] - Delay in milliseconds between characters (0 to disable typewriter effect)
 * @param {AbortSignal} [signal] - Optional abort signal to stop the typewriter effect
 * @param {(description: string) => void} [onPulse] - Optional callback to invoke with pulse status descriptions
 * @returns {Promise<{ sessionId: string | null; citations: ChatCitation[] }>} The session ID and collected citations from the response
 */
export async function processStreamingResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk?: (chunk: string) => void,
  onCitation?: (citation: ChatCitation) => void,
  typewriterDelay = 10,
  signal?: AbortSignal,
  onPulse?: (description: string) => void
): Promise<{ sessionId: string | null; citations: ChatCitation[] }> {
  const decoder = new TextDecoder();
  let buffer = "";
  let currentSessionId: string | null = null;
  const citations: ChatCitation[] = [];
  const seenCitationLinks = new Set<string>();
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
      if (typeof line !== "string" || !line?.trim()) {
        Logger.error("[KnowledgeBase] Received non-string or empty line:", line);
        // eslint-disable-next-line no-continue
        continue;
      }

      try {
        const parsed = JSON.parse(line);

        switch (parsed.type) {
          case "session":
            if (currentSessionId === null && parsed.sessionId) {
              Logger.info("[KnowledgeBase] Received session ID:", parsed.sessionId);
              currentSessionId = parsed.sessionId;
            }
            break;

          case "response":
            if (parsed.output) {
              // eslint-disable-next-line no-await-in-loop
              await emitWithTypewriter(parsed.output, onChunk, typewriterDelay, signal);
            }
            break;

          case "citations":
            if (!Array.isArray(parsed.citations)) {
              break;
            }

            for (const citation of parsed.citations) {
              const link = citation.documentLink ?? "";
              if (link && seenCitationLinks.has(link)) {
                // eslint-disable-next-line no-continue
                continue;
              }
              if (link) {
                seenCitationLinks.add(link);
              }

              citations.push(citation);
              onCitation?.(citation);
            }
            break;

          case "pulse":
            if (parsed.description) {
              Logger.info("[KnowledgeBase] Pulse:", parsed.description);
              onPulse?.(parsed.description);
            }
            break;

          case "error":
            throw new Error(parsed.message || "An error occurred while processing your request");

          default:
            Logger.info("[KnowledgeBase] Unknown event type:", parsed?.type, parsed);
            break;
        }

        if (parsed.error) {
          Logger.error("[KnowledgeBase] Stream error:", parsed.error);
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          Logger.error("[KnowledgeBase] Failed to parse line:", line, e);
        } else {
          throw e;
        }
      }
    }
  }

  return { sessionId: currentSessionId, citations };
}

/**
 * Sends a question to the knowledge base API and streams the response.
 *
 * @param {AskQuestionArgs} args - The question arguments
 * @param {string} args.question - The question text to send
 * @param {string | null} [args.sessionId] - Optional session ID to continue a conversation
 * @param {(chunk: string) => void} [args.onChunk] - Optional callback invoked with each text chunk as it arrives
 * @param {(citation: ChatCitation) => void} [args.onCitation] - Optional callback invoked with each citation as it arrives
 * @param {AbortSignal} [args.signal] - Optional abort signal to cancel the request
 * @param {string} args.url - The knowledge base API endpoint URL
 * @param {number} [args.typewriterDelay=10] - Delay in milliseconds between characters (0 to disable typewriter effect)
 * @returns {Promise<AskQuestionResult>} The session ID and citations from the response
 * @throws {Error} If the URL is not provided or the HTTP request fails
 */
export async function askQuestion({
  question,
  sessionId = null,
  conversationHistory = [],
  onChunk,
  onCitation,
  onPulse,
  signal,
  url,
  typewriterDelay = 10,
}: AskQuestionArgs): Promise<AskQuestionResult> {
  if (!url) {
    throw new Error("Knowledge base URL is required but was not provided");
  }

  try {
    const truncatedQuestion = question.slice(0, chatConfig.maxInputTextLength);
    const truncatedHistory = conversationHistory.slice(-chatConfig.maxConversationHistoryLength);
    const askQuestionURL = `${url}/question`;

    const response = await fetch(askQuestionURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: truncatedQuestion,
        sessionId,
        conversationHistory: truncatedHistory,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const { sessionId: currentSessionId, citations } = await processStreamingResponse(
      reader,
      onChunk,
      onCitation,
      typewriterDelay,
      signal,
      onPulse
    );

    if (currentSessionId) {
      storeSessionId(currentSessionId);
    }

    if (citations.length > 0) {
      Logger.info("[KnowledgeBase] Citations:", citations);
    }

    return { sessionId: currentSessionId, citations };
  } catch (error) {
    Logger.error("[KnowledgeBase]", error);
    throw error;
  }
}
