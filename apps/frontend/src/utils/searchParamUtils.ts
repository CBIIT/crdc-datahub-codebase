/**
 * Modifies URLSearchParams based on the provided current and default parameters.
 * Sets new search parameters if the current value differs from the default value,
 * and removes parameters that match the default value or are undefined.
 *
 * @param {URLSearchParams} searchParams - The existing URL search parameters.
 * @param {{ [key: string]: string | number }} currentParams - Current parameters to compare and set.
 * @param {{ [key: string]: string | number }} defaultParams - Default parameters to compare against.
 * @returns {URLSearchParams} - The updated URLSearchParams object.
 */
export const generateSearchParameters = (
  searchParams: URLSearchParams,
  currentParams: { [key: string]: string | number },
  defaultParams: { [key: string]: string | number }
): URLSearchParams => {
  const newParams = searchParams;

  Object.keys(currentParams).forEach((key) => {
    const currentValue = currentParams[key]?.toString();
    const defaultValue = defaultParams[key]?.toString();

    // Check if the current value is different from the default value
    if (currentValue && currentValue !== defaultValue) {
      newParams.set(key, currentValue.toString());
    } else {
      newParams.delete(key);
    }
  });

  return newParams;
};
