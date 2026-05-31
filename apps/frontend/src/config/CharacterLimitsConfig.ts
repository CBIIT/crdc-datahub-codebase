import type { QuestionnaireData } from "@/schemas/Application";

type CharacterLimit = {
  min?: number;
  max?: number;
} & ({ min: number } | { max: number });

type CharacterLimitsConfig<T> = T extends Array<infer U>
  ? CharacterLimitsConfig<U>
  : T extends object
    ? { [K in keyof T]?: CharacterLimitsConfig<T[K]> }
    : CharacterLimit;

/**
 * Standardizes the character limits for QuestionnaireData fields.
 */
export const SR_CHARACTER_LIMITS = {
  study: {
    name: {
      max: 1_000,
    },
    abbreviation: {
      max: 1_000,
    },
  },
} satisfies CharacterLimitsConfig<QuestionnaireData>;
