import * as utils from "./factoryUtils";

describe("factoryUtils", () => {
  describe("attachSingleWithTypename", () => {
    it("should attach a __typename property to a single object", () => {
      const obj = { foo: "bar", num: 42 };
      const buildable = utils.attachSingleWithTypename(obj);

      expect(typeof buildable.withTypename).toBe("function");

      const result = buildable.withTypename("TestType");
      expect(result).toEqual({ foo: "bar", num: 42, __typename: "TestType" });
      expect(Object.prototype.hasOwnProperty.call(result, "__typename")).toBe(true);
    });

    it("should not enumerate withTypename property", () => {
      const obj = { foo: "bar" };
      const buildable = utils.attachSingleWithTypename(obj);

      expect(Object.keys(buildable)).not.toContain("withTypename");
    });

    it("should work with an empty object", () => {
      const buildable = utils.attachSingleWithTypename({});
      const result = buildable.withTypename("EmptyType");
      expect(result).toEqual({ __typename: "EmptyType" });
    });

    it("should not mutate the original object", () => {
      const obj = { foo: "bar" };
      const buildable = utils.attachSingleWithTypename(obj);
      buildable.withTypename("MutateTest");
      expect(obj).not.toHaveProperty("__typename");
    });

    it("should overwrite existing __typename property", () => {
      const obj = { foo: "bar", __typename: "OldType" };
      const buildable = utils.attachSingleWithTypename(obj);
      const result = buildable.withTypename("NewType");
      expect(result.__typename).toBe("NewType");
    });
  });

  describe("attachMultipleWithTypename", () => {
    it("should attach a __typename property to each object in the array", () => {
      const arr = [{ foo: 1 }, { foo: 2 }];
      const buildableArr = utils.attachMultipleWithTypename(arr);

      expect(typeof buildableArr.withTypename).toBe("function");

      const result = buildableArr.withTypename("ArrayType");
      expect(result).toEqual([
        { foo: 1, __typename: "ArrayType" },
        { foo: 2, __typename: "ArrayType" },
      ]);
      expect(result.every((item) => Object.prototype.hasOwnProperty.call(item, "__typename"))).toBe(
        true
      );
    });

    it("should not enumerate withTypename property on the array", () => {
      const arr = [{ foo: 1 }];
      const buildableArr = utils.attachMultipleWithTypename(arr);

      expect(Object.keys(buildableArr)).not.toContain("withTypename");
    });

    it("should work with an empty array", () => {
      const buildableArr = utils.attachMultipleWithTypename([]);
      const result = buildableArr.withTypename("EmptyArrayType");
      expect(result).toEqual([]);
    });

    it("should not mutate the original array", () => {
      const arr = [{ foo: 1 }];
      const buildableArr = utils.attachMultipleWithTypename(arr);
      buildableArr.withTypename("MutateArrayTest");
      expect(arr[0]).not.toHaveProperty("__typename");
    });

    it("should overwrite existing __typename property in array items", () => {
      const arr = [{ foo: 1, __typename: "OldType" }];
      const buildableArr = utils.attachMultipleWithTypename(arr);
      const result = buildableArr.withTypename("NewType");
      expect(result[0].__typename).toBe("NewType");
    });

    it("should handle array of empty objects", () => {
      const arr = [{}, {}];
      const buildableArr = utils.attachMultipleWithTypename(arr);
      const result = buildableArr.withTypename("EmptyObjType");
      expect(result).toEqual([{ __typename: "EmptyObjType" }, { __typename: "EmptyObjType" }]);
    });
  });
});
