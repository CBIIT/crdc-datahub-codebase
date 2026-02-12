import { debounce } from "lodash";
import { useEffect, useRef } from "react";

type UseDebouncedWatchParams<TForm> = {
  /**
   * The `watch` function from react-hook-form or useFormContext.
   */
  watch: (callback: (values: TForm, details: { name?: string }) => void) => {
    unsubscribe: () => void;
  };
  /**
   * The fields to debounce.
   */
  fieldsToDebounce: (keyof TForm)[];
  /**
   * Define the minimum lengths per field, otherwise use the defaultMinLength
   */
  minLengths?: Partial<Record<keyof TForm, number>>;
  /**
   * The default minimum length used when the minimum length is not specifically
   * defined for a field
   */
  defaultMinLength?: number;
  /**
   * Time delay before debounce is triggered
   */
  debounceMs?: number;
  /**
   * The callback that is called when form values change.
   */
  onChange: (values: TForm) => void;
};

/**
 * Watches form values in react-hook-form and applies debounce logic for
 * specified fields once their values meet a length threshold.
 */
export const useDebouncedWatch = <TForm>({
  watch,
  fieldsToDebounce,
  minLengths = {},
  defaultMinLength = 3,
  debounceMs = 500,
  onChange,
}: UseDebouncedWatchParams<TForm>) => {
  const debouncedOnChangeRef = useRef(
    debounce((values: TForm) => {
      onChange(values);
    }, debounceMs)
  ).current;

  useEffect(() => {
    const subscription = watch((values: TForm, { name }) => {
      if (!name || !fieldsToDebounce.includes(name as keyof TForm)) {
        return;
      }

      const value = values[name as keyof TForm];
      const length = typeof value === "string" ? value.length : 0;
      const requiredLength = minLengths[name as keyof TForm] ?? defaultMinLength;

      if (length >= requiredLength) {
        // If enough characters, trigger the debounced callback
        debouncedOnChangeRef(values);
      } else if (length > 0 && length < requiredLength) {
        // Cancel any pending debounce if below required length
        debouncedOnChangeRef.cancel();
      } else if (length === 0) {
        // If value cleared, then cancel and call onChange immediately
        debouncedOnChangeRef.cancel();
        onChange(values);
      }
    });

    return () => {
      debouncedOnChangeRef.cancel();
      subscription.unsubscribe();
    };
  }, [
    watch,
    fieldsToDebounce,
    minLengths,
    defaultMinLength,
    debounceMs,
    onChange,
    debouncedOnChangeRef,
  ]);
};
