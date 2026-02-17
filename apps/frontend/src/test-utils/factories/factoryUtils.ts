import { cloneDeep } from "lodash";

/**
 * Attaches a __typename property to a single object
 *
 * @param {T} data - The object to attach the __typename to
 * @returns {BuildableSingle<T>} A buildable object with a non-enumerable withTypename method
 */
export const attachSingleWithTypename = <T>(data: T): BuildableSingle<T> => {
  const buildable = cloneDeep(data) as BuildableSingle<T>;

  Object.defineProperty(buildable, "withTypename", {
    value: <K extends string>(typename: K) =>
      ({ ...buildable, __typename: typename }) as T & { __typename: K },
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return buildable;
};

/**
 * Attaches a __typename property to an array of objects
 *
 * @param {T[]} data - The array of objects to attach the __typename to
 * @returns {BuildableArray<T>} A buildable array with a non-enumerable withTypename method
 */
export const attachMultipleWithTypename = <T>(data: T[]): BuildableArray<T> => {
  const buildable = cloneDeep(data) as BuildableArray<T>;

  Object.defineProperty(buildable, "withTypename", {
    value: <K extends string>(typename: K) =>
      buildable.map((item) => ({ ...item, __typename: typename }) as T & { __typename: K }),
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return buildable;
};
