export type QaReportOptions = {
  /** Directory (relative to the Playwright config dir) for the generated document. */
  outputDir?: string;
  /** Base file name, without extension. */
  fileName?: string;
  /** Product/application name shown on page 1. */
  product?: string;
  /** Tags that mark a scenario as release-critical. */
  criticalTags?: string[];
  /** Tags treated as test categories (functional, api, ui, accessibility, ...). */
  categoryTags?: string[];
  /** Maps a test file path prefix (relative to testDir) to a functional area name. */
  areaMap?: Record<string, string>;
  /** Max screenshots embedded per attempt. */
  maxScreenshotsPerAttempt?: number;
  /** Embed a final-state screenshot for passing critical scenarios. */
  includeSuccessEvidence?: boolean;
};

export type ResolvedOptions = Required<Omit<QaReportOptions, 'areaMap'>> & {
  areaMap: Record<string, string>;
};

export const DEFAULT_CRITICAL_TAGS = [
  '@critical',
  '@smoke',
];

export const DEFAULT_CATEGORY_TAGS = [
  '@regression',
  '@smoke',
  '@accessibility',
];

export function resolveOptions(options: QaReportOptions = {}): ResolvedOptions {
  return {
    outputDir: options.outputDir ?? 'qa-release-report',
    fileName: options.fileName ?? 'qa-release-verification',
    product: options.product ?? process.env.QA_PRODUCT_NAME ?? 'CRDC Data Hub',
    criticalTags: options.criticalTags ?? DEFAULT_CRITICAL_TAGS,
    categoryTags: options.categoryTags ?? DEFAULT_CATEGORY_TAGS,
    areaMap: options.areaMap ?? {},
    maxScreenshotsPerAttempt: options.maxScreenshotsPerAttempt ?? 3,
    includeSuccessEvidence: options.includeSuccessEvidence ?? true,
  };
}

export const NOT_AVAILABLE = 'Not available';

/** Reads an environment value without inventing a placeholder value. */
export function env(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return NOT_AVAILABLE;
}
