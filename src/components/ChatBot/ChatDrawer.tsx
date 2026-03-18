import CloseIcon from "@mui/icons-material/Close";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import { Button, IconButton, Paper, Typography, styled } from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  width: "100% !important",
  height: "100% !important",
  display: "flex !important",
  flexDirection: "column !important" as never,
  boxShadow: "none !important",
  overflow: "hidden !important",
  backgroundColor: "transparent !important",
  border: "0 !important",
  borderRadius: "0 !important",
  margin: "0 !important",
  padding: "0 !important",
  gap: "0 !important",
  '&[data-expanded="true"]': {
    borderLeft: "2px solid #2982D7 !important",
  },
});

const StyledChatHeader = styled("div")({
  display: "flex !important",
  alignItems: "center !important",
  justifyContent: "flex-end !important",
  padding: "0 12px 0 0 !important",
  margin: "0 !important",
  backgroundColor: "transparent !important",
  lineHeight: "0 !important",
  fontSize: "0 !important",
  color: "white",
  zIndex: 3,
  '&[data-expanded="true"]': {
    position: "absolute",
    top: 0,
    right: 20,
    padding: "0 !important",
    zIndex: 4,
    cursor: "default",
  },
  '&[data-fullscreen="true"]': {
    position: "absolute",
    top: 0,
    right: 35,
    padding: "0 !important",
    zIndex: 4,
    cursor: "default",
  },
});

const StyledHeaderActions = styled("div")({
  boxSizing: "border-box !important" as never,
  display: "flex !important",
  flexDirection: "row !important" as never,
  justifyContent: "space-between !important",
  alignItems: "center !important",
  padding: "0 10px !important",
  margin: "0 !important",
  gap: "15px !important",
  height: "21px !important",
  backgroundColor: "#034AA3 !important",
  borderWidth: "0.75px 0.75px 0px 0.75px !important",
  borderStyle: "solid !important",
  borderColor: "#FFFFFF !important",
  borderRadius: "8px 8px 0 0 !important",
  '&[data-expanded="true"], &[data-fullscreen="true"]': {
    borderWidth: "0px 0.75px 0.75px 0.75px !important",
    borderRadius: "0 0 8px 8px !important",
  },
});

const StyledChatBody = styled("div")({
  flex: "1 !important",
  display: "flex !important",
  flexDirection: "column !important" as never,
  overflow: "hidden !important",
  position: "relative !important" as never,
  minHeight: "0 !important",
  margin: "0 !important",
  padding: "0 !important",
  borderRadius: "0 0 8px 8px !important",
  '&[data-expanded="true"], &[data-fullscreen="true"]': {
    borderRadius: "0 !important",
  },
});

const ConfirmOverlay = styled("div")({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "18px 36px !important",
  backgroundColor: "#E3E9F2 !important",
  border: "2px solid #2982D7 !important",
  borderRadius: "10px !important",
  zIndex: 3,
  '&[data-fullscreen="true"], &[data-expanded="true"]': {
    border: "none !important",
    borderRadius: "0 !important",
  },
});

const ConfirmTitle = styled(Typography)({
  fontFamily: "Inter !important",
  fontStyle: "normal",
  fontWeight: "500 !important",
  fontSize: "15px !important",
  lineHeight: "22px !important",
  textAlign: "center !important" as never,
  color: "#334B5A !important",
  marginTop: "30px !important",
});

const ConfirmActions = styled("div")({
  display: "flex",
  gap: "12px !important",
  justifyContent: "center !important",
  marginTop: "30px !important",
});

const StyledBaseButton = styled(Button)({
  fontFamily: "Nunito, sans-serif !important",
  fontSize: "0.875rem !important",
  lineHeight: "1.75 !important",
  letterSpacing: "normal !important",
  display: "flex !important",
  justifyContent: "center !important",
  alignItems: "center !important",
  color: "#FFF !important",
  borderRadius: "8px !important",
  textTransform: "none !important" as never,
  textAlign: "center !important" as never,
  zIndex: 3,
  "&.Mui-disabled": {
    "&.MuiButton-containedPrimary": {
      fontWeight: "700 !important",
      color: "#FFF !important",
      border: "1.5px solid #08596C !important",
      background: "#1A8199 !important",
      opacity: "0.4 !important",
    },
    "&.MuiButton-containedError": {
      fontWeight: "700 !important",
      color: "#FFF !important",
      border: "1.5px solid #6C2110 !important",
      background: "#B34C36 !important",
      opacity: "0.4 !important",
    },
    "&.MuiButton-containedInfo": {
      fontWeight: "700 !important",
      color: "#EDEDED !important",
      background: "#B1B1B1 !important",
      border: "1.5px solid #6B7294 !important",
    },
    "& .MuiButton-startIcon, & .MuiButton-endIcon": {
      color: "#EDEDED !important",
    },
  },
  "&.MuiButton-containedInfo": {
    color: "#000 !important",
  },
  "& .MuiButton-startIcon": {
    position: "absolute !important" as never,
    left: "11px !important",
    color: "#6B7294 !important",
  },
  "& .MuiButton-endIcon": {
    position: "absolute !important" as never,
    right: "11px !important",
    color: "#6B7294 !important",
  },
});

const StyledPrimaryButton = styled(StyledBaseButton)({
  border: "1.5px solid #08596C !important",
  fontWeight: "700 !important",
  background: "#1A8199 !important",
  "&:hover": {
    border: "1.5px solid #08596C !important",
    background: "#1A8199 !important",
    backgroundImage: "linear-gradient(rgb(0 0 0/15%) 0 0) !important",
  },
});

const StyledInfoButton = styled(StyledBaseButton)({
  border: "1.5px solid #6B7294 !important",
  fontWeight: "700 !important",
  background: "white !important",
  "&:hover": {
    border: "1.5px solid #6B7294 !important",
    background: "#C0DAF3 !important",
  },
});

const StyledIconButton = styled(IconButton)({
  color: "white !important",
  padding: "0 !important",
  margin: "0 auto !important",
  flex: "none !important",
  flexGrow: 0,
});

const DrawerViewIconButton = styled(StyledIconButton)({
  "& svg": {
    width: "16px !important",
    height: "16px !important",
  },
});

const FullScreenIconButton = styled(StyledIconButton)({
  "& svg": {
    width: "11px !important",
    height: "11px !important",
  },
});

const MinimizeIconButton = styled(StyledIconButton)({
  "& svg": {
    width: "15px !important",
    height: "15px !important",
  },
});

const CloseIconButton = styled(StyledIconButton)({
  "& svg": {
    width: "15px !important",
    height: "15px !important",
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

  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const handleResize = useCallback(() => {
    setViewportSize({ width: window.innerWidth, height: window.innerHeight });
  }, []);

  useEffect(() => {
    if (!isFullscreen && !isExpanded) {
      return undefined;
    }

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [isFullscreen, isExpanded, handleResize]);

  const rndPosition = useMemo(
    () => (isFullscreen ? { x: 0, y: 0 } : { x, y }),
    [isFullscreen, x, y]
  );

  const rndSize = useMemo<{ width: number; height: number }>(() => {
    if (isFullscreen) {
      return { width: viewportSize.width, height: viewportSize.height };
    }
    if (isExpanded) {
      return {
        width: Math.max(chatConfig.width.expanded, chatConfig.width.min),
        height: viewportSize.height,
      };
    }

    return { width: widthPx, height: heightPx };
  }, [isFullscreen, isExpanded, widthPx, heightPx, viewportSize]);

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
          id="chat-drawer"
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

          <StyledChatBody id="chat-body" {...dataAttrs}>
            {!disableInteraction && (
              <StyledDraggableBorder
                edge="top"
                className="rnd-drag-handle"
                aria-label="Drag to move"
              />
            )}
            {children}

            {isConfirmingEndConversation ? (
              <ConfirmOverlay role="alertdialog" aria-label="End Conversation" {...dataAttrs}>
                <ChatBotLogo ariaLabel="CRDC Assistant Logo" variant="square" />
                <ConfirmTitle>End Conversation</ConfirmTitle>

                <ConfirmActions>
                  <StyledPrimaryButton
                    variant="contained"
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmEndConversation();
                    }}
                    aria-label="Yes"
                  >
                    Yes
                  </StyledPrimaryButton>

                  <StyledInfoButton
                    variant="contained"
                    color="info"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelEndConversation();
                    }}
                    aria-label="No"
                  >
                    No
                  </StyledInfoButton>
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
