import { Logger } from "@/utils";

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
  onChunk?: (chunk: string) => void;
  onCitation?: (citation: ChatCitation) => void;
  signal?: AbortSignal;
  url: string;
  typewriterDelay?: number;
};

type AskQuestionResult = {
  sessionId: string | null;
  citations: ChatCitation[];
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
 * @returns {Promise<{ sessionId: string | null; citations: ChatCitation[] }>} The session ID and collected citations from the response
 */
export async function processStreamingResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk?: (chunk: string) => void,
  onCitation?: (citation: ChatCitation) => void,
  typewriterDelay = 10,
  signal?: AbortSignal
): Promise<{ sessionId: string | null; citations: ChatCitation[] }> {
  const decoder = new TextDecoder();
  let buffer = "";
  let currentSessionId: string | null = null;
  const citations: ChatCitation[] = [];
  const seenCitationUrls = new Set<string>();
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
          // eslint-disable-next-line no-continue
          continue;
        }

        const outputText = typeof parsed.output === "string" ? parsed.output : parsed.output?.text;

        if (outputText) {
          // eslint-disable-next-line no-await-in-loop
          await emitWithTypewriter(outputText, onChunk, typewriterDelay, signal);
        }

        const citationHasContent = !!parsed.citation && !!parsed.citation.url;
        const citationIsNotDuplicate = !seenCitationUrls.has(parsed.citation.url);

        if (citationHasContent && citationIsNotDuplicate) {
          seenCitationUrls.add(parsed.citation.url);
          citations.push(parsed.citation);
          onCitation?.(parsed.citation);
        }

        if (parsed.error) {
          Logger.error("Error:", parsed.error);
        }
      } catch (e) {
        Logger.error("Failed to parse line:", line, e);
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
  onChunk,
  onCitation,
  signal,
  url,
  typewriterDelay = 10,
}: AskQuestionArgs): Promise<AskQuestionResult> {
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
    const { sessionId: currentSessionId, citations } = await processStreamingResponse(
      reader,
      onChunk,
      onCitation,
      typewriterDelay,
      signal
    );

    if (currentSessionId) {
      storeSessionId(currentSessionId);
    }

    if (citations.length > 0) {
      Logger.info("All citations collected:", citations);
    }

    return { sessionId: currentSessionId, citations };
  } catch (error) {
    Logger.error("Error:", error);
    throw error;
  }
}
