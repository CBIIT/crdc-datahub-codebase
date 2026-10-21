import { Box, styled } from "@mui/material";
import React, { useEffect, useRef } from "react";

import { useFloatingWindowContext } from "@/components/FloatingWindow";

const MessagesContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== "isExpanded" && prop !== "isFullscreen",
})<{ isExpanded?: boolean; isFullscreen?: boolean }>(({ isExpanded, isFullscreen }) => ({
  flex: isFullscreen ? "none" : 1,
  overflowY: isFullscreen ? "visible" : "auto",
  paddingInline: "24.5px",
  paddingTop: isExpanded ? "25px" : 0,
  marginTop: 0,
  marginRight: isFullscreen ? 0 : "10px",
  overscrollBehavior: "contain",
  ...(!isFullscreen && {
    "&::-webkit-scrollbar": {
      width: "7px",
    },
    "&::-webkit-scrollbar-track": {
      background: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      background: "#7C7C7C",
      borderRadius: "4px",
    },
  }),
}));

export type Props = {
  /**
   * Values that trigger a smooth scroll to the bottom when they change.
   */
  scrollDependencies: React.DependencyList;
  /**
   * The list content.
   */
  children?: React.ReactNode;
};

/**
 * Scrollable message container that keeps the latest content in view.
 */
const MessageList = ({ scrollDependencies, children }: Props): JSX.Element => {
  const { isExpanded, isFullscreen } = useFloatingWindowContext();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Gets the current scroll container based on view mode.
   */
  const getScrollContainer = (): HTMLElement | null => {
    const element = messagesContainerRef.current;
    if (!element) {
      return null;
    }

    if (isFullscreen) {
      return element.parentElement?.parentElement ?? null;
    }
    return element;
  };

  useEffect(() => {
    const container = getScrollContainer();
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [isFullscreen, isExpanded]);

  useEffect(() => {
    const container = getScrollContainer();
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, scrollDependencies);

  return (
    <MessagesContainer
      ref={messagesContainerRef}
      isExpanded={isExpanded}
      isFullscreen={isFullscreen}
    >
      {children}
    </MessagesContainer>
  );
};

export default React.memo<Props>(MessageList);
