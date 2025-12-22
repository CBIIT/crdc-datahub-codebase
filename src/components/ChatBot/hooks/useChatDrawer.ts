import React, { useCallback, useEffect, useReducer, useRef } from "react";

import chatConfig from "../chatConfig";
import { computeNextHeightPx, getViewportHeightPx } from "../utils/chatUtils";

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
};

type DrawerAction =
  | { type: "opened" }
  | { type: "closed" }
  | { type: "drag_started" }
  | { type: "drag_ended" }
  | { type: "height_changed"; heightPx: number; viewportHeightPx: number }
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

      return {
        isOpen: true,
        isDragging: false,
        isExpanded: false,
        heightPx: chatConfig.height.collapsed,
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
      const isNearMax =
        action.viewportHeightPx - action.heightPx <= chatConfig.height.expandedSnapThreshold;
      return {
        ...state,
        heightPx: action.heightPx,
        isExpanded: isNearMax,
      };
    }
    case "expand_toggled": {
      if (!state.isOpen) {
        return state;
      }

      if (state.isExpanded) {
        return {
          ...state,
          isExpanded: false,
          heightPx: chatConfig.height.collapsed,
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

type Result = {
  drawerRef: React.RefObject<HTMLDivElement>;
  isOpen: boolean;
  isDragging: boolean;
  isExpanded: boolean;
  drawerHeightPx: number;
  openDrawer: () => void;
  closeDrawer: () => void;
  beginResize: React.PointerEventHandler<HTMLDivElement>;
  toggleExpand: () => void;
};

/**
 * Custom hook to manage the state and behavior of the chat drawer.
 *
 * @returns An object containing the state and actions for the chat drawer.
 */
export const useChatDrawer = (): Result => {
  const drawerRef = useRef<HTMLDivElement>(null);

  const [state, dispatch] = useReducer(reducer, {
    isOpen: false,
    isDragging: false,
    isExpanded: false,
    heightPx: chatConfig.height.collapsed,
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
   * Opens the chat drawer.
   */
  const openDrawer = useCallback((): void => {
    dispatch({ type: "opened" });
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
    activePointerIdRef.current = event.pointerId;

    dispatch({ type: "drag_started" });
  }, []);

  /**
   * Applies the resize, given a pointer Y position.
   */
  const applyResize = useCallback((clientY: number): void => {
    const drawerElement = drawerRef.current;
    if (!drawerElement) {
      return;
    }

    const next = computeNextHeightPx({ drawerElement, clientY });
    dispatch({
      type: "height_changed",
      heightPx: next.heightPx,
      viewportHeightPx: next.viewportHeightPx,
    });
  }, []);

  /**
   * Handles the pointer move event on the window.
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

      applyResize(event.clientY);
    },
    [applyResize]
  );

  /**
   * Ends the drag operation for the chat drawer.
   */
  const endDrag = useCallback((): void => {
    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;
    activePointerIdRef.current = null;

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

  useEffect(() => {
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
    };
  }, [handleWindowPointerMove, handleWindowPointerUp]);

  return {
    drawerRef,
    isOpen: state.isOpen,
    isDragging: state.isDragging,
    isExpanded: state.isExpanded,
    drawerHeightPx: state.heightPx,
    openDrawer,
    closeDrawer,
    beginResize,
    toggleExpand,
  };
};
