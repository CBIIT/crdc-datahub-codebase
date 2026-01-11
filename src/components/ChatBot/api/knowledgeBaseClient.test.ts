import { Logger } from "@/utils";

import { getStoredSessionId, storeSessionId } from "../utils/sessionStorageUtils";

import { askQuestion } from "./knowledgeBaseClient";

vi.mock("@/utils", () => ({
  Logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/env", () => ({
  default: {
    VITE_KNOWLEDGE_BASE_URL: "https://test-api.example.com/",
  },
}));

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
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://test-api.example.com/",
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
    });

    expect(Logger.error).toHaveBeenCalledWith("Error:", "Something went wrong");
  });

  it("should throw error when HTTP response is not ok", async () => {
    vi.mocked(global.fetch).mockResolvedValue(createMockResponse([], { ok: false, status: 500 }));

    await expect(
      askQuestion({
        question: "Test question",
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
    });

    expect(result).toBe("session-1");
  });

  it("should return null when no sessionId is received", async () => {
    const mockChunks = [`${JSON.stringify({ output: { text: "Text" }, citation: {} })}\n`];

    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    const result = await askQuestion({
      question: "Test question",
      onChunk: vi.fn(),
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
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://test-api.example.com/",
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
      })
    ).rejects.toThrow("Stream error");
  });

  it("should use fallback URL when VITE_KNOWLEDGE_BASE_URL is not set", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      default: {},
    }));

    // Re-import askQuestion with the new env mock
    const { askQuestion: askQuestionWithFallback } = await import("./knowledgeBaseClient");

    const mockChunks = [`${JSON.stringify({ sessionId: "session-1" })}\n`];
    vi.mocked(global.fetch).mockResolvedValue(createMockResponse(mockChunks));

    await askQuestionWithFallback({
      question: "Test question",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://qimghguigfq2bmnfqqqyze6cva0yscgr.lambda-url.us-east-1.on.aws/",
      expect.objectContaining({
        method: "POST",
      })
    );

    vi.resetModules();
  });
});
