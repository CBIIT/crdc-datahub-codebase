import { useEffect, useState } from "react";

import { Logger, safeParse } from "../utils";

/**
 * A utility function to retrieve a value from localStorage and parse it as JSON.
 * If the value is not found or parsing fails, it returns the initial value.
 *
 * @param key The key in localStorage.
 * @param initialValue The initial value to use if none is found in localStorage.
 * @returns The JSON-parsed value from localStorage or the initial value if not found.
 */
const retrieveFromLocalStorage = <T>(key: string, initialValue: T): T => {
  try {
    const item = window.localStorage.getItem(key);
    return safeParse<T>(item, initialValue);
  } catch (error) {
    Logger.error(error?.toString());
    return initialValue;
  }
};

/**
 * Custom hook to manage state synchronized with localStorage.
 * @param key The key in localStorage.
 * @param initialValue The initial value to use if none is found in localStorage.
 * @returns A stateful value and a function to update it.
 */
export const useLocalStorage = <T>(key: string, initialValue: T): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() =>
    retrieveFromLocalStorage<T>(key, initialValue)
  );

  /**
   * Sets the state and updates localStorage.
   * @param value The new value to store.
   */
  const setValue = (value: T): void => {
    try {
      setStoredValue(value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      Logger.error(error?.toString());
    }
  };

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        setStoredValue(safeParse<T>(event.newValue, initialValue));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [key, initialValue]);

  useEffect(() => {
    setStoredValue(retrieveFromLocalStorage<T>(key, initialValue));
  }, [key]);

  return [storedValue, setValue];
};
