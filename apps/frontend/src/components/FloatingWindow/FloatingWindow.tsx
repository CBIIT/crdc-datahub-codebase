import CloseIcon from "@mui/icons-material/Close";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import { IconButton, Paper, styled } from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";

import DraggableHandleSvg from "@/assets/icons/draggable_handle_icon.svg?react";
import DrawerViewIcon from "@/assets/icons/drawer_view_icon.svg?react";
import ExitFullScreenIcon from "@/assets/icons/exit_full_screen_icon.svg?react";
import FullScreenIcon from "@/assets/icons/full_screen_icon.svg?react";

import { useFloatingWindowContext } from "./FloatingWindowContext";

const StyledWindow = styled(Paper)({
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

const StyledHeader = styled("div")({
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

const StyledBody = styled("div")({
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
  zIndex: 1250,
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

export type FloatingWindowLabels = {
  expand: string;
  collapse: string;
  enterFullscreen: string;
  exitFullscreen: string;
  minimize: string;
  close: string;
};

const DEFAULT_LABELS: FloatingWindowLabels = {
  expand: "Expand window",
  collapse: "Collapse window",
  enterFullscreen: "Enter full screen",
  exitFullscreen: "Exit full screen",
  minimize: "Minimize window",
  close: "Close window",
};

export type Props = {
  /**
   * The id of the window element. The body element receives `${id}-body`.
   */
  id: string;
  /**
   * Optional overrides for the header button aria-labels.
   */
  labels?: Partial<FloatingWindowLabels>;
  /**
   * Content rendered over the body while a close confirmation is pending.
   */
  confirmCloseContent?: React.ReactNode;
  /**
   * Child content rendered in the window body.
   */
  children: React.ReactNode;
};

/**
 * FloatingWindow provides a resizable, draggable window with expand, fullscreen and minimize capabilities.
 */
const FloatingWindow = ({ id, labels, confirmCloseContent, children }: Props): JSX.Element => {
  const {
    config,
    windowRef,
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
    isConfirmingClose,
    onRequestClose,
  } = useFloatingWindowContext();

  const resolvedLabels = useMemo<FloatingWindowLabels>(
    () => ({ ...DEFAULT_LABELS, ...labels }),
    [labels]
  );

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
        width: Math.max(config.width.expanded, config.width.min),
        height: viewportSize.height,
      };
    }

    return { width: widthPx, height: heightPx };
  }, [isFullscreen, isExpanded, widthPx, heightPx, viewportSize, config]);

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
        minWidth={config.width.min}
        minHeight={config.height.min}
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
        <StyledWindow
          ref={windowRef}
          id={id}
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
          <StyledHeader {...dataAttrs}>
            <StyledHeaderActions {...dataAttrs}>
              <DrawerViewIconButton
                size="small"
                onClick={onToggleExpand}
                aria-label={isExpanded ? resolvedLabels.collapse : resolvedLabels.expand}
              >
                <DrawerViewIcon />
              </DrawerViewIconButton>
              <FullScreenIconButton
                size="small"
                onClick={onToggleFullscreen}
                aria-label={
                  isFullscreen ? resolvedLabels.exitFullscreen : resolvedLabels.enterFullscreen
                }
              >
                {isFullscreen ? <ExitFullScreenIcon /> : <FullScreenIcon />}
              </FullScreenIconButton>
              <MinimizeIconButton
                size="small"
                onClick={onMinimize}
                aria-label={resolvedLabels.minimize}
              >
                <HorizontalRuleIcon />
              </MinimizeIconButton>
              <CloseIconButton
                size="small"
                onClick={onRequestClose}
                aria-label={resolvedLabels.close}
              >
                <CloseIcon />
              </CloseIconButton>
            </StyledHeaderActions>
          </StyledHeader>

          <StyledBody id={`${id}-body`} {...dataAttrs}>
            {!disableInteraction && (
              <StyledDraggableBorder
                edge="top"
                className="rnd-drag-handle"
                aria-label="Drag to move"
              />
            )}
            {children}

            {isConfirmingClose ? confirmCloseContent : null}
          </StyledBody>
        </StyledWindow>
      </Rnd>
    </StyledRndContainer>
  );
};

export default React.memo(FloatingWindow);
