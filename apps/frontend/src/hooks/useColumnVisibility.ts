import { useMemo } from "react";

import { ExtendedColumn } from "../components/GenericTable/ColumnVisibilityPopper";

import { useLocalStorage } from "./useLocalStorage";

type UseColumnVisibilityParams<C extends ExtendedColumn> = {
  columns: C[];
  getColumnKey: (column: C) => string;
  localStorageKey: string;
};

type UseColumnVisibilityResult<C> = {
  columnVisibilityModel: ColumnVisibilityModel;
  setColumnVisibilityModel: (model: ColumnVisibilityModel) => void;
  visibleColumns: C[];
};

/**
 * Custom hook to manage column visibility state.
 * @template C - The type of the column objects.
 * @param params - The parameters for the hook.
 * @returns The adjusted visibility model, the setter function, and the visible columns.
 */
export const useColumnVisibility = <C extends ExtendedColumn>({
  columns,
  getColumnKey,
  localStorageKey,
}: UseColumnVisibilityParams<C>): UseColumnVisibilityResult<C> => {
  // Initialize the default visibility model (all columns visible)
  const defaultVisibilityModel = useMemo(
    () =>
      columns.reduce<ColumnVisibilityModel>((model, column) => {
        const key = getColumnKey(column);
        model[key] = !column.defaultHidden;
        return model;
      }, {}),
    [columns, getColumnKey]
  );

  // Use useLocalStorage to manage the visibility model
  const [columnVisibilityModel, setColumnVisibilityModel] = useLocalStorage<ColumnVisibilityModel>(
    localStorageKey,
    defaultVisibilityModel
  );

  // Adjust the visibility model to ensure non-hideable columns are always visible
  const adjustVisibilityModel = (model: ColumnVisibilityModel): ColumnVisibilityModel =>
    columns.reduce<ColumnVisibilityModel>((adjustedModel, column) => {
      const key = getColumnKey(column);
      const isHideable = column.hideable !== false;
      adjustedModel[key] = isHideable ? model?.[key] ?? !column.defaultHidden : true;
      return adjustedModel;
    }, {});

  const adjustedColumnVisibilityModel = useMemo(
    () => adjustVisibilityModel(columnVisibilityModel),
    [columnVisibilityModel, columns, getColumnKey]
  );

  /**
   * Updates the column visibility model both locally and in localStorage.
   * @param model The new column visibility model.
   */
  const setAdjustedColumnVisibilityModel = (model: ColumnVisibilityModel): void => {
    const adjustedModel = adjustVisibilityModel(model);
    setColumnVisibilityModel(adjustedModel);
  };

  // Compute the visible columns based on the adjusted visibility model
  const visibleColumns = useMemo(
    () =>
      columns.filter((column) => {
        const key = getColumnKey(column);
        return adjustedColumnVisibilityModel[key];
      }),
    [columns, adjustedColumnVisibilityModel, getColumnKey]
  );

  return {
    columnVisibilityModel: adjustedColumnVisibilityModel,
    setColumnVisibilityModel: setAdjustedColumnVisibilityModel,
    visibleColumns,
  };
};
