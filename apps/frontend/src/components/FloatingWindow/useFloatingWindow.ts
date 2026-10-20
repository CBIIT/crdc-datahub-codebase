import React, { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { RndDragCallback, RndResizeCallback } from "react-rnd";

import { getViewportHeightPx } from "@/utils";

import type { FloatingWindowConfig } from "./FloatingWindowContext";

type DrawerState = {
  isOpen: boolean;
  isExpanded: boolean;
  heightPx: number;
  widthPx: number;
  x: number;
  y: number;
};

type DrawerAction =
  | { type: "opened"; viewportWidth: number; viewportHeight: number }
  | { type: "closed" }
  | { type: "position_changed"; x: number; y: number }
  | { type: "dimensions_changed"; x: number; y: number; widthPx: number; heightPx: number }
  | { type: "expand_toggled"; viewportWidth: number; viewportHeight: number }
  | { type: "viewport_resized"; viewportWidth: number; viewportHeight: number };

/**
 * Computes the default collapsed position for the floating window.
 */
const computeCollapsedPosition = (
  config: FloatingWindowConfig,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } => {
  const FLOATING_BUTTON_POSITION_RATIO = 0.35;

  const drawerHeight = config.height.collapsed;
  const drawerWidth = config.width.default;
  const floatingButtonCenterFromBottom = viewportHeight * FLOATING_BUTTON_POSITION_RATIO;
  const bottomOffset = Math.max(0, floatingButtonCenterFromBottom - drawerHeight / 2);

  return {
    x: viewportWidth - drawerWidth,
    y: viewportHeight - drawerHeight - bottomOffset,
  };
};

/**
 * Creates the reducer that manages the state of the floating window.
 */
const createReducer =
  (config: FloatingWindowConfig) =>
  (state: DrawerState, action: DrawerAction): DrawerState => {
    switch (action.type) {
      case "opened": {
        if (state.isOpen) {
          return state;
        }

        const { x, y } = computeCollapsedPosition(
          config,
          action.viewportWidth,
          action.viewportHeight
        );

        return {
          isOpen: true,
          isExpanded: false,
          heightPx: config.height.collapsed,
          widthPx: config.width.default,
          x,
          y,
        };
      }
      case "closed": {
        if (!state.isOpen) {
          return state;
        }

        return {
          ...state,
          isOpen: false,
          isExpanded: false,
          heightPx: config.height.collapsed,
          widthPx: config.width.default,
          x: 0,
          y: 0,
        };
      }
      case "position_changed": {
        const maxX = Math.max(0, document.documentElement.clientWidth - state.widthPx);
        const maxY = Math.max(0, document.documentElement.clientHeight - state.heightPx);

        return {
          ...state,
          x: Math.max(0, Math.min(action.x, maxX)),
          y: Math.max(0, Math.min(action.y, maxY)),
        };
      }
      case "dimensions_changed": {
        return {
          ...state,
          x: action.x,
          y: action.y,
          widthPx: action.widthPx,
          heightPx: action.heightPx,
        };
      }
      case "expand_toggled": {
        if (!state.isOpen) {
          return state;
        }

        if (state.isExpanded) {
          const { x, y } = computeCollapsedPosition(
            config,
            action.viewportWidth,
            action.viewportHeight
          );

          return {
            ...state,
            isExpanded: false,
            heightPx: config.height.collapsed,
            widthPx: config.width.default,
            x,
            y,
          };
        }

        const expandedWidth = Math.max(config.width.expanded, config.width.min);

        return {
          ...state,
          isExpanded: true,
          x: action.viewportWidth - expandedWidth,
          y: 0,
        };
      }
      case "viewport_resized": {
        if (!state.isOpen) {
          return state;
        }

        if (state.isExpanded) {
          const expandedWidth = Math.max(config.width.expanded, config.width.min);

          return {
            ...state,
            x: action.viewportWidth - expandedWidth,
            y: 0,
          };
        }

        const newWidth = Math.min(state.widthPx, action.viewportWidth);
        const newHeight = Math.min(state.heightPx, action.viewportHeight);
        const maxX = Math.max(0, action.viewportWidth - newWidth);
        const maxY = Math.max(0, action.viewportHeight - newHeight);
        const newX = Math.max(0, Math.min(state.x, maxX));
        const newY = Math.max(0, Math.min(state.y, maxY));

        if (
          newX === state.x &&
          newY === state.y &&
          newWidth === state.widthPx &&
          newHeight === state.heightPx
        ) {
          return state;
        }

        return { ...state, x: newX, y: newY, widthPx: newWidth, heightPx: newHeight };
      }
      default: {
        return state;
      }
    }
  };

export type UseFloatingWindowResult = {
  drawerRef: React.RefObject<HTMLDivElement>;
  isOpen: boolean;
  isExpanded: boolean;
  drawerHeightPx: number;
  drawerWidthPx: number;
  drawerX: number;
  drawerY: number;
  openDrawer: () => void;
  closeDrawer: () => void;
  handleDragStop: RndDragCallback;
  handleResizeStop: RndResizeCallback;
  toggleExpand: () => void;
};

/**
 * Custom hook to manage the position, size, and open state of a floating window.
 *
 * @param config - The size configuration for the window.
 * @returns An object containing the state and actions for the floating window.
 */
export const useFloatingWindow = (config: FloatingWindowConfig): UseFloatingWindowResult => {
  const drawerRef = useRef<HTMLDivElement>(null);

  const reducer = useMemo(() => createReducer(config), [config]);

  const [state, dispatch] = useReducer(reducer, {
    isOpen: false,
    isExpanded: false,
    heightPx: config.height.collapsed,
    widthPx: config.width.default,
    x: 0,
    y: 0,
  });

  const openDrawer = useCallback((): void => {
    const viewportHeight = getViewportHeightPx(config.height.collapsed);
    const viewportWidth = document.documentElement.clientWidth;

    dispatch({ type: "opened", viewportWidth, viewportHeight });
  }, [config]);

  const closeDrawer = useCallback((): void => {
    dispatch({ type: "closed" });
  }, []);

  const toggleExpand = useCallback((): void => {
    const viewportHeight = getViewportHeightPx(config.height.collapsed);
    const viewportWidth = document.documentElement.clientWidth;

    dispatch({ type: "expand_toggled", viewportWidth, viewportHeight });
  }, [config]);

  const handleDragStop: RndDragCallback = useCallback((_e, data) => {
    dispatch({ type: "position_changed", x: data.x, y: data.y });
  }, []);

  const handleResizeStop: RndResizeCallback = useCallback(
    (_e, _direction, ref, _delta, position) => {
      dispatch({
        type: "dimensions_changed",
        x: position.x,
        y: position.y,
        widthPx: Math.round(parseFloat(ref.style.width)),
        heightPx: Math.round(parseFloat(ref.style.height)),
      });
    },
    []
  );

  useEffect(() => {
    if (!state.isOpen) {
      return undefined;
    }

    const handleResize = () => {
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;

      dispatch({ type: "viewport_resized", viewportWidth, viewportHeight });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [state.isOpen]);

  return {
    drawerRef,
    isOpen: state.isOpen,
    isExpanded: state.isExpanded,
    drawerHeightPx: state.heightPx,
    drawerWidthPx: state.widthPx,
    drawerX: state.x,
    drawerY: state.y,
    openDrawer,
    closeDrawer,
    handleDragStop,
    handleResizeStop,
    toggleExpand,
  };
};
