import { Container, Stack, styled } from "@mui/material";
import React from "react";

import { useFloatingWindowContext } from "@/components/FloatingWindow";

const StyledStack = styled(Stack, {
  shouldForwardProp: (prop) => prop !== "isExpanded" && prop !== "isFullscreen",
})<{ isExpanded?: boolean; isFullscreen?: boolean }>(({ isExpanded, isFullscreen }) => ({
  height: "100% !important",
  background: "rgba(255, 255, 255, 0.75) !important",
  border: "2px solid #2982D7 !important",
  boxShadow: "0px 4px 4px rgba(0, 0, 0, 0.45) !important",
  backdropFilter: "blur(10px) !important",
  borderRadius: "10px !important",
  overflow: "hidden !important",

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

export type Props = {
  children: React.ReactNode;
};

/**
 * The panel for a conversation with fullscreen support.
 */
const ConversationPanel = ({ children }: Props): JSX.Element => {
  const { isExpanded, isFullscreen } = useFloatingWindowContext();

  return (
    <StyledStack direction="column" isExpanded={isExpanded} isFullscreen={isFullscreen}>
      {isFullscreen ? (
        <StyledContainer maxWidth="md" isFullscreen={isFullscreen}>
          {children}
        </StyledContainer>
      ) : (
        children
      )}
    </StyledStack>
  );
};

export default React.memo<Props>(ConversationPanel);
