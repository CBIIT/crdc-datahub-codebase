import { useState, useEffect } from "react";

/**
 * Custom hook to delay the display of a loading indicator.
 * This helps in avoiding flicker effects in UI by not immediately showing a loading indicator for fast API responses.
 *
 * @param {boolean} isLoading - Boolean state indicating if an async operation is in progress.
 * @param {number} delay - Number of milliseconds to delay before showing the loading indicator. Default is 1000ms.
 * @returns {boolean} - Boolean indicating whether to show the loading indicator.
 */
export const useDelayedLoading = (isLoading: boolean, delay = 200): boolean => {
  const [showLoading, setShowLoading] = useState<boolean>(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (isLoading) {
      timer = setTimeout(() => setShowLoading(true), delay);
    } else {
      setShowLoading(false);
    }

    return () => clearTimeout(timer);
  }, [isLoading, delay]);

  return showLoading;
};
