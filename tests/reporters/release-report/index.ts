import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite } from '@playwright/test/reporter';

import { QaReportOptions, resolveOptions } from './config';
import { buildReportData } from './collect';
import { writePdf } from './pdf';

function timestampSlug(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

/**
 * Generates one QA Release Verification PDF per automation run, plus the
 * structured execution data it was generated from. Each run writes to its own
 * directory so previously generated evidence is never modified.
 */
export default class QaReleaseReporter implements Reporter {
  private readonly options: ReturnType<typeof resolveOptions>;

  private config!: FullConfig;

  private suite!: Suite;

  private startedAt = new Date();

  private plannedAtStart = 0;

  private reportDir = '';

  constructor(userOptions: QaReportOptions = {}) {
    this.options = resolveOptions(userOptions);
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
    this.startedAt = new Date();
    this.plannedAtStart = suite.allTests().length;

    const baseDir = config.configFile ? path.dirname(config.configFile) : config.rootDir;
    this.reportDir = path.resolve(baseDir, this.options.outputDir, timestampSlug(this.startedAt));
    fs.mkdirSync(this.reportDir, { recursive: true });
  }

  async onEnd(result: FullResult): Promise<void> {
    if (!this.reportDir) {
      return;
    }

    const data = buildReportData({
      config: this.config,
      suite: this.suite,
      result,
      options: this.options,
      reportDir: this.reportDir,
      plannedAtStart: this.plannedAtStart,
      startedAt: this.startedAt,
    });

    const pdfPath = path.join(this.reportDir, `${this.options.fileName}.pdf`);
    const jsonPath = path.join(this.reportDir, `${this.options.fileName}.json`);

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');

    try {
      await writePdf(data, this.options, this.reportDir, pdfPath);
      // eslint-disable-next-line no-console
      console.log(`\nQA Release Verification document: ${pdfPath}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `\nQA Release Verification document could not be written (${String(error)}).\nExecution data: ${jsonPath}`
      );
    }
  }
}
