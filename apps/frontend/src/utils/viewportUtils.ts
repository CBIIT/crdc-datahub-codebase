/**
 * Gets the current viewport height, or returns a fallback value if window is unavailable.
 *
 * @param {number} fallback - Default height if window is unavailable
 * @return {number} Current viewport height in pixels
 */
export const getViewportHeightPx = (fallback: number): number => {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.innerHeight;
};
