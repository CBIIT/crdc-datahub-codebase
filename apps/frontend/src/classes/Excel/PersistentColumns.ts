import dayjs from "dayjs";
import { toString } from "lodash";

import { AKeys } from "./A/Columns";
import { BKeys } from "./B/Columns";
import { CKeys } from "./C/Columns";
import { DKeys } from "./D/Columns";

export type ColumnKey = AKeys | BKeys | CKeys | DKeys;

export type PersistenceRule = {
  key: ColumnKey;
  shouldPersist: (value: string) => boolean;
};

/**
 * Columns that retain values if they meet minimum requirements,
 * even if other validations fail.
 */
export const PERSISTENT_COLUMNS: PersistenceRule[] = [
  {
    key: "targetedSubmissionDate",
    shouldPersist: (value: string) => dayjs(value, "MM/DD/YYYY", true)?.isValid(),
  },
  {
    key: "targetedReleaseDate",
    shouldPersist: (value: string) => dayjs(value, "MM/DD/YYYY", true)?.isValid(),
  },
];

/**
 * Helper to check if a column value should persist its value, even if validation fails.
 *
 * @param {ColumnKey} key - The column key to check
 * @param {unknown} value - The value to validate
 * @returns True if the value should persist, false otherwise
 */
export const shouldPersistColumnValue = (
  key: ColumnKey,
  value: unknown,
  opts?: { persistentColumns: readonly PersistenceRule[] }
): boolean => {
  const columns = opts?.persistentColumns || PERSISTENT_COLUMNS;
  const rule = columns.find((r) => r.key === key);

  return rule ? rule.shouldPersist(toString(value)?.trim()) : false;
};
