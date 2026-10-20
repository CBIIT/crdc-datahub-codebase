import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { RndDragCallback, RndResizeCallback } from "react-rnd";

import { useFloatingWindow } from "./useFloatingWindow";

export type FloatingWindowConfig = {
  height: {
    /**
     * The height of the window when it is collapsed.
     */
    collapsed: number;
    /**
     * The minimum height of the window.
     */
    min: number;
  };
  width: {
    /**
     * The default width of the window.
     */
    default: number;
    /**
     * The minimum width of the window.
     */
    min: number;
    /**
     * The width of the window when expanded.
     */
    expanded: number;
  };
};

type FloatingWindowContextValue = {
  // Window size configuration
  config: FloatingWindowConfig;

  // Window open state
  isOpen: boolean;
  openWindow: () => void;

  // Window state
  windowRef: React.RefObject<HTMLDivElement>;
  heightPx: number;
  widthPx: number;
  x: number;
  y: number;
  isExpanded: boolean;
  isMinimized: boolean;
  isFullscreen: boolean;

  // Window actions
  onDragStop: RndDragCallback;
  onResizeStop: RndResizeCallback;
  onToggleExpand: () => void;
  onToggleFullscreen: () => void;
  onMinimize: () => void;

  // Close state
  isConfirmingClose: boolean;
  onRequestClose: () => void;
  onConfirmClose: () => void;
  onCancelClose: () => void;
};

const FloatingWindowContext = createContext<FloatingWindowContextValue | null>(null);

export const useFloatingWindowContext = (): FloatingWindowContextValue => {
  const context = useContext(FloatingWindowContext);

  if (!context) {
    throw new Error("useFloatingWindowContext must be used within FloatingWindowProvider");
  }

  return context;
};

export type FloatingWindowProviderProps = {
  /**
   * The size configuration for the window.
   */
  config: FloatingWindowConfig;
  /**
   * When true, closing the window requires confirmation via `onConfirmClose`.
   */
  confirmBeforeClose?: boolean;
  /**
   * Called when the window is closed.
   */
  onClose?: () => void;
  children: React.ReactNode;
};

export const FloatingWindowProvider: React.FC<FloatingWindowProviderProps> = ({
  config,
  confirmBeforeClose = false,
  onClose,
  children,
}) => {
  const {
    drawerRef,
    isOpen,
    isExpanded,
    drawerHeightPx,
    drawerWidthPx,
    drawerX,
    drawerY,
    openDrawer,
    closeDrawer,
    handleDragStop,
    handleResizeStop,
    toggleExpand,
  } = useFloatingWindow(config);

  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);

  /**
   * Hide the page scrollbar when fullscreen mode is active to avoid double scrollbars.
   */
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  /**
   * Opens the window and removes the minimized state.
   */
  const handleOpenWindow = useCallback((): void => {
    setIsMinimized(false);
    setIsConfirmingClose(false);

    if (!isOpen) {
      openDrawer();
    }
  }, [isOpen, openDrawer]);

  /**
   * Minimizes the window when the minimize button is clicked.
   */
  const handleMinimizeWindow = useCallback((): void => {
    if (!isOpen) {
      return;
    }

    setIsMinimized(true);
  }, [isOpen]);

  /**
   * Toggles the fullscreen state of the window.
   */
  const handleToggleFullscreen = useCallback((): void => {
    setIsFullscreen((prev) => !prev);
  }, []);

  /**
   * Handles the expand button click.
   * If in fullscreen, exits fullscreen and enters expanded mode.
   * Otherwise, toggles the expanded state.
   */
  const handleToggleExpand = useCallback((): void => {
    if (isFullscreen && isExpanded) {
      document.body.style.overflow = "";
      setIsFullscreen(false);
      return;
    }

    if (isFullscreen) {
      document.body.style.overflow = "";
      setIsFullscreen(false);
      toggleExpand();
      return;
    }

    toggleExpand();
  }, [isFullscreen, isExpanded, toggleExpand]);

  /**
   * Closes the window and resets its state.
   */
  const handleClose = useCallback((): void => {
    onClose?.();
    setIsConfirmingClose(false);
    setIsMinimized(false);
    setIsFullscreen(false);
    closeDrawer();
  }, [onClose, closeDrawer]);

  /**
   * Begins the close confirmation flow, or closes immediately if no confirmation is required.
   */
  const handleRequestClose = useCallback((): void => {
    if (!confirmBeforeClose) {
      handleClose();
      return;
    }

    setIsConfirmingClose(true);
  }, [confirmBeforeClose, handleClose]);

  /**
   * Cancels the close confirmation flow.
   */
  const handleCancelClose = useCallback((): void => {
    setIsConfirmingClose(false);
  }, []);

  const value = useMemo<FloatingWindowContextValue>(
    () => ({
      config,
      isOpen,
      openWindow: handleOpenWindow,
      windowRef: drawerRef,
      heightPx: drawerHeightPx,
      widthPx: drawerWidthPx,
      x: drawerX,
      y: drawerY,
      isExpanded,
      isMinimized,
      isFullscreen,
      onDragStop: handleDragStop,
      onResizeStop: handleResizeStop,
      onToggleExpand: handleToggleExpand,
      onToggleFullscreen: handleToggleFullscreen,
      onMinimize: handleMinimizeWindow,
      isConfirmingClose,
      onRequestClose: handleRequestClose,
      onConfirmClose: handleClose,
      onCancelClose: handleCancelClose,
    }),
    [
      config,
      isOpen,
      handleOpenWindow,
      drawerRef,
      drawerHeightPx,
      drawerWidthPx,
      drawerX,
      drawerY,
      isExpanded,
      isMinimized,
      isFullscreen,
      handleDragStop,
      handleResizeStop,
      handleToggleExpand,
      handleToggleFullscreen,
      handleMinimizeWindow,
      isConfirmingClose,
      handleRequestClose,
      handleClose,
      handleCancelClose,
    ]
  );

  return <FloatingWindowContext.Provider value={value}>{children}</FloatingWindowContext.Provider>;
};
