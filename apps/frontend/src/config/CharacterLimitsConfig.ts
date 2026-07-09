type CharacterLimit = {
  min?: number;
  max?: number;
} & ({ min: number } | { max: number });

type CharacterLimitTree = {
  [key: string]: CharacterLimit | CharacterLimitTree;
};

type CharacterLimitsConfig = CharacterLimitTree;

/**
 * Standardizes character limits across the application.
 */
export const CHARACTER_LIMITS = {
  study: {
    name: {
      max: 1_000,
    },
    abbreviation: {
      max: 50,
    },
  },
} satisfies CharacterLimitsConfig;
