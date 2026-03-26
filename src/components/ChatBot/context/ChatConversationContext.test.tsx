import { Box } from "@mui/material";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import * as knowledgeBaseClient from "../api/knowledgeBaseClient";
import * as chatUtils from "../utils/chatUtils";
import * as conversationStorageUtils from "../utils/conversationStorageUtils";
import * as sessionStorageUtils from "../utils/sessionStorageUtils";

import * as ChatBotContextModule from "./ChatBotContext";
import {
  chatReducer,
  ChatConversationProvider,
  useChatConversationContext,
} from "./ChatConversationContext";

vi.mock("../api/knowledgeBaseClient", () => ({
  askQuestion: vi.fn(),
}));

vi.mock("../utils/chatUtils", async () => {
  const actual = await vi.importActual<typeof import("../utils/chatUtils")>("../utils/chatUtils");
  return {
    ...actual,
    createId: vi.fn(actual.createId),
    createChatMessage: vi.fn(actual.createChatMessage),
  };
});

vi.mock("./ChatBotContext", () => ({
  useChatBotContext: vi.fn(),
}));

vi.mock("../utils/sessionStorageUtils", () => ({
  getStoredSessionId: vi.fn(),
  clearStoredSessionId: vi.fn(),
}));

vi.mock("../utils/conversationStorageUtils", () => ({
  getStoredConversationMessages: vi.fn(),
  storeConversationMessages: vi.fn(),
  clearConversationMessages: vi.fn(),
}));

const mockAskQuestion = vi.mocked(knowledgeBaseClient.askQuestion);
const mockUseChatBotContext = vi.mocked(ChatBotContextModule.useChatBotContext);
const mockGetStoredSessionId = vi.mocked(sessionStorageUtils.getStoredSessionId);
const mockClearStoredSessionId = vi.mocked(sessionStorageUtils.clearStoredSessionId);
const mockGetStoredConversationMessages = vi.mocked(
  conversationStorageUtils.getStoredConversationMessages
);
const mockStoreConversationMessages = vi.mocked(conversationStorageUtils.storeConversationMessages);
const mockClearConversationMessages = vi.mocked(conversationStorageUtils.clearConversationMessages);
const mockCreateChatMessage = vi.mocked(chatUtils.createChatMessage);

const TestParent = () => {
  const conversation = useChatConversationContext();

  return (
    <div>
      <div data-testid="greeting-timestamp">{conversation.greetingTimestamp.toISOString()}</div>
      <div data-testid="messages-count">{conversation.messages.length}</div>
      <div data-testid="messages">
        {conversation.messages.map((msg) => (
          <div
            key={msg.id}
            data-testid={`message-${msg.id}`}
            data-sender={msg.sender}
            data-variant={msg.variant}
            data-citations={msg.citations?.length ?? 0}
          >
            {msg.text}
            {msg.citations && msg.citations.length > 0 && (
              <span data-testid={`citations-${msg.id}`}>
                {msg.citations.map((c) => c.documentName).join(", ")}
              </span>
            )}
          </div>
        ))}
      </div>
      <input
        data-testid="input-value"
        value={conversation.inputValue}
        onChange={(e) => conversation.setInputValue(e.target.value)}
        onKeyDown={conversation.handleKeyDown}
      />
      <div data-testid="is-bot-typing">{conversation.isBotTyping.toString()}</div>
      <button
        type="button"
        data-testid="send-button"
        onClick={() => conversation.sendMessage()}
        disabled={conversation.isBotTyping}
      >
        Send
      </button>
      <Box component="div" data-testid="keydown-button" onKeyDown={conversation.handleKeyDown}>
        KeyDown
      </Box>
      <button
        type="button"
        data-testid="end-conversation-button"
        onClick={conversation.endConversation}
      >
        End
      </button>
    </div>
  );
};

const renderWithProvider = async () => {
  const view = render(
    <ChatConversationProvider>
      <TestParent />
    </ChatConversationProvider>
  );

  await waitFor(() => {
    expect(view.getByTestId("messages-count")).toBeInTheDocument();
  });

  return view;
};

describe("ChatConversationContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatBotContext.mockReturnValue({
      label: "Chat",
      knowledgeBaseUrl: "https://api.example.com/chat",
    });
    mockGetStoredSessionId.mockReturnValue("test-session-id");
    mockAskQuestion.mockResolvedValue({ sessionId: "test-session-id", citations: [] });
    mockGetStoredConversationMessages.mockResolvedValue([]);
    mockStoreConversationMessages.mockResolvedValue();
    mockClearConversationMessages.mockResolvedValue();
  });

  describe("Initial State", () => {
    it("should initialize with greeting message", async () => {
      const { getByTestId } = render(
        <ChatConversationProvider>
          <TestParent />
        </ChatConversationProvider>
      );

      await waitFor(() => {
        expect(getByTestId("messages-count")).toHaveTextContent("1");
      });
    });

    it("should initialize with empty input value", async () => {
      const { getByTestId } = render(
        <ChatConversationProvider>
          <TestParent />
        </ChatConversationProvider>
      );

      await waitFor(() => {
        expect(getByTestId("input-value")).toHaveValue("");
      });
    });

    it("should initialize with isBotTyping as false", async () => {
      const { getByTestId } = await renderWithProvider();

      expect(getByTestId("is-bot-typing")).toHaveTextContent("false");
    });

    it("should initialize with greeting timestamp", async () => {
      const { getByTestId } = await renderWithProvider();

      const timestamp = getByTestId("greeting-timestamp").textContent;
      expect(timestamp).toBeTruthy();
      expect(() => new Date(timestamp)).not.toThrow();
    });

    it("should have stable greeting timestamp across re-renders", async () => {
      const { getByTestId, rerender } = await renderWithProvider();

      const firstTimestamp = getByTestId("greeting-timestamp").textContent;
      rerender(
        <ChatConversationProvider>
          <TestParent />
        </ChatConversationProvider>
      );

      await waitFor(() => {
        expect(getByTestId("messages-count")).toBeInTheDocument();
      });

      const secondTimestamp = getByTestId("greeting-timestamp").textContent;

      expect(firstTimestamp).toBe(secondTimestamp);
    });
  });

  describe("setInputValue", () => {
    it("should update input value", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.clear(input);
      userEvent.type(input, "Hello");

      expect(input).toHaveValue("Hello");
    });

    it("should update input value multiple times", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.clear(input);
      userEvent.type(input, "Hello");

      expect(input).toHaveValue("Hello");

      userEvent.clear(input);
      userEvent.type(input, "Hello World");

      expect(input).toHaveValue("Hello World");
    });

    it("should handle empty string", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");
      userEvent.clear(input);

      expect(input).toHaveValue("");
    });
  });

  describe("sendMessage", () => {
    it("should not send empty message", async () => {
      const { getByTestId } = await renderWithProvider();

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      expect(getByTestId("messages-count")).toHaveTextContent("1");
      expect(mockAskQuestion).not.toHaveBeenCalled();
    });

    it("should not send whitespace-only message", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "   ");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      expect(getByTestId("messages-count")).toHaveTextContent("1");
      expect(mockAskQuestion).not.toHaveBeenCalled();
    });

    it("should add user message when sending", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Hello bot");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("messages-count")).toHaveTextContent("2");
      });
    });

    it("should clear input after sending", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test message");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(input).toHaveValue("");
      });
    });

    it("should set isBotTyping to true while waiting for response", async () => {
      mockAskQuestion.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ sessionId: "test-session-id", citations: [] }), 100);
          })
      );

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("is-bot-typing")).toHaveTextContent("true");
      });
    });

    it("should call askQuestion with correct parameters", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "What is CRDC?");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockAskQuestion).toHaveBeenCalledWith(
          expect.objectContaining({
            question: "What is CRDC?",
            sessionId: "test-session-id",
            url: "https://api.example.com/chat",
            signal: expect.any(AbortSignal),
          })
        );
      });
    });

    it("should handle streaming response with onChunk", async () => {
      mockAskQuestion.mockImplementation(async ({ onChunk }) => {
        if (onChunk) {
          onChunk("Hello ");
          onChunk("from ");
          onChunk("bot");
        }
        return { sessionId: "test-session-id", citations: [] };
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Hi");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("messages-count")).toHaveTextContent("3");
      });

      const messages = getByTestId("messages");
      expect(messages.textContent).toContain("Hello from bot");
    });

    it("should set isBotTyping to false after first chunk received", async () => {
      mockAskQuestion.mockImplementation(async ({ onChunk }) => {
        if (onChunk) {
          onChunk("First chunk");
        }
        return { sessionId: "test-session-id", citations: [] };
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("is-bot-typing")).toHaveTextContent("false");
      });
    });

    it("should update bot message as chunks arrive", async () => {
      mockAskQuestion.mockImplementation(async ({ onChunk }) => {
        if (onChunk) {
          onChunk("Part 1 ");
          onChunk("Part 2");
        }
        return { sessionId: "test-session-id", citations: [] };
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("messages-count")).toHaveTextContent("3");
      });

      const messages = getByTestId("messages");
      expect(messages.textContent).toContain("Part 1 Part 2");
    });

    it("should handle error response", async () => {
      mockAskQuestion.mockRejectedValue(new Error("API Error"));

      const { getByTestId, getByText } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByText(/unexpected error occurred/)).toBeInTheDocument();
      });

      expect(getByTestId("is-bot-typing")).toHaveTextContent("false");
    });

    it("should not send message when bot is typing", async () => {
      mockAskQuestion.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ sessionId: "test-session-id", citations: [] }), 100);
          })
      );

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "First message");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("is-bot-typing")).toHaveTextContent("true");
      });

      const messageCount = getByTestId("messages-count").textContent;

      userEvent.clear(input);
      userEvent.type(input, "Second message");
      userEvent.click(sendButton);

      expect(getByTestId("messages-count")).toHaveTextContent(messageCount);
    });

    it("should return early from sendMessage when bot is typing (via keydown)", async () => {
      mockAskQuestion.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ sessionId: "test-session-id", citations: [] }), 200);
          })
      );

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "First message{Enter}");

      await waitFor(() => {
        expect(getByTestId("is-bot-typing")).toHaveTextContent("true");
      });

      const messageCount = getByTestId("messages-count").textContent;
      const callCount = mockAskQuestion.mock.calls.length;

      userEvent.clear(input);
      userEvent.type(input, "Second message{Enter}");

      expect(getByTestId("messages-count")).toHaveTextContent(messageCount);
      expect(mockAskQuestion).toHaveBeenCalledTimes(callCount);
    });

    it("should abort previous request when sending new message", async () => {
      const abortSignals: AbortSignal[] = [];

      mockAskQuestion.mockImplementation(async ({ signal, onChunk }) => {
        abortSignals.push(signal);
        if (onChunk) {
          onChunk("Response");
        }
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 100);
        });
        return { sessionId: "test-session-id", citations: [] };
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      const sendButton = getByTestId("send-button");

      userEvent.type(input, "First");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("is-bot-typing")).toHaveTextContent("false");
      });

      userEvent.type(input, "Second");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(abortSignals).toHaveLength(2);
      });

      expect(abortSignals[0].aborted).toBe(true);
      expect(abortSignals[1].aborted).toBe(false);
    });

    it("should handle AbortError gracefully", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockAskQuestion.mockRejectedValue(abortError);

      const { getByTestId, queryByText } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("is-bot-typing")).toHaveTextContent("true");
      });

      expect(queryByText(/unexpected error occurred/)).not.toBeInTheDocument();
    });
  });

  describe("handleKeyDown", () => {
    it("should send message on Enter key", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test message{Enter}");

      await waitFor(() => {
        expect(getByTestId("messages-count")).toHaveTextContent("2");
      });
    });

    it("should not send message on Shift+Enter", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test message");

      const keyDownButton = getByTestId("keydown-button");
      userEvent.type(keyDownButton, "{Shift>}{Enter}{/Shift}");

      expect(getByTestId("messages-count")).toHaveTextContent("1");
    });

    it("should not send message on other keys", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test message");

      const keyDownButton = getByTestId("keydown-button");
      userEvent.type(keyDownButton, "a");

      expect(getByTestId("messages-count")).toHaveTextContent("1");
    });
  });

  describe("endConversation", () => {
    it("should clear stored session ID", async () => {
      const { getByTestId } = await renderWithProvider();

      const endButton = getByTestId("end-conversation-button");
      userEvent.click(endButton);

      expect(mockClearStoredSessionId).toHaveBeenCalled();
    });

    it("should abort active request", async () => {
      let abortSignal: AbortSignal | null = null;

      mockAskQuestion.mockImplementation(async ({ signal }) => {
        abortSignal = signal;
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 100);
        });
        return { sessionId: "test-session-id", citations: [] };
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(abortSignal).not.toBeNull();
      });

      const endButton = getByTestId("end-conversation-button");
      userEvent.click(endButton);

      expect(abortSignal?.aborted).toBe(true);
    });

    it("should abort request on unmount", async () => {
      let abortSignal: AbortSignal | null = null;

      mockAskQuestion.mockImplementation(async ({ signal }) => {
        abortSignal = signal;
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 200);
        });
        return { sessionId: "test-session-id", citations: [] };
      });

      const { getByTestId, unmount } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(abortSignal).not.toBeNull();
      });

      unmount();

      expect(abortSignal?.aborted).toBe(true);
    });
  });

  describe("Reducer", () => {
    it("should return current state for unknown action type", () => {
      const initialState = {
        messages: [],
        inputValue: "test",
        status: "idle" as const,
        isInitialized: true,
      };

      const result = chatReducer(initialState, { type: "unknown" } as never);

      expect(result).toEqual(initialState);
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple rapid setInputValue calls", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.clear(input);
      userEvent.type(input, "Hello");

      expect(input).toHaveValue("Hello");
    });

    it("should use same bot message ID for streaming chunks", async () => {
      mockAskQuestion.mockImplementation(async ({ onChunk }) => {
        if (onChunk) {
          onChunk("Chunk 1 ");
          onChunk("Chunk 2");
        }
        return { sessionId: "test-session-id", citations: [] };
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        const messages = getByTestId("messages");
        expect(messages.textContent).toContain("Chunk 1 Chunk 2");
      });
    });

    it("should trim message before sending", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "  Test message  ");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockAskQuestion).toHaveBeenCalledWith(
          expect.objectContaining({
            question: "Test message",
          })
        );
      });
    });

    it("should handle Shift+Enter without sending message", async () => {
      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test message");

      const keydownButton = getByTestId("keydown-button");
      keydownButton.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      );

      expect(mockAskQuestion).not.toHaveBeenCalled();
      expect(input).toHaveValue("Test message");
    });

    it("should not reset status when error for superseded request", async () => {
      let firstResolve: (() => void) | null = null;
      let callCount = 0;

      mockAskQuestion.mockImplementation(async ({ onChunk }) => {
        callCount += 1;
        if (callCount === 1) {
          if (onChunk) {
            onChunk("First");
          }
          await new Promise<void>((resolve) => {
            firstResolve = resolve;
          });
          throw new Error("Network error");
        }
        if (onChunk) {
          onChunk("Second");
        }
        return { sessionId: "test-session-id", citations: [] };
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "First");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("is-bot-typing")).toHaveTextContent("false");
      });

      userEvent.clear(input);
      userEvent.type(input, "Second");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockAskQuestion).toHaveBeenCalledTimes(2);
      });

      if (firstResolve) {
        firstResolve();
      }

      await waitFor(() => {
        const messages = getByTestId("messages");
        expect(messages.textContent).toContain("Second");
      });
    });

    it("should handle non-abort errors in final catch", async () => {
      mockAskQuestion.mockImplementation(async () => {
        throw new Error("Synchronous error");
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("is-bot-typing")).toHaveTextContent("false");
      });
    });

    it("should reset status to idle when runReply throws non-abort error", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const originalImplementation = mockCreateChatMessage.getMockImplementation();
      let shouldThrow = false;

      mockCreateChatMessage.mockImplementation((params) => {
        if (shouldThrow && params.variant === "error") {
          throw new Error("createChatMessage failed");
        }
        return originalImplementation(params);
      });

      mockAskQuestion.mockImplementation(async () => {
        shouldThrow = true;
        throw new Error("API Error");
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("is-bot-typing")).toHaveTextContent("false");
      });

      mockCreateChatMessage.mockImplementation(originalImplementation);
      consoleError.mockRestore();
    });

    it("should return early when aborted after askQuestion completes", async () => {
      let firstResolve: (() => void) | null = null;
      let callCount = 0;

      mockAskQuestion.mockImplementation(async ({ onChunk }) => {
        callCount += 1;
        if (callCount === 1) {
          if (onChunk) {
            onChunk("First response");
          }
          await new Promise<void>((resolve) => {
            firstResolve = resolve;
          });
          return { sessionId: "test-session-id", citations: [] };
        }
        if (onChunk) {
          onChunk("Second response");
        }
        return { sessionId: "test-session-id", citations: [] };
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "First");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("is-bot-typing")).toHaveTextContent("false");
      });

      userEvent.clear(input);
      userEvent.type(input, "Second");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockAskQuestion).toHaveBeenCalledTimes(2);
      });

      if (firstResolve) {
        firstResolve();
      }

      await waitFor(
        () => {
          const messages = getByTestId("messages");
          expect(messages.textContent).toContain("Second response");
        },
        { timeout: 2000 }
      );
    });

    it("should add citations to bot message when citations are provided", async () => {
      const mockCitation: ChatCitation = {
        documentName: "Test Citation",
        documentLink: "https://example.com",
      };

      mockAskQuestion.mockImplementation(async ({ onChunk, onCitation }) => {
        if (onChunk) {
          onChunk("Response with citation");
        }
        if (onCitation) {
          onCitation(mockCitation);
        }
        return { sessionId: "test-session-id", citations: [mockCitation] };
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        const messages = getByTestId("messages");
        expect(messages.textContent).toContain("Test Citation");
      });
    });

    it("should handle multiple citations", async () => {
      const citations: ChatCitation[] = [
        { documentName: "Citation 1", documentLink: "https://example.com/1" },
        { documentName: "Citation 2", documentLink: "https://example.com/2" },
      ];

      mockAskQuestion.mockImplementation(async ({ onChunk, onCitation }) => {
        if (onChunk) {
          onChunk("Response");
        }
        if (onCitation) {
          citations.forEach((c) => onCitation(c));
        }
        return { sessionId: "test-session-id", citations };
      });

      const { getByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        const messages = getByTestId("messages");
        expect(messages.textContent).toContain("Citation 1");
        expect(messages.textContent).toContain("Citation 2");
      });
    });

    it("should not add citations block when no citations provided", async () => {
      mockAskQuestion.mockImplementation(async ({ onChunk }) => {
        if (onChunk) {
          onChunk("Response without citations");
        }
        return { sessionId: "test-session-id", citations: [] };
      });

      const { getByTestId, queryByTestId } = await renderWithProvider();

      const input = getByTestId("input-value");
      userEvent.type(input, "Test");

      const sendButton = getByTestId("send-button");
      userEvent.click(sendButton);

      await waitFor(() => {
        expect(getByTestId("messages-count")).toHaveTextContent("3");
      });

      const messagesContainer = getByTestId("messages");
      const botMessages = messagesContainer.querySelectorAll('[data-sender="bot"]');
      const lastBotMessage = botMessages[botMessages.length - 1];
      expect(lastBotMessage?.getAttribute("data-citations")).toBe("0");
      expect(queryByTestId(/^citations-/)).not.toBeInTheDocument();
    });
  });

  it("should throw error when used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestParent />)).toThrow(
      "useChatConversationContext must be used within ChatConversationProvider"
    );

    consoleError.mockRestore();
  });
});
