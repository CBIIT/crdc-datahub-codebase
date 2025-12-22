import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import { Button, IconButton, Paper, Typography, styled } from "@mui/material";
import React from "react";

const StyledChatDrawer = styled(Paper, {
  shouldForwardProp: (prop) => prop !== "heightPx",
})<{ heightPx: number }>(({ heightPx }) => ({
  position: "fixed",
  right: 0,
  bottom: 0,
  width: "384px",
  height: heightPx,
  borderRadius: "24px 0 0 0",
  zIndex: 12000,
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
  overflow: "hidden",
  backgroundColor: "#ffffff",
  border: 0,
  opacity: 1,
  pointerEvents: "auto",
  '&[data-minimized="true"]': {
    opacity: 0,
    pointerEvents: "none",
  },

  '&[data-fullscreen="true"]': {
    inset: 0,
    width: "100%",
    height: "100%",
    borderRadius: 0,
  },
}));

const StyledChatHeaderContainer = styled("div")({
  backgroundColor: "#005EA2",
});

const StyledDragHandleContainer = styled("div")({
  height: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  paddingBlock: "12px",
  cursor: "ns-resize",
  transition: "background-color 0.2s ease-out",
  backgroundColor: "transparent",
  '&[data-dragging="true"]': {
    backgroundColor: "rgba(0,94,162,0.95)",
  },
});

const StyledDragHandleBar = styled("div")({
  width: "32px",
  height: "4px",
  borderRadius: "4px",
  backgroundColor: "white",
  transition: "opacity 0.2s ease-out, background-color 0.2s ease-out",
});

const StyledChatHeader = styled("div")({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "4px 16px",
  borderBottom: "1px solid rgba(0,0,0,0.12)",
  backgroundColor: "transparent",
  color: "white",
});

const StyledHeaderActions = styled("div")({
  display: "flex",
  gap: 0,
});

const StyledChatBody = styled("div")({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  position: "relative",
  minHeight: 0,
});

const ConfirmOverlay = styled("div")({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  padding: "24px",
  backgroundColor: "#FFFFFF",
  zIndex: 1,
});

const ConfirmActions = styled("div")({
  display: "flex",
  gap: 12,
  justifyContent: "center",
});

const StyledChatTitle = styled(Typography)({
  fontSize: "18px",
  fontWeight: 600,
  margin: 0,
});

const StyledIconButton = styled(IconButton)({
  color: "white",
});

export type Props = {
  /**
   * Height of the drawer in pixels.
   */
  heightPx: number;
  /**
   * Indicates if the drawer is currently being resized.
   */
  isDragging: boolean;
  /**
   * Indicates if the drawer content is expanded or collapsed.
   */
  isExpanded: boolean;
  /**
   * Indicates if the drawer is hidden from view.
   */
  isMinimized: boolean;
  /**
   * Indicates if the drawer is in fullscreen mode.
   */
  isFullscreen: boolean;
  /**
   * Title text displayed in the drawer header.
   */
  title: string;
  /**
   * Callback fired when user begins resizing the drawer.
   */
  onBeginResize: React.PointerEventHandler<HTMLDivElement>;
  /**
   * Callback fired when user toggles expand/collapse state.
   */
  onToggleExpand: () => void;
  /**
   * Callback fired when user toggles fullscreen mode.
   */
  onToggleFullscreen: () => void;
  /**
   * Callback fired when user minimizes the drawer.
   */
  onMinimize: () => void;

  /**
   * Indicates whether the end-conversation confirmation UI is showing.
   */
  isConfirmingEndConversation: boolean;
  /**
   * Callback fired when user clicks the close icon to start confirmation.
   */
  onRequestEndConversation: () => void;
  /**
   * Callback fired when user confirms ending the conversation.
   */
  onConfirmEndConversation: () => void;
  /**
   * Callback fired when user cancels ending the conversation.
   */
  onCancelEndConversation: () => void;

  /**
   * Child content rendered in the drawer body.
   */
  children: React.ReactNode;
};

/**
 * ChatDrawer component provides a resizable, draggable chat interface with fullscreen and minimize capabilities.
 */
const ChatDrawer = (
  {
    heightPx,
    isDragging,
    isExpanded,
    isMinimized,
    isFullscreen,
    title,
    onBeginResize,
    onToggleExpand,
    onToggleFullscreen,
    onMinimize,
    isConfirmingEndConversation,
    onRequestEndConversation,
    onConfirmEndConversation,
    onCancelEndConversation,
    children,
  }: Props,
  ref: React.ForwardedRef<HTMLDivElement>
): JSX.Element => (
  <StyledChatDrawer
    ref={ref}
    heightPx={heightPx}
    data-minimized={isMinimized ? "true" : "false"}
    data-fullscreen={isFullscreen ? "true" : "false"}
    aria-hidden={isMinimized ? "true" : "false"}
  >
    <StyledChatHeaderContainer>
      {!isFullscreen ? (
        <StyledDragHandleContainer
          onPointerDown={onBeginResize}
          data-dragging={isDragging ? "true" : "false"}
        >
          <StyledDragHandleBar />
        </StyledDragHandleContainer>
      ) : null}

      <StyledChatHeader>
        <StyledChatTitle as="h2">{title}</StyledChatTitle>

        <StyledHeaderActions>
          {!isFullscreen ? (
            <StyledIconButton
              size="small"
              onClick={onToggleExpand}
              aria-label={isExpanded ? "Collapse chat drawer" : "Expand chat drawer"}
            >
              {isExpanded ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ExpandLessIcon fontSize="small" />
              )}
            </StyledIconButton>
          ) : null}

          <StyledIconButton
            size="small"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          >
            {isFullscreen ? (
              <FullscreenExitIcon fontSize="small" />
            ) : (
              <FullscreenIcon fontSize="small" />
            )}
          </StyledIconButton>

          <StyledIconButton size="small" onClick={onMinimize} aria-label="Minimize chat">
            <HorizontalRuleIcon fontSize="small" />
          </StyledIconButton>

          <StyledIconButton
            size="small"
            onClick={onRequestEndConversation}
            aria-label="End conversation"
          >
            <CloseIcon fontSize="small" />
          </StyledIconButton>
        </StyledHeaderActions>
      </StyledChatHeader>
    </StyledChatHeaderContainer>

    <StyledChatBody>
      {children}

      {isConfirmingEndConversation ? (
        <ConfirmOverlay role="alertdialog" aria-label="End Conversation">
          <Typography variant="h6" component="div">
            End Conversation
          </Typography>

          <ConfirmActions>
            <Button
              variant="contained"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                onConfirmEndConversation();
              }}
              aria-label="Yes"
            >
              Yes
            </Button>

            <Button
              variant="contained"
              color="info"
              onClick={(e) => {
                e.stopPropagation();
                onCancelEndConversation();
              }}
              aria-label="No"
            >
              No
            </Button>
          </ConfirmActions>
        </ConfirmOverlay>
      ) : null}
    </StyledChatBody>
  </StyledChatDrawer>
);

export default React.memo(React.forwardRef<HTMLDivElement, Props>(ChatDrawer));
