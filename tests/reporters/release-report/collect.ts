import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  FullConfig,
  FullResult,
  Suite,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

import { NOT_AVAILABLE, ResolvedOptions, env } from './config';
import { redact } from './redact';
import type {
  AssertionDetail,
  Attempt,
  CriticalSummary,
  Evidence,
  EvidenceType,
  FunctionalArea,
  ReportData,
  RunMetrics,
  Scenario,
  ScenarioStatus,
  VerificationState,
} from './model';

const ANSI = /\u001B\[[0-9;]*m/g;

const METRIC_DEFINITIONS = [
  {
    term: 'Planned scenarios',
    definition: 'Scenarios selected for this execution by the automation configuration.',
  },
  {
    term: 'Executed scenarios',
    definition: 'Planned scenarios that started execution and produced at least one non-skipped attempt.',
  },
  {
    term: 'Execution completeness',
    definition: 'Executed scenarios divided by planned scenarios.',
  },
  {
    term: 'Pass rate',
    definition: 'Passed scenarios divided by scenarios that produced a valid assertion result (passed or failed).',
  },
  {
    term: 'First-attempt pass rate',
    definition: 'Scenarios passing on their initial attempt divided by scenarios that executed an initial attempt.',
  },
  {
    term: 'Retry count',
    definition: 'Number of additional execution attempts recorded after the original attempt.',
  },
  {
    term: 'Critical scenarios',
    definition: 'Scenarios carrying a configured release-critical tag in their automation metadata.',
  },
];

export function clean(text: string | undefined | null): string {
  return redact((text ?? '').replace(ANSI, '')).trim();
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function annotation(test: TestCase, type: string): string | undefined {
  const found = test.annotations.find((a) => a.type === type);
  return found?.description?.trim() || undefined;
}

function mapStatus(result: TestResult, test: TestCase): ScenarioStatus {
  switch (result.status) {
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
    case 'timedOut':
      // Playwright reliably distinguishes a timeout from an assertion failure.
      return 'Errored';
    case 'interrupted':
      return 'Incomplete';
    case 'skipped':
      return test.expectedStatus === 'skipped' ? 'Skipped' : 'Incomplete';
    default:
      return 'Incomplete';
  }
}

function evidenceType(name: string, contentType: string): EvidenceType {
  if (contentType.startsWith('image/')) return 'screenshot';
  if (contentType.startsWith('video/')) return 'video';
  if (name === 'trace' || contentType === 'application/zip') return 'trace';
  if (name === 'error-context') return 'error-context';
  if (contentType.startsWith('text/') || contentType === 'application/json') return 'log';
  return 'file';
}

function describeEvidence(type: EvidenceType, name: string, status: ScenarioStatus, step?: string): string {
  const context = step ? ` — ${step}` : '';
  switch (type) {
    case 'screenshot':
      return status === 'Passed'
        ? `Successful checkpoint — ${name}${context}`
        : `Failure evidence — ${name}${context}`;
    case 'video':
      return `Session recording of the attempt${context}`;
    case 'trace':
      return 'Playwright trace for step-by-step replay of the attempt';
    case 'error-context':
      return 'Page snapshot captured at the point execution stopped';
    case 'log':
      return `Captured output — ${name}${context}`;
    default:
      return `Captured artifact — ${name}${context}`;
  }
}

/** Extracts expected/observed values without interpreting why they differ. */
function parseAssertion(message: string): AssertionDetail | undefined {
  if (!message) {
    return undefined;
  }

  const lines = message.split('\n');
  const pick = (prefixes: string[]): string | undefined => {
    for (const line of lines) {
      const trimmed = line.trim();
      for (const prefix of prefixes) {
        if (trimmed.toLowerCase().startsWith(prefix)) {
          const value = trimmed.slice(prefix.length).replace(/^[:\s]+/, '').trim();
          if (value) {
            return value;
          }
        }
      }
    }
    return undefined;
  };

  const expected = pick(['expected string', 'expected pattern', 'expected value', 'expected']);
  const observed = pick(['received string', 'received value', 'received']);
  const headline = lines.find((l) => l.trim().length > 0)?.trim();

  if (!expected && !observed && !headline) {
    return undefined;
  }

  return { expected, observed, message: headline };
}

function deepestFailedStep(steps: TestStep[], trail: string[] = []): string | undefined {
  for (const step of steps) {
    if (!step.error) {
      continue;
    }
    const nextTrail = [...trail, step.title];
    return deepestFailedStep(step.steps, nextTrail) ?? nextTrail.join(' > ');
  }
  return undefined;
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'artifact';
}

function areaForTest(test: TestCase, rootDir: string, options: ResolvedOptions): string {
  const explicit = annotation(test, 'area');
  if (explicit) {
    return explicit;
  }

  const baseDir = testDirOf(test) ?? rootDir;
  const relative = path.relative(baseDir, test.location.file).split(path.sep).join('/');
  for (const [prefix, name] of Object.entries(options.areaMap)) {
    if (relative.startsWith(prefix)) {
      return name;
    }
  }

  const segments = relative.split('/');
  return titleCase(segments.length > 1 ? segments[0] : path.basename(relative, path.extname(relative)));
}

function testDirOf(test: TestCase): string | undefined {
  let suite: Suite | undefined = test.parent;
  while (suite) {
    const project = suite.project();
    if (project) {
      return project.testDir;
    }
    suite = suite.parent;
  }
  return undefined;
}

function projectOf(test: TestCase): string {
  let suite: Suite | undefined = test.parent;
  while (suite) {
    if (suite.project()) {
      return suite.project()!.name;
    }
    suite = suite.parent;
  }
  return NOT_AVAILABLE;
}

function suiteTitleOf(test: TestCase): string {
  const titles = test.titlePath();
  // titlePath: [ '', project, file, ...describe blocks, test title ]
  const describes = titles.slice(3, -1).filter(Boolean);
  return describes.length ? describes.join(' > ') : path.basename(test.location.file);
}

export type CollectInput = {
  config: FullConfig;
  suite: Suite;
  result: FullResult;
  options: ResolvedOptions;
  reportDir: string;
  plannedAtStart: number;
  startedAt: Date;
};

export function buildReportData(input: CollectInput): ReportData {
  const { config, suite, result, options, reportDir, plannedAtStart, startedAt } = input;
  const rootDir = config.rootDir;
  const evidenceRoot = path.join(reportDir, 'evidence');
  const missingEvidence: Evidence[] = [];

  const scenarios: Scenario[] = [];

  for (const test of suite.allTests()) {
    const technicalId = test
      .titlePath()
      .filter(Boolean)
      .join(' > ');
    const id = crypto.createHash('sha1').update(test.id || technicalId).digest('hex').slice(0, 12);
    const tags = [...test.tags];
    const critical = tags.some((tag) => options.criticalTags.includes(tag.toLowerCase()));
    const categories = tags
      .filter((tag) => options.categoryTags.includes(tag.toLowerCase()))
      .map((tag) => titleCase(tag.replace(/^@/, '')));

    const attempts: Attempt[] = test.results.map((testResult) => {
      const status = mapStatus(testResult, test);
      const errors = (testResult.errors ?? []).map((e) => clean(e.message || e.value));
      const primaryError = errors[0] ?? '';
      const failedStep = deepestFailedStep(testResult.steps);
      const attemptNumber = testResult.retry + 1;

      const evidence: Evidence[] = [];
      for (const attachment of testResult.attachments) {
        const type = evidenceType(attachment.name, attachment.contentType || '');
        const targetDir = path.join(evidenceRoot, id, String(attemptNumber));
        const extension =
          path.extname(attachment.path ?? '') ||
          (attachment.contentType?.includes('png') ? '.png' : '') ||
          (attachment.contentType?.includes('webm') ? '.webm' : '') ||
          (attachment.contentType?.includes('zip') ? '.zip' : '') ||
          '';
        const fileName = `${safeName(attachment.name)}-${evidence.length + 1}${extension}`;
        const target = path.join(targetDir, fileName);

        const record: Evidence = {
          type,
          name: attachment.name,
          contentType: attachment.contentType || NOT_AVAILABLE,
          description: describeEvidence(type, attachment.name, status, failedStep),
          scenarioId: id,
          attemptNumber,
          step: failedStep,
          timestamp: testResult.startTime?.toISOString(),
        };

        try {
          fs.mkdirSync(targetDir, { recursive: true });
          if (attachment.body) {
            fs.writeFileSync(target, attachment.body);
          } else if (attachment.path && fs.existsSync(attachment.path)) {
            fs.copyFileSync(attachment.path, target);
          } else {
            record.missingReason = 'Artifact referenced by the framework was not present on disk when the report was generated.';
          }
        } catch (error) {
          record.missingReason = `Artifact could not be retained: ${clean(String(error))}`;
        }

        if (!record.missingReason) {
          record.path = path.relative(reportDir, target).split(path.sep).join('/');
          record.sizeBytes = fs.statSync(target).size;
        } else {
          missingEvidence.push(record);
        }

        evidence.push(record);
      }

      if ((status === 'Failed' || status === 'Errored') && !evidence.some((e) => e.type === 'screenshot')) {
        const record: Evidence = {
          type: 'screenshot',
          name: 'screenshot',
          contentType: 'image/png',
          description: 'Failure screenshot was expected for this attempt but was not produced by the automation run.',
          missingReason: 'No screenshot attachment was recorded for this attempt.',
          scenarioId: id,
          attemptNumber,
        };
        missingEvidence.push(record);
        evidence.push(record);
      }

      return {
        attemptNumber,
        status,
        frameworkStatus: testResult.status,
        startTime: testResult.startTime?.toISOString(),
        endTime: testResult.startTime
          ? new Date(testResult.startTime.getTime() + testResult.duration).toISOString()
          : undefined,
        durationMs: testResult.duration,
        failedStep,
        assertion: parseAssertion(primaryError),
        errorMessages: errors,
        skipReason: status === 'Skipped' ? annotation(test, 'skip') ?? annotation(test, 'fixme') : undefined,
        evidence,
        workerIndex: testResult.workerIndex,
      } satisfies Attempt;
    });

    const finalAttempt = attempts[attempts.length - 1];
    const status: ScenarioStatus = finalAttempt ? finalAttempt.status : 'Incomplete';
    const executed = attempts.some((a) => a.frameworkStatus !== 'skipped');
    const producedAssertionResult = status === 'Passed' || status === 'Failed';

    scenarios.push({
      id,
      name: annotation(test, 'scenario') ?? test.title,
      technicalId,
      file: path.relative(rootDir, test.location.file).split(path.sep).join('/'),
      line: test.location.line,
      area: areaForTest(test, rootDir, options),
      suite: suiteTitleOf(test),
      tags,
      categories,
      critical,
      project: projectOf(test),
      platform: `${process.platform} / node ${process.version}`,
      status,
      frameworkFlaky: test.outcome() === 'flaky',
      executed,
      producedAssertionResult,
      firstAttemptPassed: attempts[0]?.status === 'Passed',
      attempts,
      totalDurationMs: attempts.reduce((sum, a) => sum + a.durationMs, 0),
      annotations: test.annotations.map((a) => ({
        type: a.type,
        description: clean(a.description),
      })),
    });
  }

  const metrics = computeMetrics(scenarios, plannedAtStart, startedAt);
  const critical = computeCritical(scenarios);
  const areas = computeAreas(scenarios);
  const { state, reasons } = computeVerificationState(metrics, result.status);

  const endedAt = new Date();
  const rawGrep = String(config.grep ?? '');
  const grepInclude = rawGrep === '/.*/' ? 'No tag filter applied' : rawGrep;
  const grepInvert = config.grepInvert ? String(config.grepInvert) : 'No tags excluded';

  return {
    release: {
      product: options.product,
      version: env('QA_RELEASE_VERSION', 'RELEASE_VERSION'),
      releaseCandidate: env('QA_RELEASE_CANDIDATE', 'RELEASE_CANDIDATE'),
      build: env('QA_BUILD_ID', 'BUILD_ID', 'GITHUB_RUN_NUMBER'),
      commit: env('QA_COMMIT_SHA', 'GITHUB_SHA', 'COMMIT_SHA'),
      package: env('QA_PACKAGE_ID', 'PACKAGE_ID'),
      environment: env('QA_ENVIRONMENT', 'TEST_ENV', 'ENVIRONMENT'),
      environmentUrl: env('QA_BASE_URL', 'BASE_URL'),
    },
    run: {
      runId: env('QA_RUN_ID', 'GITHUB_RUN_ID') === NOT_AVAILABLE
        ? crypto.randomUUID()
        : env('QA_RUN_ID', 'GITHUB_RUN_ID'),
      reportId: crypto.randomUUID(),
      reportVersion: '1.0',
      pipeline: env('GITHUB_WORKFLOW', 'CI_JOB_NAME', 'QA_PIPELINE'),
      startTime: startedAt.toISOString(),
      endTime: endedAt.toISOString(),
      generatedAt: endedAt.toISOString(),
      frameworkStatus: result.status,
      verificationState: state,
      verificationStateReasons: reasons,
      configuration: [
        { label: 'Test directory', value: testDirs(config, rootDir) },
        { label: 'Projects executed', value: config.projects.map((p) => p.name).join(', ') || NOT_AVAILABLE },
        { label: 'Workers', value: String(config.workers) },
        { label: 'Fully parallel', value: String(config.fullyParallel) },
        { label: 'Max failures', value: String(config.maxFailures || 'Not limited') },
        { label: 'Retry configuration', value: String(config.projects[0]?.retries ?? 0) },
        { label: 'Timeout per test (ms)', value: String(config.projects[0]?.timeout ?? NOT_AVAILABLE) },
        { label: 'Tags included (grep)', value: grepInclude || NOT_AVAILABLE },
        { label: 'Tags excluded (grep-invert)', value: grepInvert },
        { label: 'Shard', value: config.shard ? `${config.shard.current}/${config.shard.total}` : 'Not sharded' },
        { label: 'Playwright version', value: config.version },
        { label: 'Forbid only', value: String(config.forbidOnly) },
      ],
      selection: {
        availableInRepository: Number.isFinite(Number(process.env.QA_TESTS_IN_REPOSITORY))
          ? Number(process.env.QA_TESTS_IN_REPOSITORY)
          : null,
        selectedForExecution: plannedAtStart,
        grepInclude: grepInclude || NOT_AVAILABLE,
        grepExclude: grepInvert,
        projects: config.projects.map((p) => p.name),
        shard: config.shard ? `${config.shard.current}/${config.shard.total}` : 'Not sharded',
      },
    },
    environment: [
      { label: 'Environment name', value: env('QA_ENVIRONMENT', 'TEST_ENV', 'ENVIRONMENT') },
      { label: 'Application URL', value: env('QA_BASE_URL', 'BASE_URL') },
      { label: 'Frontend version', value: env('QA_FRONTEND_VERSION') },
      { label: 'Backend version', value: env('QA_BACKEND_VERSION') },
      { label: 'API version', value: env('QA_API_VERSION') },
      { label: 'Data model version', value: env('QA_MODEL_VERSION') },
      { label: 'Browsers', value: browsersOf(config) },
      { label: 'Operating system', value: `${process.platform} ${process.arch}` },
      { label: 'Node.js version', value: process.version },
      { label: 'Automation framework', value: `Playwright ${config.version}` },
      { label: 'CI pipeline', value: env('GITHUB_WORKFLOW', 'CI_JOB_NAME', 'QA_PIPELINE') },
      { label: 'CI job URL', value: env('QA_JOB_URL', 'BUILD_URL') },
    ],
    metrics,
    critical,
    areas,
    scenarios,
    missingEvidence,
    metricDefinitions: METRIC_DEFINITIONS,
  };
}

function testDirs(config: FullConfig, rootDir: string): string {
  const dirs = new Set(
    config.projects.map(
      (project) => path.relative(rootDir, project.testDir).split(path.sep).join('/') || '.'
    )
  );
  return [...dirs].join(', ') || NOT_AVAILABLE;
}

function browsersOf(config: FullConfig): string {
  const names = new Set<string>();
  for (const project of config.projects) {
    const use = project.use as { browserName?: string; defaultBrowserType?: string };
    const browser = use?.browserName ?? use?.defaultBrowserType;
    if (browser) {
      names.add(browser);
    }
  }
  return names.size ? [...names].join(', ') : NOT_AVAILABLE;
}

function computeMetrics(scenarios: Scenario[], planned: number, startedAt: Date): RunMetrics {
  const executed = scenarios.filter((s) => s.executed).length;
  const passed = scenarios.filter((s) => s.status === 'Passed').length;
  const failed = scenarios.filter((s) => s.status === 'Failed').length;
  const errored = scenarios.filter((s) => s.status === 'Errored').length;
  const skipped = scenarios.filter((s) => s.status === 'Skipped').length;
  const incomplete = scenarios.filter((s) => s.status === 'Incomplete').length;
  const retries = scenarios.reduce((sum, s) => sum + Math.max(0, s.attempts.length - 1), 0);
  const scenariosRetried = scenarios.filter((s) => s.attempts.length > 1).length;
  const firstAttemptExecuted = scenarios.filter(
    (s) => s.attempts.length > 0 && s.attempts[0].frameworkStatus !== 'skipped'
  ).length;
  const firstAttemptPassed = scenarios.filter((s) => s.firstAttemptPassed).length;
  const assertionResults = passed + failed;
  const plannedTotal = Math.max(planned, scenarios.length);

  return {
    planned: plannedTotal,
    executed,
    passed,
    failed,
    errored,
    skipped,
    incomplete,
    retries,
    scenariosRetried,
    firstAttemptPassed,
    firstAttemptExecuted,
    durationMs: Date.now() - startedAt.getTime(),
    executionCompleteness: plannedTotal > 0 ? executed / plannedTotal : null,
    passRate: assertionResults > 0 ? passed / assertionResults : null,
    firstAttemptPassRate: firstAttemptExecuted > 0 ? firstAttemptPassed / firstAttemptExecuted : null,
  };
}

function computeCritical(scenarios: Scenario[]): CriticalSummary {
  const critical = scenarios.filter((s) => s.critical);
  return {
    planned: critical.length,
    executed: critical.filter((s) => s.executed).length,
    passed: critical.filter((s) => s.status === 'Passed').length,
    failed: critical.filter((s) => s.status === 'Failed').length,
    errored: critical.filter((s) => s.status === 'Errored').length,
    skipped: critical.filter((s) => s.status === 'Skipped').length,
    incomplete: critical.filter((s) => s.status === 'Incomplete').length,
    scenarioIds: critical.map((s) => s.id),
  };
}

function computeAreas(scenarios: Scenario[]): FunctionalArea[] {
  const byArea = new Map<string, Scenario[]>();
  for (const scenario of scenarios) {
    const list = byArea.get(scenario.area) ?? [];
    list.push(scenario);
    byArea.set(scenario.area, list);
  }

  return [...byArea.entries()]
    .map(([name, items]) => ({
      name,
      planned: items.length,
      executed: items.filter((s) => s.executed).length,
      passed: items.filter((s) => s.status === 'Passed').length,
      failed: items.filter((s) => s.status === 'Failed').length,
      errored: items.filter((s) => s.status === 'Errored').length,
      skipped: items.filter((s) => s.status === 'Skipped').length,
      incomplete: items.filter((s) => s.status === 'Incomplete').length,
      evidenceCount: items.reduce(
        (sum, s) => sum + s.attempts.reduce((n, a) => n + a.evidence.filter((e) => !e.missingReason).length, 0),
        0
      ),
      scenarioIds: items.map((s) => s.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Verification state is derived programmatically from execution facts only. */
function computeVerificationState(
  metrics: RunMetrics,
  frameworkStatus: FullResult['status']
): { state: VerificationState; reasons: string[] } {
  const reasons: string[] = [];
  const reachedFinalResult = metrics.executed - metrics.incomplete;
  const accountedFor = metrics.executed + metrics.skipped;
  const neverReported = Math.max(0, metrics.planned - accountedFor);

  if (
    frameworkStatus === 'interrupted' ||
    metrics.planned === 0 ||
    reachedFinalResult === 0 ||
    metrics.incomplete + neverReported > metrics.planned / 2
  ) {
    reasons.push(
      frameworkStatus === 'interrupted'
        ? 'The automation run was interrupted before completing the selected scenarios.'
        : `${reachedFinalResult} of ${metrics.planned} planned scenarios reached a final result.`
    );
    return { state: 'Verification Aborted', reasons };
  }

  if (metrics.incomplete > 0 || neverReported > 0) {
    if (metrics.incomplete > 0) {
      reasons.push(`${metrics.incomplete} scenario(s) started but did not reach a final result.`);
    }
    if (neverReported > 0) {
      reasons.push(`${neverReported} planned scenario(s) produced no execution record.`);
    }
    return { state: 'Verification Incomplete', reasons };
  }

  if (metrics.skipped > 0 || metrics.errored > 0) {
    if (metrics.skipped > 0) {
      reasons.push(`${metrics.skipped} scenario(s) were skipped by the test framework.`);
    }
    if (metrics.errored > 0) {
      reasons.push(`${metrics.errored} scenario(s) ended with a test-framework error rather than an assertion result.`);
    }
    reasons.push(
      `${metrics.executed} of ${metrics.planned} planned scenarios executed; ${metrics.passed} passed and ${metrics.failed} failed.`
    );
    return { state: 'Verification Completed with Exceptions', reasons };
  }

  reasons.push(
    `All ${metrics.planned} planned scenarios executed and produced a final result; ${metrics.passed} passed and ${metrics.failed} failed.`
  );
  return { state: 'Verification Completed', reasons };
}
