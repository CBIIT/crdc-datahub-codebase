import { useEffect } from "react";

/**
 * A hook to set and restore the page title
 *
 * @param title The new title to set
 * @param [restore] Restore the title on unmount
 */
const usePageTitle = (title: string, restore = true): void => {
  // Update title on mount
  useEffect(() => {
    document.title = title;
  }, [title]);

  // Revert on unmount if requested
  useEffect(() => {
    if (!restore) {
      return () => {};
    }

    return () => {
      document.title = "CRDC Submission Portal";
    };
  }, []);
};

export default usePageTitle;
