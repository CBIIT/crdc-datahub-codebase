import React from "react";

const DataViewContext = React.createContext<{
  /**
   * An array of the currently selected items.
   * When selectAllActive is true, this contains IDs to EXCLUDE from deletion.
   * When selectAllActive is false, this contains IDs to include in deletion.
   */
  selectedItems?: string[];
  /**
   * The total number of items matching the current filters
   */
  totalData?: number;
  /**
   * A reference to a boolean indicating if all data is being fetched
   */
  isFetchingAllData?: React.MutableRefObject<boolean>;
  /**
   * An indicator specifying what type of selection is currently active
   * When true, selectedItems contains exclusions instead of inclusions.
   */
  selectType?: "explicit" | "exclusion";
  /**
   * Toggle the current row selection
   *
   * @param nodeIds The node IDs to toggle selection for
   */
  handleToggleRow?: (nodeIds: string[]) => void;
  /**
   * Toggle select all mode
   */
  handleToggleAll?: () => void;
}>({});

export default DataViewContext;
