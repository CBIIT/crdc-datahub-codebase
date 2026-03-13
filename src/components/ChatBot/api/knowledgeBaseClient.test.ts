import { Logger } from "@/utils";

import { getStoredSessionId, storeSessionId } from "../utils/sessionStorageUtils";

import { askQuestion, emitWithTypewriter, processStreamingResponse } from "./knowledgeBaseClient";

vi.mock("@/utils", () => ({
  Logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const TEST_API_URL = "https://test-api.example.com/";

/**
 * Helper to create a mock ReadableStream that emits line-delimited JSON chunks
 *
 * @param {string[]} chunks - Array of string chunks to emit
 * @returns {ReadableStream<Uint8Array>} ReadableStream emitting the chunks
 */
const createMockStream = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      } else {
        controller.close();
      }
    },
  });
};

/**
 * Helper to create a mock fetch response with streaming body
 *
 * @param {string[]} chunks - Array of string chunks to emit in the response body
 * @param {object} options - Additional options for the Response
 * @returns {Response} Mock Response object with streaming body
 */
const createMockResponse = (
  chunks: string[],
  options: { ok?: boolean; status?: number } = {}
): Response =>
  ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    body: createMockStream(chunks),
  }) as Response;

describe("askQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    global.fetch = vi.fn();
  });

  it("should successfully stream response chunks and return sessionId", async () => {
    const mockChunks = [
      `${JSON.stringify({ type: "session", sessionId: "test-session-123" })}\n`,
      `${JSON.stringify({ type: "response", output: "Hello " })}\n`,
      `${JSON.stringify({ type: "response", output: "world" })}\n`,
      `${JSON.stringify({ type: "response", output: "!" })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    const result = await askQuestion({
      question: "Test question",
      sessionId: null,
      onChunk,
      url: TEST_API_URL,
      typewriterDelay: 0,
    });

    expect(result.sessionId).toBe("test-session-123");
    expect(result.citations).toEqual([]);
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenNthCalledWith(1, "Hello ");
    expect(onChunk).toHaveBeenNthCalledWith(2, "world");
    expect(onChunk).toHaveBeenNthCalledWith(3, "!");
    expect(getStoredSessionId()).toBe("test-session-123");
  });

  it("should handle streaming with existing sessionId", async () => {
    storeSessionId("existing-session");

    const mockChunks = [
      `${JSON.stringify({ type: "session", sessionId: "existing-session" })}\n`,
      `${JSON.stringify({ type: "response", output: "Response" })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    await askQuestion({
      question: "Test question",
      sessionId: "existing-session",
      onChunk,
      url: TEST_API_URL,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      TEST_API_URL,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          question: "Test question",
          sessionId: "existing-session",
          conversationHistory: [],
        }),
      })
    );
  });

  it("should handle multi-line chunks correctly", async () => {
    const mockChunks = [
      `${JSON.stringify({ type: "session", sessionId: "session-1" })}\n${JSON.stringify({
        type: "response",
        output: "First",
      })}\n`,
      `${JSON.stringify({ type: "response", output: " Second" })}\n${JSON.stringify({
        type: "response",
        output: " Third",
      })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    const result = await askQuestion({
      question: "Test question",
      onChunk,
      url: TEST_API_URL,
      typewriterDelay: 0,
    });

    expect(result.sessionId).toBe("session-1");
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenNthCalledWith(1, "First");
    expect(onChunk).toHaveBeenNthCalledWith(2, " Second");
    expect(onChunk).toHaveBeenNthCalledWith(3, " Third");
  });

  it("should handle incomplete JSON lines in buffer", async () => {
    const partialJson = JSON.stringify({ type: "response", output: "Part 1" });
    const mockChunks = [
      `${JSON.stringify({ type: "session", sessionId: "session-1" })}\n${partialJson.slice(0, 20)}`,
      `${partialJson.slice(20)}\n${JSON.stringify({ type: "response", output: "Part 2" })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    await askQuestion({
      question: "Test question",
      onChunk,
      url: TEST_API_URL,
      typewriterDelay: 0,
    });

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "Part 1");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Part 2");
  });

  it("should collect and return citations", async () => {
    const mockCitation = {
      documentName: "Test Document",
      documentLink: "https://example.com/doc",
    };

    const mockChunks = [
      `${JSON.stringify({ type: "session", sessionId: "session-1" })}\n`,
      `${JSON.stringify({ type: "response", output: "Answer" })}\n`,
      `${JSON.stringify({ type: "citations", citations: [mockCitation] })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    const onCitation = vi.fn();
    const result = await askQuestion({
      question: "Test question",
      onChunk,
      onCitation,
      url: TEST_API_URL,
    });

    expect(result.citations).toEqual([mockCitation]);
    expect(onCitation).toHaveBeenCalledWith(mockCitation);
    expect(Logger.info).toHaveBeenCalledWith("[KnowledgeBase] Citations:", [mockCitation]);
  });

  it("should not collect citations when no citations event is sent", async () => {
    const mockChunks = [
      `${JSON.stringify({ type: "session", sessionId: "session-1" })}\n`,
      `${JSON.stringify({ type: "response", output: "Answer" })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const result = await askQuestion({
      question: "Test question",
      onChunk: vi.fn(),
      url: TEST_API_URL,
    });

    expect(result.citations).toEqual([]);
  });

  it("should log errors when present in response", async () => {
    const mockChunks = [
      `${JSON.stringify({ type: "session", sessionId: "session-1" })}\n`,
      `${JSON.stringify({ type: "response", output: "", error: "Something went wrong" })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    await askQuestion({
      question: "Test question",
      onChunk: vi.fn(),
      url: TEST_API_URL,
    });

    expect(Logger.error).toHaveBeenCalledWith(
      "[KnowledgeBase] Stream error:",
      "Something went wrong"
    );
  });

  it("should throw error when HTTP response is not ok", async () => {
    vi.mocked(global.fetch).mockResolvedValue(createMockResponse([], { ok: false, status: 500 }));

    await expect(
      askQuestion({
        question: "Test question",
        url: TEST_API_URL,
        typewriterDelay: 0,
      })
    ).rejects.toThrow("HTTP error! status: 500");

    expect(Logger.error).toHaveBeenCalledWith("[KnowledgeBase] Error:", expect.any(Error));
  });

  it("should handle abort signal correctly", async () => {
    const abortController = new AbortController();

    vi.mocked(global.fetch).mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 100);
        })
    );

    const promise = askQuestion({
      question: "Test question",
      signal: abortController.signal,
      url: TEST_API_URL,
    });

    abortController.abort();

    await expect(promise).rejects.toThrow("Aborted");
  });

  it("should handle malformed JSON lines gracefully", async () => {
    const mockChunks = [
      `${JSON.stringify({ type: "session", sessionId: "session-1" })}\n`,
      `${JSON.stringify({ type: "response", output: "Valid" })}\n`,
      "{invalid json}\n",
      `${JSON.stringify({ type: "response", output: "Still works" })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    await askQuestion({
      question: "Test question",
      onChunk,
      url: TEST_API_URL,
      typewriterDelay: 0,
    });

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "Valid");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Still works");
    expect(Logger.error).toHaveBeenCalledWith(
      "[KnowledgeBase] Failed to parse line:",
      "{invalid json}",
      expect.any(Error)
    );
  });

  it("should skip empty lines", async () => {
    const mockChunks = [
      `${JSON.stringify({ type: "session", sessionId: "session-1" })}\n`,
      "\n",
      `${JSON.stringify({ type: "response", output: "Text" })}\n`,
      "\n\n",
      `${JSON.stringify({ type: "response", output: "More" })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    await askQuestion({
      question: "Test question",
      onChunk,
      url: TEST_API_URL,
      typewriterDelay: 0,
    });

    expect(onChunk).toHaveBeenCalledTimes(2);
  });

  it("should work without onChunk callback", async () => {
    const mockChunks = [
      `${JSON.stringify({ type: "session", sessionId: "session-1" })}\n`,
      `${JSON.stringify({ type: "response", output: "Text" })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const result = await askQuestion({
      question: "Test question",
      url: TEST_API_URL,
    });

    expect(result.sessionId).toBe("session-1");
    expect(result.citations).toEqual([]);
  });

  it("should return null sessionId when no sessionId is received", async () => {
    const mockChunks = [`${JSON.stringify({ type: "response", output: "Text" })}\n`];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const result = await askQuestion({
      question: "Test question",
      onChunk: vi.fn(),
      url: TEST_API_URL,
    });

    expect(result.sessionId).toBeNull();
    expect(result.citations).toEqual([]);
    expect(getStoredSessionId()).toBeNull();
  });

  it("should filter duplicate citations by documentLink", async () => {
    const citation1 = {
      documentName: "Document 1",
      documentLink: "https://example.com/doc1",
    };
    const citation2 = {
      documentName: "Document 2",
      documentLink: "https://example.com/doc2",
    };
    const duplicateCitation = {
      documentName: "Document 1 Updated",
      documentLink: "https://example.com/doc1",
    };

    const mockChunks = [
      `${JSON.stringify({ type: "session", sessionId: "session-1" })}\n`,
      `${JSON.stringify({ type: "citations", citations: [citation1] })}\n`,
      `${JSON.stringify({ type: "citations", citations: [citation2] })}\n`,
      `${JSON.stringify({ type: "citations", citations: [duplicateCitation] })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onCitation = vi.fn();
    const result = await askQuestion({
      question: "Test question",
      onCitation,
      url: TEST_API_URL,
    });

    expect(result.citations).toEqual([citation1, citation2]);
    expect(onCitation).toHaveBeenCalledTimes(2);
    expect(onCitation).toHaveBeenNthCalledWith(1, citation1);
    expect(onCitation).toHaveBeenNthCalledWith(2, citation2);
  });

  it("should pass fetch signal to request", async () => {
    const mockChunks = [`${JSON.stringify({ type: "session", sessionId: "session-1" })}\n`];
    const abortController = new AbortController();

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    await askQuestion({
      question: "Test question",
      signal: abortController.signal,
      url: TEST_API_URL,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      TEST_API_URL,
      expect.objectContaining({
        signal: abortController.signal,
      })
    );
  });

  it("should handle network errors gracefully", async () => {
    const networkError = new Error("Network failure");
    vi.mocked(global.fetch).mockRejectedValue(networkError);

    await expect(
      askQuestion({
        question: "Test question",
        url: TEST_API_URL,
      })
    ).rejects.toThrow("Network failure");

    expect(Logger.error).toHaveBeenCalledWith("[KnowledgeBase] Error:", networkError);
  });

  it("should handle stream reading errors", async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.error(new Error("Stream error"));
      },
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      body: mockStream,
    } as Response);

    await expect(
      askQuestion({
        question: "Test question",
        url: TEST_API_URL,
      })
    ).rejects.toThrow("Stream error");
  });

  it("should throw error when url is not provided", async () => {
    await expect(
      askQuestion({
        question: "Test question",
        url: "",
      })
    ).rejects.toThrow("Knowledge base URL is required but was not provided");
  });
});

describe("processStreamingResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return session ID and citations from stream", async () => {
    const chunks = [`${JSON.stringify({ type: "session", sessionId: "test-session-123" })}\n`];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    const result = await processStreamingResponse(reader, undefined, undefined, 0);

    expect(result.sessionId).toBe("test-session-123");
    expect(result.citations).toEqual([]);
  });

  it("should return null sessionId when no session ID found in stream", async () => {
    const chunks = [`${JSON.stringify({ type: "response", output: "Hello world" })}\n`];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    const result = await processStreamingResponse(reader, undefined, undefined, 0);

    expect(result.sessionId).toBeNull();
    expect(result.citations).toEqual([]);
  });

  it("should handle incomplete JSON lines in buffer correctly", async () => {
    const onChunk = vi.fn();
    const chunks = ['{"type": "response", "output": "Hel', 'lo world"}\n'];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk, undefined, 0);

    expect(onChunk).toHaveBeenCalledWith("Hello world");
  });

  it("should process multiple complete lines in single chunk", async () => {
    const onChunk = vi.fn();
    const chunks = [
      `${JSON.stringify({ type: "response", output: "Line 1" })}\n${JSON.stringify({
        type: "response",
        output: "Line 2",
      })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk, undefined, 0);

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "Line 1");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Line 2");
  });

  it("should not process incomplete final line without newline", async () => {
    const onChunk = vi.fn();
    const chunks = [
      `${JSON.stringify({ type: "response", output: "Line 1" })}\n`,
      JSON.stringify({ type: "response", output: "Line 2" }),
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk, undefined, 0);

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith("Line 1");
  });

  it("should call onChunk for each complete line with output", async () => {
    const onChunk = vi.fn();
    const chunks = [
      `${JSON.stringify({ type: "response", output: "First" })}\n`,
      `${JSON.stringify({ type: "response", output: "Second" })}\n`,
      `${JSON.stringify({ type: "response", output: "Third" })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk, undefined, 0);

    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenNthCalledWith(1, "First");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Second");
    expect(onChunk).toHaveBeenNthCalledWith(3, "Third");
  });

  it("should only return first session ID found in stream", async () => {
    const onChunk = vi.fn();
    const chunks = [
      `${JSON.stringify({ type: "session", sessionId: "test-123" })}\n`,
      `${JSON.stringify({ type: "session", sessionId: "test-456" })}\n`,
      `${JSON.stringify({ type: "response", output: "Text" })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    const result = await processStreamingResponse(reader, onChunk, undefined, 0);

    expect(result.sessionId).toBe("test-123");
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith("Text");
  });

  it("should handle empty stream (immediate done)", async () => {
    const stream = createMockStream([]);
    const reader = stream.getReader();

    const result = await processStreamingResponse(reader, undefined, undefined, 0);

    expect(result.sessionId).toBeNull();
    expect(result.citations).toEqual([]);
  });

  it("should decode Uint8Array chunks correctly with TextDecoder", async () => {
    const onChunk = vi.fn();
    const chunks = [`${JSON.stringify({ type: "response", output: "Hello 👋" })}\n`];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk, undefined, 0);

    expect(onChunk).toHaveBeenCalledWith("Hello 👋");
  });

  it("should handle chunks with only newlines", async () => {
    const onChunk = vi.fn();
    const chunks = ["\n\n", `${JSON.stringify({ type: "response", output: "Hello" })}\n`, "\n"];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk, undefined, 0);

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith("Hello");
  });

  it("should skip empty lines between valid JSON lines", async () => {
    const onChunk = vi.fn();
    const chunks = [
      `${JSON.stringify({ type: "response", output: "First" })}\n\n${JSON.stringify({
        type: "response",
        output: "Second",
      })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk, undefined, 0);

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "First");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Second");
  });

  it("should work without onChunk callback", async () => {
    const chunks = [`${JSON.stringify({ type: "session", sessionId: "test-123" })}\n`];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    const result = await processStreamingResponse(reader, undefined, undefined, 0);

    expect(result.sessionId).toBe("test-123");
    expect(result.citations).toEqual([]);
  });

  it("should apply typewriter effect to multiple output chunks", async () => {
    vi.useFakeTimers();
    const chunks = [
      `${JSON.stringify({ type: "response", output: "Hi" })}\n`,
      `${JSON.stringify({ type: "response", output: " there" })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();
    const onChunk = vi.fn();

    const promise = processStreamingResponse(reader, onChunk, undefined, 10);

    await vi.runAllTimersAsync();
    await promise;

    expect(onChunk).toHaveBeenCalledTimes(8);
    expect(onChunk).toHaveBeenNthCalledWith(1, "H");
    expect(onChunk).toHaveBeenNthCalledWith(2, "i");
    expect(onChunk).toHaveBeenNthCalledWith(3, " ");
    expect(onChunk).toHaveBeenNthCalledWith(4, "t");
    expect(onChunk).toHaveBeenNthCalledWith(5, "h");
    expect(onChunk).toHaveBeenNthCalledWith(6, "e");
    expect(onChunk).toHaveBeenNthCalledWith(7, "r");
    expect(onChunk).toHaveBeenNthCalledWith(8, "e");

    vi.useRealTimers();
  });

  it("should collect citations from stream", async () => {
    const citation1 = {
      documentName: "Doc 1",
      documentLink: "https://example.com/doc1",
    };
    const citation2 = {
      documentName: "Doc 2",
      documentLink: "https://example.com/doc2",
    };

    const chunks = [
      `${JSON.stringify({ type: "session", sessionId: "session-1" })}\n`,
      `${JSON.stringify({ type: "response", output: "Text 1" })}\n`,
      `${JSON.stringify({ type: "citations", citations: [citation1, citation2] })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();
    const onCitation = vi.fn();

    const result = await processStreamingResponse(reader, undefined, onCitation, 0);

    expect(result.citations).toEqual([citation1, citation2]);
    expect(onCitation).toHaveBeenCalledTimes(2);
    expect(onCitation).toHaveBeenNthCalledWith(1, citation1);
    expect(onCitation).toHaveBeenNthCalledWith(2, citation2);
  });

  it("should filter duplicate citations by documentLink in stream", async () => {
    const citation1 = {
      documentName: "Doc 1",
      documentLink: "https://example.com/doc1",
    };
    const citation2 = {
      documentName: "Doc 2",
      documentLink: "https://example.com/doc2",
    };
    const duplicateCitation = {
      documentName: "Doc 1 Updated",
      documentLink: "https://example.com/doc1",
    };

    const chunks = [
      `${JSON.stringify({ type: "citations", citations: [citation1] })}\n`,
      `${JSON.stringify({ type: "citations", citations: [citation2] })}\n`,
      `${JSON.stringify({ type: "citations", citations: [duplicateCitation] })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();
    const onCitation = vi.fn();

    const result = await processStreamingResponse(reader, undefined, onCitation, 0);

    expect(result.citations).toEqual([citation1, citation2]);
    expect(onCitation).toHaveBeenCalledTimes(2);
  });

  it("should stop typewriter effect when abort signal is triggered during processing", async () => {
    vi.useFakeTimers();

    const chunks = [
      `${JSON.stringify({ type: "response", output: "This is a long message" })}\n`,
      `${JSON.stringify({ type: "response", output: " that continues on" })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();
    const onChunk = vi.fn();
    const abortController = new AbortController();

    const promise = processStreamingResponse(
      reader,
      onChunk,
      undefined,
      10,
      abortController.signal
    );

    await vi.advanceTimersByTimeAsync(30);

    abortController.abort();

    await vi.runAllTimersAsync();
    await promise;

    const emittedChars = onChunk.mock.calls.length;
    expect(emittedChars).toBeLessThan("This is a long message that continues on".length);

    vi.useRealTimers();
  });

  it("should invoke onPulse callback and log pulse description", async () => {
    const chunks = [
      `${JSON.stringify({ type: "pulse", description: "Searching documents..." })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();
    const onPulse = vi.fn();

    await processStreamingResponse(reader, undefined, undefined, 0, undefined, onPulse);

    expect(onPulse).toHaveBeenCalledWith("Searching documents...");
    expect(Logger.info).toHaveBeenCalledWith("[KnowledgeBase] Pulse:", "Searching documents...");
  });

  it("should silently ignore unknown event types and log them", async () => {
    const onChunk = vi.fn();
    const chunks = [
      `${JSON.stringify({ type: "future_event", data: "something" })}\n`,
      `${JSON.stringify({ type: "response", output: "Hello" })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk, undefined, 0);

    expect(onChunk).toHaveBeenCalledWith("Hello");
    expect(Logger.info).toHaveBeenCalledWith(
      "[KnowledgeBase] Unknown event type:",
      "future_event",
      expect.objectContaining({ type: "future_event" })
    );
  });
});

describe("emitWithTypewriter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should emit characters one by one with typewriter delay", async () => {
    const onChunk = vi.fn();

    const promise = emitWithTypewriter("Hi", onChunk, 15);
    await vi.runAllTimersAsync();
    await promise;

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "H");
    expect(onChunk).toHaveBeenNthCalledWith(2, "i");
  });

  it("should emit entire text at once when typewriter delay is 0", async () => {
    const onChunk = vi.fn();

    await emitWithTypewriter("Hello", onChunk, 0);

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith("Hello");
  });

  it("should respect custom typewriter delay timing", async () => {
    const onChunk = vi.fn();
    const customDelay = 50;

    const promise = emitWithTypewriter("AB", onChunk, customDelay);
    await vi.runAllTimersAsync();
    await promise;

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "A");
    expect(onChunk).toHaveBeenNthCalledWith(2, "B");
  });

  it("should use default 15ms delay when not specified", async () => {
    const onChunk = vi.fn();

    const promise = emitWithTypewriter("XY", onChunk);
    await vi.runAllTimersAsync();
    await promise;

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "X");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Y");
  });

  it("should not call onChunk when not provided", async () => {
    const promise = emitWithTypewriter("Hello", undefined, 100);
    await promise;

    expect(vi.getTimerCount()).toBe(0);
  });

  it("should handle empty text", async () => {
    const onChunk = vi.fn();

    await emitWithTypewriter("", onChunk, 15);

    expect(onChunk).not.toHaveBeenCalled();
  });

  it("should work with special characters and emojis", async () => {
    const onChunk = vi.fn();

    const promise = emitWithTypewriter("Hi👋", onChunk, 10);
    await vi.runAllTimersAsync();
    await promise;

    expect(onChunk).toHaveBeenCalledTimes(4);
    expect(onChunk).toHaveBeenNthCalledWith(1, "H");
    expect(onChunk).toHaveBeenNthCalledWith(2, "i");
    expect(onChunk.mock.calls[2][0] + onChunk.mock.calls[3][0]).toBe("👋");
  });

  it("should emit all characters for longer text", async () => {
    const onChunk = vi.fn();
    const text = "Hello World";

    const promise = emitWithTypewriter(text, onChunk, 5);
    await vi.runAllTimersAsync();
    await promise;

    expect(onChunk).toHaveBeenCalledTimes(text.length);
    const emittedText = onChunk.mock.calls.map((call) => call[0]).join("");
    expect(emittedText).toBe(text);
  });

  it("should stop typewriter effect when abort signal is triggered", async () => {
    const onChunk = vi.fn();
    const text = "Hello World";
    const abortController = new AbortController();

    const promise = emitWithTypewriter(text, onChunk, 5, abortController.signal);

    await vi.advanceTimersByTimeAsync(10);

    abortController.abort();

    await vi.runAllTimersAsync();
    await promise;

    expect(onChunk.mock.calls.length).toBeLessThan(text.length);
    expect(onChunk).not.toHaveBeenCalledTimes(text.length);
  });

  it("should not emit any characters if already aborted", async () => {
    const onChunk = vi.fn();
    const text = "Hello";
    const abortController = new AbortController();

    abortController.abort();

    const promise = emitWithTypewriter(text, onChunk, 5, abortController.signal);
    await vi.runAllTimersAsync();
    await promise;

    expect(onChunk).not.toHaveBeenCalled();
  });

  it("should emit all text immediately when delay is 0 and not aborted", async () => {
    const onChunk = vi.fn();
    const text = "Hello";
    const abortController = new AbortController();

    await emitWithTypewriter(text, onChunk, 0, abortController.signal);

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith(text);
  });
});
