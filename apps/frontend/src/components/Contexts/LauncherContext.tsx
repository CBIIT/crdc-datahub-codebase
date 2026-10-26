import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type LauncherItem = {
  /**
   * A unique identifier for the item.
   */
  id: string;
  /**
   * The tooltip label.
   */
  label: string;
  /**
   * The icon displayed in the launcher item.
   */
  icon: React.ElementType;
  /**
   * The CSS background shown behind the icon while the item is hovered, focused, or active.
   *
   * @example "linear-gradient(180deg, #006374 0%, #13AA84 100%)"
   */
  gradient: string;
  /**
   * The position of the item in the launcher. Lower values come first.
   */
  order?: number;
  /**
   * Whether the item's feature is currently open.
   */
  isActive?: boolean;
  /**
   * Indicates when the item is clicked.
   */
  onClick: () => void;
};

type LauncherRegistryContextValue = {
  registerItem: (item: LauncherItem) => void;
  unregisterItem: (id: string) => void;
};

const LauncherRegistryContext = createContext<LauncherRegistryContextValue | null>(null);
const LauncherItemsContext = createContext<readonly LauncherItem[] | null>(null);

const DEFAULT_ORDER = Number.MAX_SAFE_INTEGER;

/**
 * Compares two launcher items by their order value. Items without an order are placed last.
 *
 * @param {LauncherItem} a The first item to compare.
 * @param {LauncherItem} b The second item to compare.
 * @returns {number} A negative number if `a` comes first, a positive number if `b` comes first.
 */
const compareByOrder = (a: LauncherItem, b: LauncherItem): number =>
  (a.order ?? DEFAULT_ORDER) - (b.order ?? DEFAULT_ORDER);

/**
 * Returns the launcher items, sorted by their order value.
 *
 * @note This is intended for the Launcher component. Features should use `useLauncherItem`.
 * @returns {readonly LauncherItem[]} The items to show in the launcher.
 */
export const useLauncherItems = (): readonly LauncherItem[] => {
  const context = useContext(LauncherItemsContext);

  if (!context) {
    throw new Error("useLauncherItems must be used within LauncherProvider");
  }

  return context;
};

/**
 * Shows an item in the launcher for as long as the calling component is mounted.
 *
 * @param {LauncherItem} item The item to show in the launcher.
 * @returns {void}
 */
export const useLauncherItem = (item: LauncherItem): void => {
  const context = useContext(LauncherRegistryContext);

  if (!context) {
    throw new Error("useLauncherItem must be used within LauncherProvider");
  }

  const { registerItem, unregisterItem } = context;
  const { id, label, icon, gradient, order, isActive, onClick } = item;

  /**
   * Registers the item, or updates it in place when any of its values change.
   */
  useEffect(() => {
    registerItem({ id, label, icon, gradient, order, isActive, onClick });
  }, [registerItem, id, label, icon, gradient, order, isActive, onClick]);

  /**
   * Removes the item on unmount.
   */
  useEffect(() => () => unregisterItem(id), [unregisterItem, id]);
};

export type LauncherProviderProps = {
  children: React.ReactNode;
};

/**
 * Holds the items shown in the launcher.
 */
export const LauncherProvider: React.FC<LauncherProviderProps> = ({ children }) => {
  const [registeredItems, setRegisteredItems] = useState<ReadonlyMap<string, LauncherItem>>(
    () => new Map()
  );

  /**
   * Adds an item, or replaces the item with the same id.
   */
  const registerItem = useCallback((item: LauncherItem): void => {
    setRegisteredItems((prev) => new Map(prev).set(item.id, item));
  }, []);

  /**
   * Removes the item with the given id, if it is registered.
   */
  const unregisterItem = useCallback((id: string): void => {
    setRegisteredItems((prev) => {
      if (!prev.has(id)) {
        return prev;
      }

      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const registry = useMemo<LauncherRegistryContextValue>(
    () => ({ registerItem, unregisterItem }),
    [registerItem, unregisterItem]
  );

  const items = useMemo<readonly LauncherItem[]>(
    () => [...registeredItems.values()].sort(compareByOrder),
    [registeredItems]
  );

  return (
    <LauncherRegistryContext.Provider value={registry}>
      <LauncherItemsContext.Provider value={items}>{children}</LauncherItemsContext.Provider>
    </LauncherRegistryContext.Provider>
  );
};
