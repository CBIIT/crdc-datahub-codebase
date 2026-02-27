import React, { useCallback, useEffect, useReducer, useRef } from "react";

import chatConfig from "../config/chatConfig";
import { getViewportHeightPx } from "../utils/chatUtils";

type DrawerState = {
  /**
   * Indicates whether the drawer is currently open.
   */
  isOpen: boolean;
  /**
   * Indicates whether the drawer is currently being dragged/resized.
   */
  isDragging: boolean;
  /**
   * Indicates whether the drawer is currently expanded to its maximum height.
   */
  isExpanded: boolean;
  /**
   * The current height of the drawer in pixels.
   */
  heightPx: number;
  /**
   * The current width of the drawer in pixels.
   */
  widthPx: number;
  /**
   * The current X position offset of the drawer in pixels (from default right: 0).
   */
  positionX: number;
  /**
   * The current Y position offset of the drawer in pixels (from default bottom: 0).
   */
  positionY: number;
};

type DrawerAction =
  | { type: "opened"; viewportHeightPx: number }
  | { type: "closed" }
  | { type: "drag_started" }
  | { type: "drag_ended" }
  | { type: "height_changed"; heightPx: number }
  | { type: "width_changed"; widthPx: number }
  | { type: "position_changed"; positionX: number; positionY: number }
  | { type: "expand_toggled"; viewportHeightPx: number };

/**
 * Reducer function to manage the state of the chat drawer.
 *
 * @param {DrawerState} state - The current state of the chat drawer.
 * @param {DrawerAction} action - The action to be performed on the chat drawer state.
 * @returns The new state of the chat drawer after applying the action.
 */
const reducer = (state: DrawerState, action: DrawerAction): DrawerState => {
  switch (action.type) {
    case "opened": {
      if (state.isOpen) {
        return state;
      }

      const drawerHeight = chatConfig.height.collapsed;
      const floatingButtonCenterFromBottom = action.viewportHeightPx * 0.35;
      const positionY = Math.max(0, floatingButtonCenterFromBottom - drawerHeight / 2);

      return {
        isOpen: true,
        isDragging: false,
        isExpanded: false,
        heightPx: drawerHeight,
        widthPx: chatConfig.width.default,
        positionX: 0,
        positionY,
      };
    }
    case "closed": {
      if (!state.isOpen) {
        return state;
      }

      return {
        ...state,
        isOpen: false,
        isDragging: false,
        isExpanded: false,
        heightPx: chatConfig.height.collapsed,
        widthPx: chatConfig.width.default,
        positionX: 0,
        positionY: 0,
      };
    }
    case "drag_started": {
      if (!state.isOpen || state.isDragging) {
        return state;
      }

      return { ...state, isDragging: true };
    }
    case "drag_ended": {
      if (!state.isDragging) {
        return state;
      }

      return { ...state, isDragging: false };
    }
    case "height_changed": {
      return {
        ...state,
        heightPx: action.heightPx,
      };
    }
    case "width_changed": {
      return {
        ...state,
        widthPx: action.widthPx,
      };
    }
    case "position_changed": {
      return {
        ...state,
        positionX: action.positionX,
        positionY: action.positionY,
      };
    }
    case "expand_toggled": {
      if (!state.isOpen) {
        return state;
      }

      if (state.isExpanded) {
        const drawerHeight = chatConfig.height.collapsed;
        const floatingButtonCenterFromBottom = action.viewportHeightPx * 0.35;
        const positionY = Math.max(0, floatingButtonCenterFromBottom - drawerHeight / 2);

        return {
          ...state,
          isExpanded: false,
          heightPx: drawerHeight,
          widthPx: chatConfig.width.default,
          positionX: 0,
          positionY,
        };
      }

      return {
        ...state,
        isExpanded: true,
        heightPx: action.viewportHeightPx,
      };
    }
    default: {
      return state;
    }
  }
};

export type useChatDrawerResult = {
  drawerRef: React.RefObject<HTMLDivElement>;
  isOpen: boolean;
  isDragging: boolean;
  isExpanded: boolean;
  drawerHeightPx: number;
  drawerWidthPx: number;
  drawerPositionX: number;
  drawerPositionY: number;
  openDrawer: () => void;
  closeDrawer: () => void;
  beginResize: React.PointerEventHandler<HTMLDivElement>;
  beginMove: React.PointerEventHandler<HTMLDivElement>;
  toggleExpand: () => void;
};

/**
 * Custom hook to manage the state and behavior of the chat drawer.
 *
 * @returns An object containing the state and actions for the chat drawer.
 */
export const useChatDrawer = (): useChatDrawerResult => {
  const drawerRef = useRef<HTMLDivElement>(null);

  const [state, dispatch] = useReducer(reducer, {
    isOpen: false,
    isDragging: false,
    isExpanded: false,
    heightPx: chatConfig.height.collapsed,
    widthPx: chatConfig.width.default,
    positionX: 0,
    positionY: 0,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * These refs ensure the global event handlers have immediate, up-to-date state
   * without needing to re-register listeners.
   */
  const isDraggingRef = useRef(false);
  /**
   * Stores the ID of the active pointer during a drag operation.
   */
  const activePointerIdRef = useRef<number | null>(null);
  /**
   * Stores the requestAnimationFrame ID for throttling drag updates.
   */
  const rafIdRef = useRef<number | null>(null);
  /**
   * Stores the latest pointer position for RAF-throttled updates.
   */
  const pendingPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * Stores the initial pointer position when drag starts.
   */
  const initialPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * Stores the initial dimensions when drag starts.
   */
  const initialDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  /**
   * Stores the initial position when drag starts.
   */
  const initialPositionRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * Indicates whether the current drag operation is a move (vs resize).
   */
  const isMoveOperationRef = useRef(false);

  /**
   * Opens the chat drawer.
   */
  const openDrawer = useCallback((): void => {
    const viewportHeightPx = getViewportHeightPx(chatConfig.height.collapsed);
    dispatch({ type: "opened", viewportHeightPx });
  }, []);

  /**
   * Closes the chat drawer.
   */
  const closeDrawer = useCallback((): void => {
    isDraggingRef.current = false;
    activePointerIdRef.current = null;
    dispatch({ type: "closed" });
  }, []);

  /**
   * Toggles the expanded state of the chat drawer.
   */
  const toggleExpand = useCallback((): void => {
    const viewportHeightPx = getViewportHeightPx(chatConfig.height.collapsed);
    dispatch({ type: "expand_toggled", viewportHeightPx });
  }, []);

  /**
   * Begins the resize operation for the chat drawer.
   */
  const beginResize: React.PointerEventHandler<HTMLDivElement> = useCallback((event): void => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    if (!stateRef.current.isOpen) {
      return;
    }

    event.preventDefault();

    isDraggingRef.current = true;
    isMoveOperationRef.current = false;
    activePointerIdRef.current = event.pointerId;
    initialPointerPosRef.current = { x: event.clientX, y: event.clientY };
    initialDimensionsRef.current = {
      width: stateRef.current.widthPx,
      height: stateRef.current.heightPx,
    };

    dispatch({ type: "drag_started" });
  }, []);

  /**
   * Begins the move operation for the chat drawer.
   */
  const beginMove: React.PointerEventHandler<HTMLDivElement> = useCallback((event): void => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    if (!stateRef.current.isOpen) {
      return;
    }

    event.preventDefault();

    isDraggingRef.current = true;
    isMoveOperationRef.current = true;
    activePointerIdRef.current = event.pointerId;
    initialPointerPosRef.current = { x: event.clientX, y: event.clientY };
    initialPositionRef.current = {
      x: stateRef.current.positionX,
      y: stateRef.current.positionY,
    };

    dispatch({ type: "drag_started" });
  }, []);

  /**
   * Applies the resize, given pointer X and Y positions.
   */
  const applyResize = useCallback((clientX: number, clientY: number): void => {
    const drawerElement = drawerRef.current;
    if (!drawerElement) {
      return;
    }

    const initialPos = initialPointerPosRef.current;
    const initialDims = initialDimensionsRef.current;

    if (!initialPos || !initialDims) {
      return;
    }

    // Calculate deltas from initial position
    const deltaX = initialPos.x - clientX;
    const deltaY = initialPos.y - clientY;

    // Apply delta to initial dimensions
    const newWidth = initialDims.width + deltaX;
    const newHeight = initialDims.height + deltaY;

    // Calculate scrollbar dimensions to prevent clipping at viewport edges
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const scrollbarHeight = window.innerHeight - document.documentElement.clientHeight;

    // Update height
    const viewportHeightPx = getViewportHeightPx(chatConfig.height.collapsed);
    const maxHeight = viewportHeightPx - stateRef.current.positionY - scrollbarHeight;
    const heightPx = Math.max(chatConfig.height.min, Math.min(newHeight, maxHeight));
    dispatch({
      type: "height_changed",
      heightPx,
    });

    // Update width
    const viewportWidth = window.innerWidth;
    const maxWidth = viewportWidth - stateRef.current.positionX - scrollbarWidth;
    const widthPx = Math.max(chatConfig.width.min, Math.min(newWidth, maxWidth));
    dispatch({
      type: "width_changed",
      widthPx,
    });
  }, []);

  /**
   * Applies the move, given pointer X and Y positions.
   */
  const applyMove = useCallback((clientX: number, clientY: number): void => {
    const initialPos = initialPointerPosRef.current;
    const initialPosition = initialPositionRef.current;

    if (!initialPos || !initialPosition) {
      return;
    }

    const deltaX = initialPos.x - clientX;
    const deltaY = initialPos.y - clientY;

    const newPositionX = initialPosition.x + deltaX;
    const newPositionY = initialPosition.y + deltaY;

    // Calculate scrollbar dimensions to prevent clipping at viewport edges
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const scrollbarHeight = window.innerHeight - document.documentElement.clientHeight;

    // Constrain to viewport bounds
    const viewportWidth = window.innerWidth - scrollbarWidth;
    const viewportHeight = window.innerHeight - scrollbarHeight;
    const drawerWidth = stateRef.current.widthPx;
    const drawerHeight = stateRef.current.heightPx;

    const maxPositionX = viewportWidth - drawerWidth;
    const maxPositionY = viewportHeight - drawerHeight;

    const positionX = Math.max(0, Math.min(newPositionX, maxPositionX));
    const positionY = Math.max(0, Math.min(newPositionY, maxPositionY));

    dispatch({
      type: "position_changed",
      positionX,
      positionY,
    });
  }, []);

  /**
   * Handles the pointer move event on the window.
   * Uses requestAnimationFrame to throttle updates for better performance.
   */
  const handleWindowPointerMove = useCallback(
    (event: PointerEvent): void => {
      if (!isDraggingRef.current) {
        return;
      }

      const activePointerId = activePointerIdRef.current;
      if (activePointerId !== null && event.pointerId !== activePointerId) {
        return;
      }

      pendingPointerPosRef.current = { x: event.clientX, y: event.clientY };

      if (rafIdRef.current !== null) {
        return;
      }

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const pos = pendingPointerPosRef.current;
        if (!pos) {
          return;
        }

        if (isMoveOperationRef.current) {
          applyMove(pos.x, pos.y);
        } else {
          applyResize(pos.x, pos.y);
        }
      });
    },
    [applyResize, applyMove]
  );

  /**
   * Ends the drag operation for the chat drawer.
   */
  const endDrag = useCallback((): void => {
    if (!isDraggingRef.current) {
      return;
    }

    // Cancel any pending animation frame
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    isDraggingRef.current = false;
    isMoveOperationRef.current = false;
    activePointerIdRef.current = null;
    initialPointerPosRef.current = null;
    initialDimensionsRef.current = null;
    initialPositionRef.current = null;
    pendingPointerPosRef.current = null;

    dispatch({ type: "drag_ended" });
  }, []);

  /**
   * Handles the pointer up event on the window.
   */
  const handleWindowPointerUp = useCallback(
    (event: PointerEvent): void => {
      const activePointerId = activePointerIdRef.current;

      if (activePointerId === null || event.pointerId === activePointerId) {
        endDrag();
      }
    },
    [endDrag]
  );

  /**
   * Handles visibility change to reset drag state when tab becomes hidden.
   * This prevents stuck drag states when the user switches tabs mid-drag.
   */
  const handleVisibilityChange = useCallback((): void => {
    if (document.hidden && isDraggingRef.current) {
      endDrag();
    }
  }, [endDrag]);

  useEffect(() => {
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      // Clean up any pending animation frame on unmount
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [handleWindowPointerMove, handleWindowPointerUp, handleVisibilityChange]);

  return {
    drawerRef,
    isOpen: state.isOpen,
    isDragging: state.isDragging,
    isExpanded: state.isExpanded,
    drawerHeightPx: state.heightPx,
    drawerWidthPx: state.widthPx,
    drawerPositionX: state.positionX,
    drawerPositionY: state.positionY,
    openDrawer,
    closeDrawer,
    beginResize,
    beginMove,
    toggleExpand,
  };
};
