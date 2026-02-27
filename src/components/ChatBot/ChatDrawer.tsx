import CloseIcon from "@mui/icons-material/Close";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import { Button, IconButton, Paper, Typography, styled } from "@mui/material";
import React from "react";

import DrawerViewIcon from "./assets/drawer-view-icon.svg?react";
import ExitFullScreenIcon from "./assets/exit-full-screen-icon.svg?react";
import FullScreenIcon from "./assets/full-screen-icon.svg?react";
import ChatBotLogo from "./components/ChatBotLogo";
import chatConfig from "./config/chatConfig";
import { useChatDrawerContext } from "./context/ChatDrawerContext";

const StyledChatDrawer = styled(Paper, {
  shouldForwardProp: (prop) =>
    prop !== "heightPx" && prop !== "widthPx" && prop !== "positionX" && prop !== "positionY",
})<{ heightPx: number; widthPx: number; positionX: number; positionY: number }>(
  ({ heightPx, widthPx, positionX, positionY }) => ({
    position: "fixed",
    right: positionX,
    bottom: positionY,
    width: widthPx,
    height: heightPx,
    zIndex: 12000,
    display: "flex",
    flexDirection: "column",
    boxShadow: "none",
    overflow: "hidden",
    backgroundColor: "transparent",
    border: 0,
    opacity: 1,
    pointerEvents: "auto",
    '&[data-minimized="true"]': {
      opacity: 0,
      pointerEvents: "none",
    },

    '&[data-expanded="true"]': {
      top: 0,
      right: 0,
      bottom: 0,
      width: chatConfig.width.expanded,
      height: "100%",
      borderRadius: 0,
      borderLeft: "2px solid #2982D7",
    },

    '&[data-fullscreen="true"]': {
      inset: 0,
      width: "100%",
      height: "100%",
      borderRadius: 0,
    },
  })
);

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
  },
  '&[data-fullscreen="true"]': {
    position: "absolute",
    top: 0,
    right: 35,
    padding: 0,
    zIndex: 2,
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
    positionX,
    positionY,
    isExpanded,
    isMinimized,
    isFullscreen,
    onToggleExpand,
    onToggleFullscreen,
    onMinimize,
    isConfirmingEndConversation,
    onRequestEndConversation,
    onConfirmEndConversation,
    onCancelEndConversation,
  } = useChatDrawerContext();

  return (
    <StyledChatDrawer
      ref={drawerRef}
      heightPx={heightPx}
      widthPx={widthPx}
      positionX={positionX}
      positionY={positionY}
      data-minimized={isMinimized ? "true" : "false"}
      data-expanded={isExpanded ? "true" : "false"}
      data-fullscreen={isFullscreen ? "true" : "false"}
      aria-hidden={isMinimized ? "true" : "false"}
    >
      <StyledChatHeader
        data-expanded={isExpanded ? "true" : "false"}
        data-fullscreen={isFullscreen ? "true" : "false"}
      >
        <StyledHeaderActions
          data-expanded={isExpanded ? "true" : "false"}
          data-fullscreen={isFullscreen ? "true" : "false"}
        >
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

      <StyledChatBody>
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
  );
};

export default React.memo(ChatDrawer);
