/**
 * Base type for API pagination parameters.
 */
type BasePaginationParams<T = unknown> = {
  /**
   * Number of items to return per page.
   *
   * @note `-1` indicates no limit.
   */
  first?: number;
  /**
   * Offset for pagination.
   */
  offset?: number;
  /**
   * The field to order by.
   */
  orderBy?: keyof T | string;
  /**
   * Direction to sort the results.
   */
  sortDirection?: "ASC" | "DESC" | "asc" | "desc";
};
