/**
 * Defines the shape of the error messages catalog.
 */
type ErrorEntry = {
  [key: string]: (() => string) | ((args: unknown) => string);
};

/**
 * A catalog of error message templates used for form validation.
 * Each entry is a function that returns a formatted error message string.
 */
const T = {
  // length
  min: ({ min }: { min: number }) => `Must be greater than ${min}.`,
  max: ({ max }: { max: number }) => `Must be less than or equal to ${max} characters.`,
  requiredMax: ({ max }: { max: number }) =>
    `This field is required. ${max} characters are allowed.`,

  // selections
  yesNo: () => `Please select 'Yes' or 'No' from the dropdown`,
  fromDropdown: (p?: { label?: string }) =>
    `Please select ${p?.label ?? "a value"} from the dropdown`,

  // formats
  email: () => `Please provide a valid email address.`,
  orcid: () => `Please provide a valid ORCID.`,
  dbGaPPHSNumber: () => `Please provide a valid dbGaP PHS number.`,
  phone: () => `Please provide a valid phone number containing only numbers, spaces, and dashes.`,
  dateMMDDYYYY: () => `The date is invalid. Please enter a date in the format MM/DD/YYYY.`,

  // numeric
  between: ({ min, max }: { min: number | string; max: number | string }) =>
    `Value must be between ${Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
      typeof min === "string" ? parseFloat(min) : min
    )} and ${Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
      typeof max === "string" ? parseFloat(max) : max
    )}.`,

  // generic
  invalidOperation: () => `Invalid operation.`,
} as const satisfies ErrorEntry;

// Helper Types
type IsFunc<T> = T extends (...args: readonly unknown[]) => unknown ? true : false;

export type ErrorKey = {
  [K in keyof typeof T]: IsFunc<(typeof T)[K]> extends true ? K : never;
}[keyof typeof T];

type ParamsOf<F> = F extends () => string
  ? undefined
  : F extends (a: infer A) => string
    ? A
    : never;

export type ErrorParams<K extends ErrorKey> = ParamsOf<(typeof T)[K]>;

type ArgsFor<F> = F extends (...args: infer P) => string
  ? P extends []
    ? []
    : P extends [infer A]
      ? undefined extends A
        ? [] | [Exclude<A, undefined>]
        : [A]
      : never
  : never;

/**
 * A catalog for managing error message templates.
 */
export const ErrorCatalog = {
  get<K extends ErrorKey>(key: K, ...args: ArgsFor<(typeof T)[K]>): string {
    const fn = T[key] as (...a: unknown[]) => string;
    return fn(...(args as [] | [unknown]));
  },

  keys(): ReadonlyArray<ErrorKey> {
    return Object.keys(T) as ReadonlyArray<ErrorKey>;
  },

  templates: T,
} as const;
