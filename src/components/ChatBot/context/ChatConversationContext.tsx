import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import { askQuestion } from "../api/knowledgeBaseClient";
import chatConfig from "../config/chatConfig";
import { createChatMessage, createId, isAbortError } from "../utils/chatUtils";
import {
  clearConversationMessages,
  getStoredConversationMessages,
  storeConversationMessages,
} from "../utils/conversationStorageUtils";
import { clearStoredSessionId, getStoredSessionId } from "../utils/sessionStorageUtils";

import { useChatBotContext } from "./ChatBotContext";

type ChatState = {
  messages: ChatMessage[];
  inputValue: string;
  status: ChatStatus;
  isInitialized: boolean;
};

type ChatAction =
  | { type: "input_changed"; value: string }
  | { type: "input_cleared" }
  | { type: "message_added"; message: ChatMessage }
  | { type: "status_changed"; status: ChatStatus }
  | { type: "conversation_reset" }
  | { type: "chat_initialized"; messages: ChatMessage[] };

export type ChatConversationActions = {
  greetingTimestamp: Date;
  messages: ChatMessage[];
  inputValue: string;
  isBotTyping: boolean;
  setInputValue: (value: string) => void;
  sendMessage: (messageText?: string) => void;
  handleKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  endConversation: () => void;
};

/**
 * Creates the initial greeting message for the chat.
 */
const createGreetingMessage = (): ChatMessage =>
  createChatMessage({
    text: chatConfig.initialMessage,
    sender: "bot",
    senderName: chatConfig.supportBotName,
  });

/**
 * Chat reducer to manage chat state transitions.
 *
 * @param state - The current chat state
 * @param action - The Action to process
 * @returns The updated chat state
 */
export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case "input_changed": {
      return { ...state, inputValue: action.value };
    }
    case "input_cleared": {
      return { ...state, inputValue: "" };
    }
    case "message_added": {
      const existingIndex = state.messages.findIndex((msg) => msg.id === action.message.id);
      if (existingIndex !== -1) {
        const updatedMessages = [...state.messages];
        updatedMessages[existingIndex] = action.message;
        return { ...state, messages: updatedMessages };
      }

      return { ...state, messages: [...state.messages, action.message] };
    }
    case "status_changed": {
      return { ...state, status: action.status };
    }
    case "conversation_reset": {
      return {
        messages: [],
        inputValue: "",
        status: "idle",
        isInitialized: true,
      };
    }
    case "chat_initialized": {
      return {
        ...state,
        messages: action.messages,
        isInitialized: true,
      };
    }
    default: {
      return state;
    }
  }
};

/**
 * Custom hook to manage chat conversation state and behavior.
 *
 * @returns {ChatConversationActions} An object containing chat state and action handlers.
 */
const useChatConversation = (): ChatConversationActions => {
  const { knowledgeBaseUrl } = useChatBotContext();
  const greetingTimestampRef = useRef<Date>(new Date());

  const [state, dispatch] = useReducer(chatReducer, {
    messages: [],
    inputValue: "",
    status: "idle",
    isInitialized: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * Initializes the chat by loading conversation history from IndexedDB.
   */
  const initializeChat = useCallback(async () => {
    const storedMessages = await getStoredConversationMessages();
    const messages = [createGreetingMessage(), ...storedMessages];
    dispatch({ type: "chat_initialized", messages });
  }, []);

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  useEffect(() => {
    if (state.isInitialized && state.messages.length > 0) {
      storeConversationMessages(state.messages.slice(1));
    }
  }, [state.messages, state.isInitialized]);

  const activeRequestRef = useRef<{
    requestId: string;
    abortController: AbortController;
  } | null>(null);

  useEffect(
    () => () => {
      activeRequestRef.current?.abortController.abort();
      activeRequestRef.current = null;
    },
    []
  );

  /**
   * Handles errors that occur during bot reply requests.
   */
  const handleReplyError = useCallback((error: unknown, requestId: string): void => {
    const active = activeRequestRef.current;
    if (!active || active.requestId !== requestId) {
      return;
    }

    if (active.abortController.signal.aborted || isAbortError(error)) {
      return;
    }

    dispatch({
      type: "message_added",
      message: createChatMessage({
        text: "Sorry, an unexpected error occurred. Please try again later.",
        sender: "bot",
        senderName: chatConfig.supportBotName,
        variant: "error",
      }),
    });

    dispatch({ type: "status_changed", status: "idle" });
  }, []);

  /**
   * Builds conversation history from messages for the API request.
   * Excludes the initial greeting message.
   */
  const buildConversationHistory = useCallback(
    (messages: ChatMessage[]): ConversationHistory[] =>
      messages.slice(1).map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      })),
    []
  );

  /**
   * Executes the bot reply request with streaming support.
   */
  const runReply = useCallback(
    async (
      userMessage: string,
      requestId: string,
      abortController: AbortController
    ): Promise<void> => {
      try {
        const botMessageId = createId("bot_msg_");
        let accumulatedText = "";
        const allCitations: ChatCitation[] = [];
        let firstChunkReceived = false;
        const conversationHistory = buildConversationHistory(stateRef.current.messages);

        await askQuestion({
          question: userMessage,
          sessionId: getStoredSessionId(),
          conversationHistory,
          signal: abortController.signal,
          url: knowledgeBaseUrl,
          onChunk: (chunk: string) => {
            if (!firstChunkReceived) {
              dispatch({ type: "status_changed", status: "idle" });
              firstChunkReceived = true;
            }

            accumulatedText += chunk;
            dispatch({
              type: "message_added",
              message: createChatMessage({
                id: botMessageId,
                text: accumulatedText,
                sender: "bot",
                senderName: chatConfig.supportBotName,
              }),
            });
          },
          onCitation: (citation) => {
            allCitations?.push(citation);
          },
        });

        const active = activeRequestRef.current;
        if (!active || active.requestId !== requestId || active.abortController.signal.aborted) {
          return;
        }

        // Add citations to existing bot message if they exist
        if (allCitations?.length > 0) {
          dispatch({
            type: "message_added",
            message: createChatMessage({
              id: botMessageId,
              text: accumulatedText,
              sender: "bot",
              senderName: chatConfig.supportBotName,
              citations: allCitations,
            }),
          });
        }

        dispatch({ type: "status_changed", status: "idle" });
      } catch (error) {
        handleReplyError(error, requestId);
      }
    },
    [knowledgeBaseUrl, handleReplyError, buildConversationHistory]
  );

  /**
   * Updates the input field value in the chat state.
   */
  const setInputValue = useCallback((value: string): void => {
    dispatch({ type: "input_changed", value });
  }, []);

  /**
   * Sends the current input message to the bot.
   * @param messageText - Optional message text to send directly (bypasses input field)
   */
  const sendMessage = useCallback(
    (messageText?: string): void => {
      const { current } = stateRef;
      const text = typeof messageText === "string" ? messageText.trim() : "";
      const value = text || current.inputValue?.trim();

      if (!value) {
        return;
      }

      if (current.status === "bot_typing") {
        return;
      }

      if (current.messages.length === 0) {
        dispatch({
          type: "message_added",
          message: createGreetingMessage(),
        });
      }

      dispatch({
        type: "message_added",
        message: createChatMessage({
          text: value,
          sender: "user",
          senderName: chatConfig.userDisplayName,
        }),
      });

      if (!text) {
        dispatch({ type: "input_cleared" });
      }
      dispatch({ type: "status_changed", status: "bot_typing" });

      activeRequestRef.current?.abortController.abort();

      const abortController = new AbortController();
      const requestId = createId("bot_reply_");
      activeRequestRef.current = { requestId, abortController };

      runReply(value, requestId, abortController).catch((error: unknown) => {
        if (!isAbortError(error)) {
          dispatch({ type: "status_changed", status: "idle" });
        }
      });
    },
    [runReply]
  );

  /**
   * Handles keyboard events in the chat input.
   */
  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (event.key !== "Enter") {
        return;
      }

      if (event.shiftKey) {
        return;
      }

      event.preventDefault();
      sendMessage();
    },
    [sendMessage]
  );

  /**
   * Ends the current conversation and resets to initial state.
   */
  const endConversation = useCallback((): void => {
    clearStoredSessionId();
    clearConversationMessages();
    activeRequestRef.current?.abortController.abort();
    activeRequestRef.current = null;
    greetingTimestampRef.current = new Date();
    dispatch({ type: "conversation_reset" });
  }, []);

  return {
    greetingTimestamp: greetingTimestampRef.current,
    messages: state.messages,
    inputValue: state.inputValue,
    isBotTyping: state.status === "bot_typing",
    setInputValue,
    sendMessage,
    handleKeyDown,
    endConversation,
  };
};

type ChatConversationContextValue = ChatConversationActions;

const ChatConversationContext = createContext<ChatConversationContextValue | null>(null);

export const useChatConversationContext = (): ChatConversationContextValue => {
  const context = useContext(ChatConversationContext);

  if (!context) {
    throw new Error("useChatConversationContext must be used within ChatConversationProvider");
  }

  return context;
};

export type ChatConversationProviderProps = {
  children: React.ReactNode;
};

export const ChatConversationProvider: React.FC<ChatConversationProviderProps> = ({ children }) => {
  const conversationHook = useChatConversation();

  const value = useMemo<ChatConversationContextValue>(() => conversationHook, [conversationHook]);

  return (
    <ChatConversationContext.Provider value={value}>{children}</ChatConversationContext.Provider>
  );
};
