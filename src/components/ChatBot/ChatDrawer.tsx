import CloseIcon from "@mui/icons-material/Close";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import { Button, IconButton, Paper, Typography, styled } from "@mui/material";
import React, { useMemo } from "react";
import { Rnd } from "react-rnd";

import DraggableHandleSvg from "./assets/draggable-handle.svg?react";
import DrawerViewIcon from "./assets/drawer-view-icon.svg?react";
import ExitFullScreenIcon from "./assets/exit-full-screen-icon.svg?react";
import FullScreenIcon from "./assets/full-screen-icon.svg?react";
import ChatBotLogo from "./components/ChatBotLogo";
import chatConfig from "./config/chatConfig";
import { useChatDrawerContext } from "./context/ChatDrawerContext";

const StyledChatDrawer = styled(Paper)({
  position: "relative",
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  boxShadow: "none",
  overflow: "hidden",
  backgroundColor: "transparent",
  border: 0,
  '&[data-expanded="true"]': {
    borderLeft: "2px solid #2982D7",
  },
});

const StyledChatHeader = styled("div")({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: "0 12px 0 0",
  backgroundColor: "transparent",
  color: "white",
  '&[data-expanded="true"]': {
    position: "absolute",
    top: 0,
    right: 20,
    padding: 0,
    zIndex: 2,
    cursor: "default",
  },
  '&[data-fullscreen="true"]': {
    position: "absolute",
    top: 0,
    right: 35,
    padding: 0,
    zIndex: 2,
    cursor: "default",
  },
});

const StyledHeaderActions = styled("div")({
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 10px",
  gap: "15px",
  height: "21px",
  backgroundColor: "#034AA3",
  borderWidth: "0.75px 0.75px 0px 0.75px",
  borderStyle: "solid",
  borderColor: "#FFFFFF",
  borderRadius: "8px 8px 0 0",
  '&[data-expanded="true"], &[data-fullscreen="true"]': {
    borderWidth: "0px 0.75px 0.75px 0.75px",
    borderRadius: "0 0 8px 8px",
  },
});

const StyledChatBody = styled("div")({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  position: "relative",
  minHeight: 0,
  borderRadius: "8px",
  '&[data-expanded="true"], &[data-fullscreen="true"]': {
    borderRadius: 0,
  },
});

const ConfirmOverlay = styled("div")({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "18px 36px",
  backgroundColor: "#E3E9F2",
  border: "2px solid #2982D7",
  borderRadius: "10px",
  zIndex: 1,
});

const ConfirmTitle = styled(Typography)({
  fontFamily: "Inter",
  fontStyle: "normal",
  fontWeight: 500,
  fontSize: "15px",
  lineHeight: "22px",
  textAlign: "center",
  color: "#334B5A",
  marginTop: "30px",
});

const ConfirmActions = styled("div")({
  display: "flex",
  gap: 12,
  justifyContent: "center",
  marginTop: "30px",
});

const StyledIconButton = styled(IconButton)({
  color: "white",
  padding: 0,
  margin: "0 auto",
  flex: "none",
  flexGrow: 0,
});

const DrawerViewIconButton = styled(StyledIconButton)({
  "& svg": {
    width: "16px",
    height: "16px",
  },
});

const FullScreenIconButton = styled(StyledIconButton)({
  "& svg": {
    width: "11px",
    height: "11px",
  },
});

const MinimizeIconButton = styled(StyledIconButton)({
  "& svg": {
    width: "15px",
    height: "15px",
  },
});

const CloseIconButton = styled(StyledIconButton)({
  "& svg": {
    width: "15px",
    height: "15px",
  },
});

const StyledRndContainer = styled("div")({
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 12000,
});

const StyledDraggableBorder = styled("div", {
  shouldForwardProp: (prop) => prop !== "edge",
})<{ edge: "top" | "right" | "bottom" | "left" }>(({ edge }) => ({
  position: "absolute",
  zIndex: 2,
  background: "transparent",
  cursor: "move",
  touchAction: "none",
  ...(edge === "top" && { top: 0, left: 0, right: 0, height: 10 }),
  ...(edge === "right" && { top: 21, right: 0, bottom: 0, width: 10 }),
  ...(edge === "bottom" && { bottom: 0, left: 0, right: 0, height: 10 }),
  ...(edge === "left" && { top: 21, left: 0, bottom: 0, width: 10 }),
}));

export type Props = {
  /**
   * Child content rendered in the drawer body.
   */
  children: React.ReactNode;
};

/**
 * ChatDrawer component provides a resizable, draggable chat interface with fullscreen and minimize capabilities.
 */
const ChatDrawer = ({ children }: Props): JSX.Element => {
  const {
    drawerRef,
    heightPx,
    widthPx,
    x,
    y,
    isExpanded,
    isMinimized,
    isFullscreen,
    onToggleExpand,
    onToggleFullscreen,
    onMinimize,
    onDragStop,
    onResizeStop,
    isConfirmingEndConversation,
    onRequestEndConversation,
    onConfirmEndConversation,
    onCancelEndConversation,
  } = useChatDrawerContext();

  const rndPosition = useMemo(
    () => (isFullscreen ? { x: 0, y: 0 } : { x, y }),
    [isFullscreen, x, y]
  );

  const rndSize = useMemo<{ width: number; height: number }>(() => {
    if (isFullscreen) {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    if (isExpanded) {
      return { width: chatConfig.width.expanded, height: window.innerHeight };
    }

    return { width: widthPx, height: heightPx };
  }, [isFullscreen, isExpanded, widthPx, heightPx]);

  const disableInteraction = useMemo(
    () => isExpanded || isFullscreen || isMinimized,
    [isExpanded, isFullscreen, isMinimized]
  );

  const dataAttrs = useMemo(
    () => ({
      "data-minimized": String(isMinimized),
      "data-expanded": String(isExpanded),
      "data-fullscreen": String(isFullscreen),
    }),
    [isMinimized, isExpanded, isFullscreen]
  );

  return (
    <StyledRndContainer>
      <Rnd
        position={rndPosition}
        size={rndSize}
        onDragStart={(e) => {
          e.preventDefault();
        }}
        onDragStop={onDragStop}
        onResizeStop={onResizeStop}
        minWidth={chatConfig.width.min}
        minHeight={chatConfig.height.min}
        enableResizing={disableInteraction ? false : { topLeft: true }}
        disableDragging={disableInteraction}
        dragHandleClassName="rnd-drag-handle"
        cancel="button"
        bounds="parent"
        resizeHandleStyles={disableInteraction ? undefined : { topLeft: { top: 25, left: 8 } }}
        resizeHandleComponent={
          disableInteraction
            ? undefined
            : {
                topLeft: (
                  <DraggableHandleSvg
                    width={13}
                    height={13}
                    viewBox="5.5 5.5 12.5 12.5"
                    aria-label="Resize handle"
                    style={{ cursor: "nwse-resize" }}
                  />
                ),
              }
        }
        style={{
          opacity: isMinimized ? 0 : 1,
          pointerEvents: isMinimized ? "none" : "auto",
        }}
      >
        <StyledChatDrawer
          ref={drawerRef}
          {...dataAttrs}
          aria-hidden={isMinimized ? "true" : "false"}
        >
          {!disableInteraction && (
            <>
              <StyledDraggableBorder
                edge="right"
                className="rnd-drag-handle"
                aria-label="Drag to move"
              />
              <StyledDraggableBorder
                edge="bottom"
                className="rnd-drag-handle"
                aria-label="Drag to move"
              />
              <StyledDraggableBorder
                edge="left"
                className="rnd-drag-handle"
                aria-label="Drag to move"
              />
            </>
          )}
          <StyledChatHeader {...dataAttrs}>
            <StyledHeaderActions {...dataAttrs}>
              <DrawerViewIconButton
                size="small"
                onClick={onToggleExpand}
                aria-label={isExpanded ? "Collapse chat drawer" : "Expand chat drawer"}
              >
                <DrawerViewIcon />
              </DrawerViewIconButton>
              <FullScreenIconButton
                size="small"
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
              >
                {isFullscreen ? <ExitFullScreenIcon /> : <FullScreenIcon />}
              </FullScreenIconButton>
              <MinimizeIconButton size="small" onClick={onMinimize} aria-label="Minimize chat">
                <HorizontalRuleIcon />
              </MinimizeIconButton>
              <CloseIconButton
                size="small"
                onClick={onRequestEndConversation}
                aria-label="End conversation"
              >
                <CloseIcon />
              </CloseIconButton>
            </StyledHeaderActions>
          </StyledChatHeader>

          <StyledChatBody {...dataAttrs}>
            {!disableInteraction && (
              <StyledDraggableBorder
                edge="top"
                className="rnd-drag-handle"
                aria-label="Drag to move"
              />
            )}
            {children}

            {isConfirmingEndConversation ? (
              <ConfirmOverlay role="alertdialog" aria-label="End Conversation">
                <ChatBotLogo ariaLabel="CRDC Assistant Logo" />
                <ConfirmTitle>End Conversation</ConfirmTitle>

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
      </Rnd>
    </StyledRndContainer>
  );
};

export default React.memo(ChatDrawer);
