import { tableStateReducer, tableActionTypes, TableAction } from "./TableReducer";

describe("tableStateReducer", () => {
  type MockData = { id: number };
  const initialState: TableState<MockData> = {
    data: [],
    total: 0,
    page: 0,
    perPage: 10,
    perPageOptions: [10, 20, 30],
    sortDirection: "asc",
    orderBy: "",
  };

  describe("SET_DATA", () => {
    it("should set data if payload is an array", () => {
      const action = { type: tableActionTypes.SET_DATA, payload: [{ id: 1 }, { id: 2 }] };
      const newState = tableStateReducer(initialState, action);
      expect(newState.data).toEqual(action.payload);
    });

    it("should not modify state if payload is not an array", () => {
      const action = {
        type: tableActionTypes.SET_DATA,
        payload: "not-an-array" as unknown as MockData[],
      };
      const newState = tableStateReducer(initialState, action);
      expect(newState).toEqual(initialState);
    });
  });

  describe("SET_TOTAL", () => {
    it("should set total if payload is a valid number", () => {
      const action = { type: tableActionTypes.SET_TOTAL, payload: 100 };
      const newState = tableStateReducer(initialState, action);
      expect(newState.total).toBe(action.payload);
    });

    it("should not modify state if payload is an invalid number", () => {
      const action = { type: tableActionTypes.SET_TOTAL, payload: -1 };
      const newState = tableStateReducer(initialState, action);
      expect(newState).toEqual(initialState);
    });
  });

  describe("SET_PAGE", () => {
    it("should set page if payload is a valid number", () => {
      const action = { type: tableActionTypes.SET_PAGE, payload: 2 };
      const newState = tableStateReducer(initialState, action);
      expect(newState.page).toBe(action.payload);
    });

    it("should not modify state if payload is an invalid number", () => {
      const action = { type: tableActionTypes.SET_PAGE, payload: -1 };
      const newState = tableStateReducer(initialState, action);
      expect(newState).toEqual(initialState);
    });
  });

  describe("SET_PER_PAGE", () => {
    it("should set perPage if payload is a valid option", () => {
      const action = { type: tableActionTypes.SET_PER_PAGE, payload: 20 };
      const newState = tableStateReducer(initialState, action);
      expect(newState.perPage).toBe(action.payload);
    });

    it("should not modify state if payload is not a valid option", () => {
      const action = { type: tableActionTypes.SET_PER_PAGE, payload: 15 };
      const newState = tableStateReducer(initialState, action);
      expect(newState).toEqual(initialState);
    });
  });

  describe("SET_PER_PAGE_OPTIONS", () => {
    it("should set perPageOptions if payload is a valid array of numbers", () => {
      const action = { type: tableActionTypes.SET_PER_PAGE_OPTIONS, payload: [5, 10, 15] };
      const newState = tableStateReducer(initialState, action);
      expect(newState.perPageOptions).toEqual(action.payload);
    });

    it("should not modify state if payload is not a valid array of numbers", () => {
      const action = {
        type: tableActionTypes.SET_PER_PAGE_OPTIONS,
        payload: [5, "ten", 15] as number[],
      };
      const newState = tableStateReducer(initialState, action);
      expect(newState).toEqual(initialState);
    });
  });

  describe("SET_SORT_DIRECTION", () => {
    it("should set sortDirection if payload is valid", () => {
      const action = { type: tableActionTypes.SET_SORT_DIRECTION, payload: "desc" as Order };
      const newState = tableStateReducer(initialState, action);
      expect(newState.sortDirection).toBe("desc");
    });

    it("should not modify state if payload is invalid", () => {
      const action = {
        type: tableActionTypes.SET_SORT_DIRECTION,
        payload: "down" as unknown as Order,
      };
      const newState = tableStateReducer(initialState, action);
      expect(newState).toEqual(initialState);
    });
  });

  describe("SET_ORDER_BY", () => {
    it("should set orderBy if payload is a string", () => {
      const action = { type: tableActionTypes.SET_ORDER_BY, payload: "name" };
      const newState = tableStateReducer(initialState, action);
      expect(newState.orderBy).toBe(action.payload);
    });
  });

  describe("SET_ALL", () => {
    const initialState: TableState<MockData> = {
      data: [],
      total: 0,
      page: 0,
      perPage: 10,
      perPageOptions: [10, 20, 30],
      sortDirection: "asc",
      orderBy: "",
    };

    it("should update all fields with valid payloads", () => {
      const action = {
        type: tableActionTypes.SET_ALL,
        payload: {
          total: 200,
          perPage: 20,
          page: 1,
          sortDirection: "desc",
          orderBy: "name",
        } as TableState<MockData>,
      };
      const expectedState = {
        ...initialState,
        ...action.payload,
      };
      const newState = tableStateReducer(initialState, action);
      expect(newState).toEqual(expectedState);
    });

    it("should ignore invalid values and only update valid ones", () => {
      const action = {
        type: tableActionTypes.SET_ALL,
        payload: {
          total: -100,
          perPage: 20, // valid
          page: -1,
          sortDirection: "desc", // valid
          orderBy: "name", // valid
        } as TableState<MockData>,
      };
      const expectedState: TableState<unknown> = {
        ...initialState,
        perPage: 20,
        sortDirection: "desc",
        orderBy: "name",
      };
      const newState = tableStateReducer(initialState, action);
      expect(newState).toEqual(expectedState);
    });

    it("should not update the state if all values are invalid", () => {
      const action = {
        type: tableActionTypes.SET_ALL,
        payload: {
          total: -100,
          perPage: 999,
          page: -1,
          sortDirection: "upwards" as unknown as Order, // invalid sort direction
          orderBy: 123 as unknown as string, // invalid type for orderBy
        } as Partial<TableState<MockData>>,
      };
      const newState = tableStateReducer(initialState, action);
      expect(newState).toEqual(initialState);
    });

    it("should handle partial updates with some fields missing", () => {
      const action = {
        type: tableActionTypes.SET_ALL,
        payload: {
          perPage: 30,
          orderBy: "updatedName",
        },
      };
      const expectedState = {
        ...initialState,
        perPage: 30,
        orderBy: "updatedName",
      };
      const newState = tableStateReducer(initialState, action);
      expect(newState).toEqual(expectedState);
    });

    it("should manage updates when some fields are null or undefined", () => {
      const action = {
        type: tableActionTypes.SET_ALL,
        payload: {
          total: null,
          page: undefined, // No update should occur
          sortDirection: "asc" as Order, // Valid and no change
          orderBy: undefined,
        },
      };
      const newState = tableStateReducer(initialState, action);
      expect(newState).toEqual({ ...initialState, sortDirection: "asc" });
    });
  });

  describe("TableReducer default case", () => {
    const initialState: TableState<MockData> = {
      data: [],
      total: 0,
      page: 0,
      perPage: 10,
      perPageOptions: [10, 20, 30],
      sortDirection: "asc",
      orderBy: "",
    };

    it("should throw an error for unexpected action types", () => {
      const action = { type: "UNKNOWN_ACTION" } as unknown as TableAction<MockData>;
      expect(() => tableStateReducer(initialState, action)).toThrow("Unexpected action type.");
    });
  });
});
