import {
  validateTotal,
  validatePage,
  validateRowsPerPage,
  validatePerPageOptions,
  validateSortDirection,
  validateAndSetIfChanged,
  validateOrderBy,
  getValidationFn,
  filterData,
  sortData,
} from "./index";

interface TestData {
  name: string | null | undefined;
  age: number;
}

describe("tableUtils", () => {
  describe("validateTotal", () => {
    it("should return false for NaN values", () => {
      expect(validateTotal(NaN)).toBeFalsy();
    });

    it("should return false for negative values", () => {
      expect(validateTotal(-1)).toBeFalsy();
    });

    it("should return true for non-negative numbers", () => {
      expect(validateTotal(0)).toBeTruthy();
      expect(validateTotal(100)).toBeTruthy();
    });
  });

  describe("validatePage", () => {
    it("should return false if page is NaN", () => {
      expect(validatePage(NaN)).toBeFalsy();
    });

    it("should return false if the page is outside the minrange", () => {
      expect(validatePage(-1)).toBeFalsy();
    });

    it("should return true if the page is over the minrange", () => {
      expect(validatePage(1)).toBeTruthy();
      expect(validatePage(5)).toBeTruthy();
      expect(validatePage(10)).toBeTruthy();
    });
  });

  describe("validateRowsPerPage", () => {
    it("should return false for NaN values", () => {
      expect(validateRowsPerPage(NaN, [10, 20, 30])).toBeFalsy();
    });

    it("should return false if the perPage value is not in the options array", () => {
      expect(validateRowsPerPage(5, [10, 20, 30])).toBeFalsy();
    });

    it("should return true if the perPage value is in the options array", () => {
      expect(validateRowsPerPage(10, [10, 20, 30])).toBeTruthy();
      expect(validateRowsPerPage(20, [10, 20, 30])).toBeTruthy();
    });
  });

  describe("validatePerPageOptions", () => {
    it("should return false if perPageOptions is not an array", () => {
      expect(validatePerPageOptions(undefined)).toBeFalsy();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(validatePerPageOptions({} as any)).toBeFalsy();
    });

    it("should return false if any element in perPageOptions array is NaN", () => {
      expect(validatePerPageOptions([10, NaN, 30])).toBeFalsy();
    });

    it("should return true for a valid array of numbers", () => {
      expect(validatePerPageOptions([10, 20, 30])).toBeTruthy();
    });
  });

  describe("validateSortDirection", () => {
    it('should return true for "asc" and "desc"', () => {
      expect(validateSortDirection("asc")).toBeTruthy();
      expect(validateSortDirection("desc")).toBeTruthy();
    });

    it("should return false for any other values", () => {
      expect(validateSortDirection("ascending")).toBeFalsy();
      expect(validateSortDirection("")).toBeFalsy();
      expect(validateSortDirection("1")).toBeFalsy();
    });
  });

  describe("validateOrderBy", () => {
    it("should return true for null", () => {
      expect(validateOrderBy(null)).toBeTruthy();
    });

    it("should return true for an empty string", () => {
      expect(validateOrderBy("")).toBeTruthy();
    });

    it("should return true for a valid string", () => {
      expect(validateOrderBy("columnName")).toBeTruthy();
    });

    it("should return false for undefined", () => {
      expect(validateOrderBy(undefined)).toBeFalsy();
    });

    it("should return false for numbers", () => {
      expect(validateOrderBy(123 as unknown as string)).toBeFalsy();
    });

    it("should return false for boolean values", () => {
      expect(validateOrderBy(true as unknown as string)).toBeFalsy();
      expect(validateOrderBy(false as unknown as string)).toBeFalsy();
    });

    it("should return false for objects", () => {
      expect(validateOrderBy({} as unknown as string)).toBeFalsy();
    });

    it("should return false for arrays", () => {
      expect(validateOrderBy(["string"] as unknown as string)).toBeFalsy();
    });

    it("should return false for functions", () => {
      expect(validateOrderBy((() => {}) as unknown as string)).toBeFalsy();
    });
  });

  describe("validateAndSetIfChanged", () => {
    const initialState = { count: 0, name: "initial" };

    it("should update the state when the new value is valid and different", () => {
      const newState = validateAndSetIfChanged(initialState, "count", 10, validateTotal);
      expect(newState).toEqual({ ...initialState, count: 10 });
    });

    it("should not update the state when the new value is the same as the current value", () => {
      const newState = validateAndSetIfChanged(initialState, "count", 0, validateTotal);
      expect(newState).toBe(initialState);
    });

    it("should not update the state when the new value fails validation", () => {
      const newState = validateAndSetIfChanged(initialState, "count", -1, validateTotal);
      expect(newState).toBe(initialState);
    });

    it("should update the state when no validation function is provided", () => {
      const newState = validateAndSetIfChanged(initialState, "name", "updated");
      expect(newState).toEqual({ ...initialState, name: "updated" });
    });

    it("should not update the state when the new value is the same and no validation function is provided", () => {
      const newState = validateAndSetIfChanged(initialState, "name", "initial");
      expect(newState).toBe(initialState);
    });

    it("should update the state when the validation function is optional and the value is valid", () => {
      const optionalValidator = (value: number) => value >= 0;
      const newState = validateAndSetIfChanged(initialState, "count", 5, optionalValidator);
      expect(newState).toEqual({ ...initialState, count: 5 });
    });

    it("should not update the state when the optional validation function returns false", () => {
      const optionalValidator = (value: number) => value < 0;
      const newState = validateAndSetIfChanged(initialState, "count", 5, optionalValidator);
      expect(newState).toBe(initialState);
    });
  });

  describe("getValidationFn", () => {
    const state: TableState<unknown> = {
      data: [],
      total: 100,
      page: 1,
      perPage: 10,
      perPageOptions: [10, 20, 30],
      sortDirection: "asc",
      orderBy: "name",
    };

    it("should return Array.isArray for 'data' key", () => {
      const validationFn = getValidationFn(state, "data");
      expect(validationFn).toBe(Array.isArray);
    });

    it("should return validateTotal for 'total' key", () => {
      const validationFn = getValidationFn(state, "total");
      expect(validationFn).toBe(validateTotal);
    });

    it("should return validatePage for 'page' key", () => {
      const validationFn = getValidationFn(state, "page");
      expect(validationFn).toBe(validatePage);
    });

    it("should return a function that calls validateRowsPerPage for 'perPage' key", () => {
      const validationFn = getValidationFn(state, "perPage");
      expect(validationFn(10 as never)).toBeTruthy();
    });

    it("should return validatePerPageOptions for 'perPageOptions' key", () => {
      const validationFn = getValidationFn(state, "perPageOptions");
      expect(validationFn).toBe(validatePerPageOptions);
    });

    it("should return validateSortDirection for 'sortDirection' key", () => {
      const validationFn = getValidationFn(state, "sortDirection");
      expect(validationFn).toBe(validateSortDirection);
    });

    it("should return validateOrderBy for 'orderBy' key", () => {
      const validationFn = getValidationFn(state, "orderBy");
      expect(validationFn).toBe(validateOrderBy);
    });

    it("should throw an error for an invalid key", () => {
      expect(() => getValidationFn(state, "invalidKey" as never)).toThrow("Unexpected table key.");
    });
  });

  describe("sortData", () => {
    const testData: TestData[] = [
      { name: "John", age: 28 },
      { name: "Jane", age: 22 },
      { name: "Doe", age: 45 },
    ];

    it("should return empty array if invalid data is passed", () => {
      const result = sortData(null, "name", "asc");
      expect(result).toStrictEqual([]);
    });

    it("should sort data by name in ascending order", () => {
      const result = sortData(testData, "name", "asc");
      expect(result[0].name).toBe("Doe");
      expect(result[2].name).toBe("John");
    });

    it("should sort data by age in descending order", () => {
      const result = sortData(testData, "age", "desc");
      expect(result[0].age).toBe(45);
      expect(result[2].age).toBe(22);
    });

    it("should handle empty data array", () => {
      const result = sortData<TestData>([], "age", "asc");
      expect(result.length).toBe(0);
    });

    it("should handle invalid orderBy key", () => {
      const result = sortData(testData, "unknownKey", "asc");
      expect(result).toEqual(testData); // Should not change the original data
    });

    it("should not fail when comparator is undefined", () => {
      const result = sortData(testData, "name", "asc", undefined);
      expect(result[0].name).toBe("Doe");
      expect(result[2].name).toBe("John");
    });

    it("should use comparator when defined", () => {
      const result = sortData(testData, "name", "asc", (a, b) => (a.name === "John" ? -1 : 1));
      expect(result[0].name).toBe("John");
    });

    it("should handle sorting with null and undefined values correctly", () => {
      const mixedData = [
        { name: null, age: 34 },
        { name: undefined, age: 47 },
        { name: "Alice", age: 30 },
      ];
      const result = sortData(mixedData, "name", "asc");
      expect(result[0].name).toBeNull();
      expect(result[1].name).toBeUndefined();
      expect(result[2].name).toBe("Alice");
    });
  });

  describe("filterData", () => {
    const testData: TestData[] = [
      { name: "John", age: 28 },
      { name: "Jane", age: 22 },
      { name: "Doe", age: 45 },
    ];

    it("should filter data by age greater than 25", () => {
      const filters = [(item: TestData) => item.age > 25];
      const result = filterData(testData, filters);
      expect(result.length).toBe(2);
      expect(result.every((item) => item.age > 25)).toBeTruthy();
    });

    it("should filter data by name starting with J", () => {
      const filters = [(item: TestData) => item.name?.startsWith("J") ?? false];
      const result = filterData(testData, filters);
      expect(result.length).toBe(2);
      expect(result.some((item) => item.name === "John")).toBeTruthy();
      expect(result.some((item) => item.name === "Jane")).toBeTruthy();
    });

    it("should return all items if no filters are provided", () => {
      const result = filterData(testData, []);
      expect(result.length).toBe(3);
    });

    it("should handle data containing null and undefined values", () => {
      const mixedData: TestData[] = [
        { name: "Alice", age: 30 },
        { name: null, age: 40 },
        { name: undefined, age: 50 },
      ];
      const filters = [(item: TestData) => item.name !== undefined];
      const result = filterData(mixedData, filters);
      expect(result.length).toBe(2);
      expect(result.some((item) => item.name === "Alice")).toBeTruthy();
    });

    it("should return an empty array if all items are filtered out", () => {
      const filters = [(item: TestData) => item.age > 100]; // No one is over 100
      const result = filterData(testData, filters);
      expect(result.length).toBe(0);
    });

    it("should not mutate the original data array", () => {
      const originalData = [...testData];
      const filters = [(item: TestData) => item.age < 50];
      filterData(testData, filters);
      expect(testData).toEqual(originalData);
    });
  });
});
