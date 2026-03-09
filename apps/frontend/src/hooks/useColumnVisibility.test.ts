import { MockedFunction } from "vitest";

import { renderHook, waitFor } from "../test-utils";

import { useColumnVisibility } from "./useColumnVisibility";
import { useLocalStorage } from "./useLocalStorage";

vi.mock("./useLocalStorage");

type Column<C> = C & { hideable?: boolean };

interface ColumnType {
  name: string;
  hideable?: boolean;
}

const mockUseLocalStorage = useLocalStorage as MockedFunction<typeof useLocalStorage>;

describe("useColumnVisibility Hook", () => {
  const getColumnKey = (column: Column<ColumnType>): string => column.name;

  const columns: Column<ColumnType>[] = [
    { name: "Column1", hideable: true },
    { name: "Column2", hideable: false },
    { name: "Column3" }, // hideable defaults to true
  ];

  const localStorageKey = "columnVisibility";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should initialize with all columns visible when localStorage is empty", () => {
    const defaultVisibilityModel: ColumnVisibilityModel = {
      Column1: true,
      Column2: true, // non-hideable, always true
      Column3: true,
    };

    mockUseLocalStorage.mockReturnValue([defaultVisibilityModel, vi.fn()]);

    const { result } = renderHook(() =>
      useColumnVisibility({
        columns,
        getColumnKey,
        localStorageKey,
      })
    );

    expect(result.current.columnVisibilityModel).toEqual(defaultVisibilityModel);
    expect(result.current.visibleColumns).toEqual(columns);
  });

  it("should initialize with the value from localStorage if it exists", () => {
    const storedVisibilityModel: ColumnVisibilityModel = {
      Column1: false,
      Column2: false, // non-hideable, should remain true
      Column3: false,
    };

    const adjustedVisibilityModel: ColumnVisibilityModel = {
      Column1: false,
      Column2: true, // non-hideable, always true
      Column3: false,
    };

    mockUseLocalStorage.mockReturnValue([storedVisibilityModel, vi.fn()]);

    const { result } = renderHook(() =>
      useColumnVisibility({
        columns,
        getColumnKey,
        localStorageKey,
      })
    );

    expect(result.current.columnVisibilityModel).toEqual(adjustedVisibilityModel);
    expect(result.current.visibleColumns).toEqual([columns[1]]);
  });

  it("should update the state and localStorage when setColumnVisibilityModel is called", async () => {
    const initialVisibilityModel: ColumnVisibilityModel = {
      Column1: true,
      Column2: true, // non-hideable, always true
      Column3: true,
    };

    const setVisibilityModelMock = vi.fn();

    mockUseLocalStorage.mockReturnValue([initialVisibilityModel, setVisibilityModelMock]);

    const { result } = renderHook(() =>
      useColumnVisibility({
        columns,
        getColumnKey,
        localStorageKey,
      })
    );

    const newVisibilityModel: ColumnVisibilityModel = {
      Column1: false,
      Column2: false, // non-hideable, should remain true
      Column3: false,
    };

    result.current.setColumnVisibilityModel(newVisibilityModel);

    const expectedAdjustedModel: ColumnVisibilityModel = {
      Column1: false,
      Column2: true, // non-hideable, always true
      Column3: false,
    };

    await waitFor(() => {
      expect(setVisibilityModelMock).toHaveBeenCalledWith(expectedAdjustedModel);
    });

    mockUseLocalStorage.mockReturnValue([expectedAdjustedModel, setVisibilityModelMock]);

    // Re-render the hook to get updated values
    const { result: updatedResult } = renderHook(() =>
      useColumnVisibility({
        columns,
        getColumnKey,
        localStorageKey,
      })
    );

    expect(updatedResult.current.columnVisibilityModel).toEqual(expectedAdjustedModel);
    expect(updatedResult.current.visibleColumns).toEqual([columns[1]]);
  });

  it("should ensure non-hideable columns are always visible", () => {
    const storedVisibilityModel: ColumnVisibilityModel = {
      Column1: false,
      Column2: false, // non-hideable, should remain true
      Column3: false,
    };

    const adjustedVisibilityModel: ColumnVisibilityModel = {
      Column1: false,
      Column2: true, // non-hideable, always true
      Column3: false,
    };

    mockUseLocalStorage.mockReturnValue([storedVisibilityModel, vi.fn()]);

    const { result } = renderHook(() =>
      useColumnVisibility({
        columns,
        getColumnKey,
        localStorageKey,
      })
    );

    expect(result.current.columnVisibilityModel).toEqual(adjustedVisibilityModel);
    expect(result.current.visibleColumns).toEqual([columns[1]]);
  });

  it("should treat columns without the hideable property as hideable", () => {
    const storedVisibilityModel: ColumnVisibilityModel = {
      Column1: false,
      Column2: true, // non-hideable
      Column3: false, // hideable by default
    };

    const adjustedVisibilityModel: ColumnVisibilityModel = {
      Column1: false,
      Column2: true, // non-hideable, always true
      Column3: false,
    };

    mockUseLocalStorage.mockReturnValue([storedVisibilityModel, vi.fn()]);

    const { result } = renderHook(() =>
      useColumnVisibility({
        columns,
        getColumnKey,
        localStorageKey,
      })
    );

    expect(result.current.columnVisibilityModel).toEqual(adjustedVisibilityModel);
    expect(result.current.visibleColumns).toEqual([columns[1]]);
  });

  it("should set hideable column to true when model[key] is undefined", () => {
    const storedVisibilityModel: ColumnVisibilityModel = {
      Column1: undefined, // hideable
      Column2: true, // non-hideable
      Column3: undefined, // hideable
    };

    const adjustedVisibilityModel: ColumnVisibilityModel = {
      Column1: true, // isHideable: true, model[key] undefined, so true
      Column2: true, // non-hideable, always true
      Column3: true, // isHideable: true, model[key] undefined, so true
    };

    mockUseLocalStorage.mockReturnValue([storedVisibilityModel, vi.fn()]);

    const { result } = renderHook(() =>
      useColumnVisibility({
        columns,
        getColumnKey,
        localStorageKey,
      })
    );

    expect(result.current.columnVisibilityModel).toEqual(adjustedVisibilityModel);
    expect(result.current.visibleColumns).toEqual(columns);
  });

  it("should set hideable column to false when model[key] is false", () => {
    const storedVisibilityModel: ColumnVisibilityModel = {
      Column1: false, // hideable
      Column2: false, // non-hideable, should remain true
      Column3: false, // hideable
    };

    const adjustedVisibilityModel: ColumnVisibilityModel = {
      Column1: false, // isHideable: true
      Column2: true, // non-hideable, always true
      Column3: false, // isHideable: true
    };

    mockUseLocalStorage.mockReturnValue([storedVisibilityModel, vi.fn()]);

    const { result } = renderHook(() =>
      useColumnVisibility({
        columns,
        getColumnKey,
        localStorageKey,
      })
    );

    expect(result.current.columnVisibilityModel).toEqual(adjustedVisibilityModel);
    expect(result.current.visibleColumns).toEqual([columns[1]]);
  });

  it("should set non-hideable column to true regardless of model[key]", () => {
    const storedVisibilityModel: ColumnVisibilityModel = {
      Column1: true, // hideable
      Column2: false, // non-hideable, should remain true
      Column3: false, // hideable
    };

    const adjustedVisibilityModel: ColumnVisibilityModel = {
      Column1: true, // isHideable: true
      Column2: true, // non-hideable, always true
      Column3: false, // isHideable: true
    };

    mockUseLocalStorage.mockReturnValue([storedVisibilityModel, vi.fn()]);

    const { result } = renderHook(() =>
      useColumnVisibility({
        columns,
        getColumnKey,
        localStorageKey,
      })
    );

    expect(result.current.columnVisibilityModel).toEqual(adjustedVisibilityModel);
    expect(result.current.visibleColumns).toEqual([columns[0], columns[1]]);
  });
});
