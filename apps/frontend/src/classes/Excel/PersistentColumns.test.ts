import { describe, expect, it, vi } from "vitest";

import {
  shouldPersistColumnValue,
  type ColumnKey,
  type PersistenceRule,
} from "./PersistentColumns";

const fooRule = vi.fn((value: string) => value === "foo");
const barRule = vi.fn((value: string) => value.startsWith("bar:"));

const mockPersistentColumns: readonly PersistenceRule[] = [
  {
    key: "mock.foo" as ColumnKey,
    shouldPersist: fooRule,
  },
  {
    key: "mock.bar" as ColumnKey,
    shouldPersist: barRule,
  },
];

describe("shouldPersistColumnValue", () => {
  const opts = { persistentColumns: mockPersistentColumns };

  it("uses the matching rule for the key and returns its result", () => {
    expect(shouldPersistColumnValue("mock.foo" as ColumnKey, "foo", opts)).toBe(true);
    expect(shouldPersistColumnValue("mock.foo" as ColumnKey, "nope", opts)).toBe(false);

    expect(shouldPersistColumnValue("mock.bar" as ColumnKey, "bar:123", opts)).toBe(true);
    expect(shouldPersistColumnValue("mock.bar" as ColumnKey, "baz", opts)).toBe(false);
  });

  it("trims the value before passing it to the rule", () => {
    fooRule.mockClear();
    barRule.mockClear();

    expect(shouldPersistColumnValue("mock.foo" as ColumnKey, "  foo  ", opts)).toBe(true);

    expect(fooRule).toHaveBeenCalledTimes(1);
    expect(fooRule).toHaveBeenCalledWith("foo");
  });

  it("stringifies non-string values before passing them to the rule", () => {
    fooRule.mockClear();
    barRule.mockClear();

    expect(shouldPersistColumnValue("mock.foo" as ColumnKey, null, opts)).toBe(false);
    expect(fooRule).toHaveBeenCalledWith("");

    barRule.mockClear();
    expect(shouldPersistColumnValue("mock.bar" as ColumnKey, 123, opts)).toBe(false);
    expect(barRule).toHaveBeenCalledWith("123");
  });

  it("returns false when there is no matching rule for the key", () => {
    fooRule.mockClear();
    barRule.mockClear();

    const result = shouldPersistColumnValue("some.other.key" as ColumnKey, "anything", opts);

    expect(result).toBe(false);
    expect(fooRule).not.toHaveBeenCalled();
    expect(barRule).not.toHaveBeenCalled();
  });
});
