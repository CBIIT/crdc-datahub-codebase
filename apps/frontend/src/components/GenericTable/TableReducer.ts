import {
  validateTotal,
  validatePage,
  validatePerPageOptions,
  validateRowsPerPage,
  validateSortDirection,
  validateAndSetIfChanged,
  validateOrderBy,
  getValidationFn,
} from "../../utils";

export type TableAction<T> =
  | { type: "SET_DATA"; payload: T[] }
  | { type: "SET_TOTAL"; payload: number }
  | { type: "SET_PAGE"; payload: number }
  | { type: "SET_PER_PAGE"; payload: number }
  | { type: "SET_PER_PAGE_OPTIONS"; payload: number[] }
  | { type: "SET_SORT_DIRECTION"; payload: Order }
  | { type: "SET_ORDER_BY"; payload: string }
  | { type: "SET_ALL"; payload: Partial<TableState<T>> };

export const tableActionTypes = {
  SET_DATA: "SET_DATA",
  SET_TOTAL: "SET_TOTAL",
  SET_PAGE: "SET_PAGE",
  SET_PER_PAGE: "SET_PER_PAGE",
  SET_PER_PAGE_OPTIONS: "SET_PER_PAGE_OPTIONS",
  SET_SORT_DIRECTION: "SET_SORT_DIRECTION",
  SET_ORDER_BY: "SET_ORDER_BY",
  SET_ALL: "SET_ALL",
} as const;

export const tableStateReducer = <T>(
  state: TableState<T>,
  action: TableAction<T>
): TableState<T> => {
  switch (action.type) {
    case tableActionTypes.SET_DATA:
      return validateAndSetIfChanged(state, "data", action.payload, Array.isArray);
    case tableActionTypes.SET_TOTAL:
      return validateAndSetIfChanged(state, "total", action.payload, validateTotal);
    case tableActionTypes.SET_PAGE:
      return validateAndSetIfChanged(state, "page", action.payload, validatePage);
    case tableActionTypes.SET_PER_PAGE:
      return validateAndSetIfChanged(state, "perPage", action.payload, (value) =>
        validateRowsPerPage(value, state.perPageOptions)
      );
    case tableActionTypes.SET_PER_PAGE_OPTIONS:
      return validateAndSetIfChanged(
        state,
        "perPageOptions",
        action.payload,
        validatePerPageOptions
      );
    case tableActionTypes.SET_SORT_DIRECTION: {
      return validateAndSetIfChanged(state, "sortDirection", action.payload, validateSortDirection);
    }
    case tableActionTypes.SET_ORDER_BY:
      return validateAndSetIfChanged(state, "orderBy", action.payload, validateOrderBy);
    case tableActionTypes.SET_ALL: {
      let newState = { ...state };
      let hasChanges = false;

      Object.entries(action.payload).forEach(([key, value]) => {
        const updatedState = validateAndSetIfChanged(
          newState,
          key as keyof TableState<T>,
          value,
          getValidationFn(newState, key as keyof TableState<T>)
        );
        if (updatedState !== newState) {
          newState = updatedState;
          hasChanges = true;
        }
      });
      return hasChanges ? newState : state;
    }
    default:
      throw new Error(`Unexpected action type.`);
  }
};
