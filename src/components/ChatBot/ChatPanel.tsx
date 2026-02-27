import { Container, Stack, styled } from "@mui/material";
import React, { useCallback, useMemo } from "react";

import DraggableHandleSvg from "./assets/draggable-handle.svg?react";
import { useChatConversationContext } from "./context/ChatConversationContext";
import { useChatDrawerContext } from "./context/ChatDrawerContext";
import ChatComposer from "./panel/ChatComposer";
import MessageList from "./panel/MessageList";

const StyledStack = styled(Stack, {
  shouldForwardProp: (prop) => prop !== "isExpanded" && prop !== "isFullscreen",
})<{ isExpanded?: boolean; isFullscreen?: boolean }>(({ isExpanded, isFullscreen }) => ({
  height: "100%",
  background: "rgba(255, 255, 255, 0.75)",
  border: "2px solid #2982D7",
  boxShadow: "0px 4px 4px rgba(0, 0, 0, 0.45)",
  backdropFilter: "blur(10px)",
  borderRadius: "10px",
  overflow: "hidden",

  position: "relative",
  ...(isExpanded && {
    background: "#FFFFFF",
    backdropFilter: "none",
    borderRadius: 0,
    border: "none",
    boxShadow: "none",
  }),
  ...(isFullscreen && {
    background: "linear-gradient(180deg, #FFFFFF 0%, #C9E5F8 100%)",
    backdropFilter: "none",
    borderRadius: 0,
    border: "none",
    boxShadow: "none",
    overflow: "auto",
  }),
}));

const StyledContainer = styled(Container, {
  shouldForwardProp: (prop) => prop !== "isFullscreen",
})<{ isFullscreen?: boolean }>(({ isFullscreen }) => ({
  height: isFullscreen ? "auto" : "100%",
  minHeight: isFullscreen ? "100%" : undefined,
  display: "flex",
  flexDirection: "column",
  background: "transparent",
}));

const StyledDragHandleContainer = styled("div")({
  position: "absolute",
  top: 7,
  left: 8,
  width: "13px",
  height: "13px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "nwse-resize",
  zIndex: 1,
  background: "transparent",
});

const StyledDragHandleIcon = styled(DraggableHandleSvg)({
  width: "13px",
  height: "13px",
});

/**
 * Invisible draggable border element for moving the chat panel.
 * The border width matches the visible border (2px).
 */
const StyledDraggableBorder = styled("div")<{ edge: "top" | "right" | "bottom" | "left" }>(
  {
    position: "absolute",
    zIndex: 2,
    background: "transparent",
    variants: [],
  },
  ({ edge }) => {
    const borderWidth = 8;
    const cornerSize = 20;

    switch (edge) {
      case "top":
        return {
          top: 0,
          left: cornerSize,
          right: 0,
          height: borderWidth,
          cursor: "move",
        };
      case "right":
        return {
          top: 0,
          right: 0,
          bottom: 0,
          width: borderWidth,
          cursor: "move",
        };
      case "bottom":
        return {
          bottom: 0,
          left: 0,
          right: 0,
          height: borderWidth,
          cursor: "move",
        };
      case "left":
        return {
          top: cornerSize,
          left: 0,
          bottom: 0,
          width: borderWidth,
          cursor: "move",
        };
      default:
        return {};
    }
  }
);

/**
 * Renders the main chat interface with message history and user input composer.
 */
const ChatPanel = (): JSX.Element => {
  const { isExpanded, isFullscreen, onBeginResize, onBeginMove } = useChatDrawerContext();
  const { messages, inputValue, isBotTyping, setInputValue, sendMessage, handleKeyDown } =
    useChatConversationContext();

  /**
   * Determines if the send button should be disabled based on input state and bot typing status.
   */
  const isSendDisabled = useMemo((): boolean => {
    if (isBotTyping) {
      return true;
    }

    return inputValue?.trim()?.length === 0;
  }, [inputValue, isBotTyping]);

  /**
   * Handles input value changes and updates the state.
   */
  const handleValueChange = useCallback(
    (value: string): void => setInputValue(value),
    [setInputValue]
  );

  const content = (
    <>
      <MessageList messages={messages} isBotTyping={isBotTyping} onQuestionClick={sendMessage} />
      <ChatComposer
        value={inputValue}
        onChange={handleValueChange}
        onSend={sendMessage}
        onKeyDown={handleKeyDown}
        isSendDisabled={isSendDisabled}
      />
    </>
  );

  return (
    <StyledStack direction="column" isExpanded={isExpanded} isFullscreen={isFullscreen}>
      {!isExpanded && !isFullscreen ? (
        <>
          <StyledDragHandleContainer onPointerDown={onBeginResize}>
            <StyledDragHandleIcon viewBox="5.5 5.5 12.5 12.5" aria-label="Resize handle" />
          </StyledDragHandleContainer>
          <StyledDraggableBorder edge="top" onPointerDown={onBeginMove} aria-label="Drag to move" />
          <StyledDraggableBorder
            edge="right"
            onPointerDown={onBeginMove}
            aria-label="Drag to move"
          />
          <StyledDraggableBorder
            edge="bottom"
            onPointerDown={onBeginMove}
            aria-label="Drag to move"
          />
          <StyledDraggableBorder
            edge="left"
            onPointerDown={onBeginMove}
            aria-label="Drag to move"
          />
        </>
      ) : null}
      {isFullscreen ? (
        <StyledContainer maxWidth="md" isFullscreen={isFullscreen}>
          {content}
        </StyledContainer>
      ) : (
        content
      )}
    </StyledStack>
  );
};

export default React.memo(ChatPanel);
