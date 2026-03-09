import { act, renderHook, waitFor } from "../test-utils";

import { useLocalStorage } from "./useLocalStorage";

type LocalStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

describe("useLocalStorage Hook", () => {
  let localStorageMock: LocalStorageMock;

  beforeEach(() => {
    // Create a mock for localStorage
    localStorageMock = (() => {
      let store: Record<string, string> = {};

      return {
        getItem(key: string): string | null {
          return store[key] || null;
        },
        setItem(key: string, value: string): void {
          store[key] = value;
        },
        removeItem(key: string): void {
          delete store[key];
        },
        clear(): void {
          store = {};
        },
      };
    })();

    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });

    window.localStorage.clear();
  });

  it("should initialize with the initial value when localStorage is empty", () => {
    const initialValue = "initial";
    const { result } = renderHook(() => useLocalStorage<string>("testKey", initialValue));

    const [storedValue] = result.current;
    expect(storedValue).toBe(initialValue);
  });

  it("should initialize with the value from localStorage if it exists", () => {
    const storedValue = 42;
    window.localStorage.setItem("numberKey", JSON.stringify(storedValue));

    const { result } = renderHook(() => useLocalStorage<number>("numberKey", 0));

    const [value] = result.current;
    expect(value).toBe(storedValue);
  });

  it("should update the state and localStorage when setValue is called", async () => {
    const initialValue = false;
    const newValue = true;

    const { result } = renderHook(() => useLocalStorage<boolean>("boolKey", initialValue));

    const [, setValue] = result.current;

    await waitFor(() => {
      setValue(newValue);
      const [updatedValue] = result.current;
      expect(updatedValue).toBe(newValue);
    });

    expect(window.localStorage.getItem("boolKey")).toBe(JSON.stringify(newValue));
  });

  it("should return the initial value if localStorage contains invalid JSON", () => {
    window.localStorage.setItem("invalidKey", "invalid JSON");

    const initialValue: { key: string } = { key: "value" };
    const { result } = renderHook(() =>
      useLocalStorage<{ key: string }>("invalidKey", initialValue)
    );

    const [value] = result.current;
    expect(value).toBe(initialValue);
  });

  it("should return the initial value when localStorage is unavailable", () => {
    // Backup the original getItem method
    const originalGetItem = window.localStorage.getItem;

    // Mock getItem to throw an error
    window.localStorage.getItem = () => {
      throw new Error("localStorage is unavailable");
    };

    const initialValue = "no localStorage";
    const { result } = renderHook(() => useLocalStorage<string>("noLocalStorageKey", initialValue));

    const [value] = result.current;
    expect(value).toBe(initialValue);

    // Restore the original getItem method
    window.localStorage.getItem = originalGetItem;
  });

  it("should safely handle localStorage write errors", () => {
    const originalSetItem = window.localStorage.setItem;

    // Mock setItem to throw an error
    window.localStorage.setItem = () => {
      throw new Error("localStorage write error");
    };

    const initialValue = "error test";
    const { result } = renderHook(() => useLocalStorage<string>("errorKey", initialValue));

    const [, setValue] = result.current;

    act(() => {
      expect(() => setValue("new value")).not.toThrow();
    });

    window.localStorage.setItem = originalSetItem; // Restore the original setItem method
  });

  it("should propagate value changes from a different window", () => {
    window.localStorage.setItem("crossWindowKey", JSON.stringify("cross-window"));

    const { result, rerender } = renderHook(() =>
      useLocalStorage<string>("crossWindowKey", "default")
    );

    const [value] = result.current;
    expect(value).toBe("cross-window");

    // Simulate a change in localStorage from another window
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "crossWindowKey",
          newValue: JSON.stringify("updated value"),
        })
      );
    });

    rerender();

    const [updatedValue] = result.current;
    expect(updatedValue).toBe("updated value");
  });

  it("should refetch the value from localStorage when the key changes (no value)", () => {
    const initialValue = "initial";
    const { result, rerender } = renderHook(
      ({ key }) => useLocalStorage<string>(key, initialValue),
      { initialProps: { key: "dynamicKey" } }
    );

    const [value] = result.current;
    expect(value).toBe(initialValue);

    // Change the key and rerender
    const newKey = "newDynamicKey";
    rerender({ key: newKey });

    // The value should still be the initial value since localStorage is empty for the new key
    const [newValue] = result.current;
    expect(newValue).toBe(initialValue);
  });

  it("should refetch the value from localStorage when the key changes (value change)", () => {
    window.localStorage.setItem("firstKey", JSON.stringify({ value: "first" }));
    window.localStorage.setItem("newKey", JSON.stringify({ value: "second" }));

    const { result, rerender } = renderHook(
      ({ key }) => useLocalStorage<{ value: string }>(key, { value: "default" }),
      { initialProps: { key: "firstKey" } }
    );

    expect(result.current[0]).toEqual({ value: "first" });

    rerender({ key: "newKey" });

    expect(result.current[0]).toEqual({ value: "second" });
  });
});
