import React, { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import {
  askKnowledgeBase,
  clearStoredSessionId,
  getStoredSessionId,
} from "../api/knowledgeBaseClient";
import chatConfig from "../chatConfig";
import { createChatMessage, createId, isAbortError } from "../utils/chatUtils";

type ChatState = {
  messages: ChatMessage[];
  inputValue: string;
  status: ChatStatus;
};

type ChatAction =
  | { type: "input_changed"; value: string }
  | { type: "input_cleared" }
  | { type: "message_added"; message: ChatMessage }
  | { type: "status_changed"; status: ChatStatus };

type BotReplyProvider = (userText: string, signal: AbortSignal) => Promise<string>;

type ChatConversationActions = {
  greetingTimestamp: Date;
  messages: ChatMessage[];
  inputValue: string;
  isBotTyping: boolean;
  setInputValue: (value: string) => void;
  sendMessage: () => void;
  handleKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  endConversation: () => void;
};

/**
 * Chat reducer to manage chat state transitions.
 *
 * @param state - The current chat state
 * @param action - The Action to process
 * @returns The updated chat state
 */
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case "input_changed": {
      return { ...state, inputValue: action.value };
    }
    case "input_cleared": {
      return { ...state, inputValue: "" };
    }
    case "message_added": {
      return { ...state, messages: [...state.messages, action.message] };
    }
    case "status_changed": {
      return { ...state, status: action.status };
    }
    default: {
      return state;
    }
  }
};

/**
 * Custom hook to manage chat conversation state and behavior.
 *
 * @returns An object containing chat state and action handlers.
 */
export const useChatConversation = (): ChatConversationActions => {
  const greetingTimestampRef = useRef<Date>(new Date());

  const [state, dispatch] = useReducer(chatReducer, {
    messages: [
      createChatMessage({
        text: chatConfig.initialMessage,
        sender: "bot",
        senderName: chatConfig.supportBotName,
      }),
    ],
    inputValue: "",
    status: "idle",
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const activeRequestRef = useRef<{
    requestId: string;
    abortController: AbortController;
  } | null>(null);

  const replyProvider = useMemo<BotReplyProvider>(
    () => async (userText, signal) => {
      const storedSessionId = getStoredSessionId();
      const { answer } = await askKnowledgeBase({
        question: userText,
        sessionId: storedSessionId,
        signal,
      });

      return answer;
    },
    []
  );

  useEffect(
    () => () => {
      activeRequestRef.current?.abortController.abort();
      activeRequestRef.current = null;
    },
    []
  );

  const setInputValue = useCallback((value: string): void => {
    dispatch({ type: "input_changed", value });
  }, []);

  const sendMessage = useCallback((): void => {
    const { current } = stateRef;
    const trimmed = current.inputValue.trim();

    if (!trimmed) {
      return;
    }

    if (current.status === "bot_typing") {
      return;
    }

    dispatch({
      type: "message_added",
      message: createChatMessage({
        text: trimmed,
        sender: "user",
        senderName: chatConfig.userDisplayName,
      }),
    });

    dispatch({ type: "input_cleared" });
    dispatch({ type: "status_changed", status: "bot_typing" });

    activeRequestRef.current?.abortController.abort();

    const abortController = new AbortController();
    const requestId = createId("bot_reply_");
    activeRequestRef.current = { requestId, abortController };

    const runReply = async (): Promise<void> => {
      try {
        const replyText = await replyProvider(trimmed, abortController.signal);

        const active = activeRequestRef.current;
        if (!active || active.requestId !== requestId || active.abortController.signal.aborted) {
          return;
        }

        dispatch({
          type: "message_added",
          message: createChatMessage({
            text: replyText,
            sender: "bot",
            senderName: chatConfig.supportBotName,
          }),
        });

        dispatch({ type: "status_changed", status: "idle" });
      } catch (error) {
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
      }
    };

    runReply().catch((error: unknown) => {
      if (!isAbortError(error)) {
        dispatch({ type: "status_changed", status: "idle" });
      }
    });
  }, [replyProvider]);

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

  const endConversation = useCallback((): void => {
    clearStoredSessionId();
    activeRequestRef.current?.abortController.abort();
    activeRequestRef.current = null;
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
