import { Logger } from "@/utils";

import { getStoredSessionId, storeSessionId } from "../utils/sessionStorageUtils";

import { askQuestion, processLine, processStreamingResponse } from "./knowledgeBaseClient";

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
      `${JSON.stringify({ sessionId: "test-session-123" })}\n`,
      `${JSON.stringify({ output: { text: "Hello " }, citation: {} })}\n`,
      `${JSON.stringify({ output: { text: "world" }, citation: {} })}\n`,
      `${JSON.stringify({ output: { text: "!" }, citation: {} })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    const result = await askQuestion({
      question: "Test question",
      sessionId: null,
      onChunk,
      url: TEST_API_URL,
    });

    expect(result).toBe("test-session-123");
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenNthCalledWith(1, "Hello ");
    expect(onChunk).toHaveBeenNthCalledWith(2, "world");
    expect(onChunk).toHaveBeenNthCalledWith(3, "!");
    expect(getStoredSessionId()).toBe("test-session-123");
  });

  it("should handle streaming with existing sessionId", async () => {
    storeSessionId("existing-session");

    const mockChunks = [
      `${JSON.stringify({ sessionId: "existing-session" })}\n`,
      `${JSON.stringify({ output: { text: "Response" }, citation: {} })}\n`,
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
        body: JSON.stringify({ question: "Test question", sessionId: "existing-session" }),
      })
    );
  });

  it("should handle multi-line chunks correctly", async () => {
    const mockChunks = [
      `${JSON.stringify({ sessionId: "session-1" })}\n${JSON.stringify({
        output: { text: "First" },
        citation: {},
      })}\n`,
      `${JSON.stringify({ output: { text: " Second" }, citation: {} })}\n${JSON.stringify({
        output: { text: " Third" },
        citation: {},
      })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    await askQuestion({
      question: "Test question",
      onChunk,
      url: TEST_API_URL,
    });

    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenNthCalledWith(1, "First");
    expect(onChunk).toHaveBeenNthCalledWith(2, " Second");
    expect(onChunk).toHaveBeenNthCalledWith(3, " Third");
  });

  it("should handle incomplete JSON lines in buffer", async () => {
    const partialJson = JSON.stringify({ output: { text: "Part 1" }, citation: {} });
    const mockChunks = [
      `${JSON.stringify({ sessionId: "session-1" })}\n${partialJson.slice(0, 20)}`,
      `${partialJson.slice(20)}\n${JSON.stringify({ output: { text: "Part 2" }, citation: {} })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    await askQuestion({
      question: "Test question",
      onChunk,
      url: TEST_API_URL,
    });

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "Part 1");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Part 2");
  });

  it("should log citations when present", async () => {
    const mockCitation = {
      title: "Test Document",
      url: "https://example.com/doc",
      snippet: "Test snippet",
    };

    const mockChunks = [
      `${JSON.stringify({ sessionId: "session-1" })}\n`,
      `${JSON.stringify({ output: { text: "Answer" }, citation: mockCitation })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    await askQuestion({
      question: "Test question",
      onChunk,
      url: TEST_API_URL,
    });

    expect(Logger.info).toHaveBeenCalledWith("Citations:", mockCitation);
  });

  it("should not log citations when citation object is empty", async () => {
    const mockChunks = [
      `${JSON.stringify({ sessionId: "session-1" })}\n`,
      `${JSON.stringify({ output: { text: "Answer" }, citation: {} })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    await askQuestion({
      question: "Test question",
      onChunk: vi.fn(),
      url: TEST_API_URL,
    });

    expect(Logger.info).not.toHaveBeenCalled();
  });

  it("should log errors when present in response", async () => {
    const mockChunks = [
      `${JSON.stringify({ sessionId: "session-1" })}\n`,
      `${JSON.stringify({ error: "Something went wrong", citation: {} })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    await askQuestion({
      question: "Test question",
      onChunk: vi.fn(),
      url: TEST_API_URL,
    });

    expect(Logger.error).toHaveBeenCalledWith("Error:", "Something went wrong");
  });

  it("should throw error when HTTP response is not ok", async () => {
    vi.mocked(global.fetch).mockResolvedValue(createMockResponse([], { ok: false, status: 500 }));

    await expect(
      askQuestion({
        question: "Test question",
        url: TEST_API_URL,
      })
    ).rejects.toThrow("HTTP error! status: 500");

    expect(Logger.error).toHaveBeenCalledWith("Error:", expect.any(Error));
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
      `${JSON.stringify({ sessionId: "session-1" })}\n`,
      `${JSON.stringify({ output: { text: "Valid" }, citation: {} })}\n`,
      "{invalid json}\n",
      `${JSON.stringify({ output: { text: "Still works" }, citation: {} })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    await askQuestion({
      question: "Test question",
      onChunk,
      url: TEST_API_URL,
    });

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "Valid");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Still works");
    expect(Logger.error).toHaveBeenCalledWith(
      "Failed to parse line:",
      "{invalid json}",
      expect.any(Error)
    );
  });

  it("should skip empty lines", async () => {
    const mockChunks = [
      `${JSON.stringify({ sessionId: "session-1" })}\n`,
      "\n",
      `${JSON.stringify({ output: { text: "Text" }, citation: {} })}\n`,
      "\n\n",
      `${JSON.stringify({ output: { text: "More" }, citation: {} })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const onChunk = vi.fn();
    await askQuestion({
      question: "Test question",
      onChunk,
      url: TEST_API_URL,
    });

    expect(onChunk).toHaveBeenCalledTimes(2);
  });

  it("should work without onChunk callback", async () => {
    const mockChunks = [
      `${JSON.stringify({ sessionId: "session-1" })}\n`,
      `${JSON.stringify({ output: { text: "Text" }, citation: {} })}\n`,
    ];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const result = await askQuestion({
      question: "Test question",
      url: TEST_API_URL,
    });

    expect(result).toBe("session-1");
  });

  it("should return null when no sessionId is received", async () => {
    const mockChunks = [`${JSON.stringify({ output: { text: "Text" }, citation: {} })}\n`];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const result = await askQuestion({
      question: "Test question",
      onChunk: vi.fn(),
      url: TEST_API_URL,
    });

    expect(result).toBeNull();
    expect(getStoredSessionId()).toBeNull();
  });

  it("should pass fetch signal to request", async () => {
    const mockChunks = [`${JSON.stringify({ sessionId: "session-1" })}\n`];
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

    expect(Logger.error).toHaveBeenCalledWith("Error:", networkError);
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

describe("processLine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return session ID when isFirstChunk is true and sessionId exists", () => {
    const line = JSON.stringify({ sessionId: "test-session-123" });
    const result = processLine(line, true);

    expect(result).toBe("test-session-123");
  });

  it("should return undefined when isFirstChunk is false", () => {
    const line = JSON.stringify({ sessionId: "test-session-123" });
    const result = processLine(line, false);

    expect(result).toBeUndefined();
  });

  it("should return undefined when session ID is not present in parsed object", () => {
    const line = JSON.stringify({ output: "Some text" });
    const result = processLine(line, true);

    expect(result).toBeUndefined();
  });

  it("should invoke onChunk callback with output text when present (string format)", () => {
    const onChunk = vi.fn();
    const line = JSON.stringify({ output: "Hello world" });
    processLine(line, false, onChunk);

    expect(onChunk).toHaveBeenCalledWith("Hello world");
    expect(onChunk).toHaveBeenCalledTimes(1);
  });

  it("should invoke onChunk callback with output.text when present (object format)", () => {
    const onChunk = vi.fn();
    const line = JSON.stringify({ output: { text: "Hello world" } });
    processLine(line, false, onChunk);

    expect(onChunk).toHaveBeenCalledWith("Hello world");
    expect(onChunk).toHaveBeenCalledTimes(1);
  });

  it("should not invoke onChunk when output is missing", () => {
    const onChunk = vi.fn();
    const line = JSON.stringify({ sessionId: "test-123" });
    processLine(line, true, onChunk);

    expect(onChunk).not.toHaveBeenCalled();
  });

  it("should not invoke onChunk when onChunk callback is not provided", () => {
    const line = JSON.stringify({ output: "Hello world" });
    expect(() => processLine(line, false)).not.toThrow();
  });

  it("should log citation when present and non-empty", () => {
    const line = JSON.stringify({
      citation: {
        title: "Document 1",
        url: "http://example.com/doc1",
      },
    });
    processLine(line, false);

    expect(Logger.info).toHaveBeenCalledWith("Citations:", {
      title: "Document 1",
      url: "http://example.com/doc1",
    });
  });

  it("should not log citation when empty object", () => {
    const line = JSON.stringify({ citation: {} });
    processLine(line, false);

    expect(Logger.info).not.toHaveBeenCalled();
  });

  it("should log errors when parsed.error exists", () => {
    const line = JSON.stringify({ error: "Something went wrong" });
    processLine(line, false);

    expect(Logger.error).toHaveBeenCalledWith("Error:", "Something went wrong");
  });

  it("should handle JSON.parse errors gracefully and return undefined", () => {
    const invalidLine = "{ invalid json }";
    const result = processLine(invalidLine, false);

    expect(result).toBeUndefined();
    expect(Logger.error).toHaveBeenCalledWith(
      "Failed to parse line:",
      invalidLine,
      expect.any(Error)
    );
  });

  it("should handle empty string input", () => {
    const result = processLine("", false);

    expect(result).toBeUndefined();
    expect(Logger.error).toHaveBeenCalledWith("Failed to parse line:", "", expect.any(Error));
  });

  it("should return session ID and skip onChunk on first chunk even if output present", () => {
    const onChunk = vi.fn();
    const line = JSON.stringify({ sessionId: "test-123", output: "Initial response" });
    const result = processLine(line, true, onChunk);

    expect(result).toBe("test-123");
    expect(onChunk).not.toHaveBeenCalled();
  });
});

describe("processStreamingResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return session ID from first chunk with valid stream", async () => {
    const chunks = [`${JSON.stringify({ sessionId: "test-session-123", output: "Hello" })}\n`];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    const result = await processStreamingResponse(reader);

    expect(result).toBe("test-session-123");
  });

  it("should return null when no session ID found in stream", async () => {
    const chunks = [`${JSON.stringify({ output: "Hello world" })}\n`];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    const result = await processStreamingResponse(reader);

    expect(result).toBeNull();
  });

  it("should handle incomplete JSON lines in buffer correctly", async () => {
    const onChunk = vi.fn();
    const chunks = ['{"output": "Hel', 'lo world"}\n'];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk);

    expect(onChunk).toHaveBeenCalledWith("Hello world");
  });

  it("should process multiple complete lines in single chunk", async () => {
    const onChunk = vi.fn();
    const chunks = [
      `${JSON.stringify({ output: "Line 1" })}\n${JSON.stringify({ output: "Line 2" })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk);

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "Line 1");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Line 2");
  });

  it("should not process incomplete final line without newline", async () => {
    const onChunk = vi.fn();
    const chunks = [
      `${JSON.stringify({ output: "Line 1" })}\n`,
      JSON.stringify({ output: "Line 2" }),
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk);

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith("Line 1");
  });

  it("should call onChunk for each complete line with output", async () => {
    const onChunk = vi.fn();
    const chunks = [
      `${JSON.stringify({ output: "First" })}\n`,
      `${JSON.stringify({ output: "Second" })}\n`,
      `${JSON.stringify({ output: "Third" })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk);

    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenNthCalledWith(1, "First");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Second");
    expect(onChunk).toHaveBeenNthCalledWith(3, "Third");
  });

  it("should only return first session ID found in stream", async () => {
    const onChunk = vi.fn();
    const chunks = [
      `${JSON.stringify({ sessionId: "test-123", output: "First" })}\n`,
      `${JSON.stringify({ sessionId: "test-456", output: "Second" })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    const result = await processStreamingResponse(reader, onChunk);

    expect(result).toBe("test-123");
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith("Second");
  });

  it("should handle empty stream (immediate done)", async () => {
    const stream = createMockStream([]);
    const reader = stream.getReader();

    const result = await processStreamingResponse(reader);

    expect(result).toBeNull();
  });

  it("should decode Uint8Array chunks correctly with TextDecoder", async () => {
    const onChunk = vi.fn();
    const chunks = [`${JSON.stringify({ output: "Hello 👋" })}\n`];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk);

    expect(onChunk).toHaveBeenCalledWith("Hello 👋");
  });

  it("should handle chunks with only newlines", async () => {
    const onChunk = vi.fn();
    const chunks = ["\n\n", `${JSON.stringify({ output: "Hello" })}\n`, "\n"];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk);

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith("Hello");
  });

  it("should skip empty lines between valid JSON lines", async () => {
    const onChunk = vi.fn();
    const chunks = [
      `${JSON.stringify({ output: "First" })}\n\n${JSON.stringify({ output: "Second" })}\n`,
    ];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    await processStreamingResponse(reader, onChunk);

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "First");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Second");
  });

  it("should work without onChunk callback", async () => {
    const chunks = [`${JSON.stringify({ sessionId: "test-123", output: "Hello" })}\n`];
    const stream = createMockStream(chunks);
    const reader = stream.getReader();

    const result = await processStreamingResponse(reader);

    expect(result).toBe("test-123");
  });
});
