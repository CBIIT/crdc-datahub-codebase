/**
 * Structured execution data model consumed by the QA Release Verification
 * document generator. The generator never parses rendered test output; it only
 * reads the objects defined here.
 *
 * Hierarchy: Release -> AutomationRun -> FunctionalArea -> Scenario -> Attempt -> Evidence
 */

export type ScenarioStatus = 'Passed' | 'Failed' | 'Skipped' | 'Errored' | 'Incomplete';

export type VerificationState =
  | 'Verification Completed'
  | 'Verification Completed with Exceptions'
  | 'Verification Incomplete'
  | 'Verification Aborted';

export type EvidenceType =
  | 'screenshot'
  | 'video'
  | 'trace'
  | 'log'
  | 'api'
  | 'file'
  | 'error-context';

export type Release = {
  product: string;
  version: string;
  releaseCandidate: string;
  build: string;
  commit: string;
  package: string;
  environment: string;
  environmentUrl: string;
};

export type EnvironmentInfo = {
  /** Ordered label/value pairs. Unknown values are recorded as "Not available". */
  label: string;
  value: string;
}[];

export type TestConfiguration = {
  label: string;
  value: string;
}[];

export type Evidence = {
  type: EvidenceType;
  /** Attachment name as produced by the automation framework. */
  name: string;
  contentType: string;
  /** Report-relative path to the retained copy of the artifact. */
  path?: string;
  /** Machine-generated description of why this artifact exists. */
  description: string;
  /** Set when the artifact was expected but could not be retained. */
  missingReason?: string;
  sizeBytes?: number;
  scenarioId: string;
  attemptNumber: number;
  step?: string;
  timestamp?: string;
};

export type AssertionDetail = {
  /** Expected value or condition, verbatim from the framework where available. */
  expected?: string;
  /** Observed value or condition, verbatim from the framework where available. */
  observed?: string;
  message?: string;
  snippet?: string;
  location?: string;
};

export type Attempt = {
  attemptNumber: number;
  status: ScenarioStatus;
  /** Raw status string reported by the automation framework. */
  frameworkStatus: string;
  startTime?: string;
  endTime?: string;
  durationMs: number;
  /** Step title at which execution stopped, when the framework reports one. */
  failedStep?: string;
  assertion?: AssertionDetail;
  errorMessages: string[];
  skipReason?: string;
  evidence: Evidence[];
  workerIndex?: number;
};

export type Scenario = {
  /** Unique technical test identifier. */
  id: string;
  /** Human-readable scenario name. */
  name: string;
  /** Technical identifier (file > suite > title path). */
  technicalId: string;
  file: string;
  line?: number;
  area: string;
  suite: string;
  tags: string[];
  categories: string[];
  critical: boolean;
  project: string;
  platform: string;
  status: ScenarioStatus;
  /** True when the framework itself classified the scenario as flaky. */
  frameworkFlaky: boolean;
  executed: boolean;
  producedAssertionResult: boolean;
  firstAttemptPassed: boolean;
  attempts: Attempt[];
  totalDurationMs: number;
  annotations: { type: string; description?: string }[];
};

export type FunctionalArea = {
  name: string;
  planned: number;
  executed: number;
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  incomplete: number;
  evidenceCount: number;
  scenarioIds: string[];
};

export type RunMetrics = {
  planned: number;
  executed: number;
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  incomplete: number;
  retries: number;
  scenariosRetried: number;
  firstAttemptPassed: number;
  firstAttemptExecuted: number;
  durationMs: number;
  /** executed / planned */
  executionCompleteness: number | null;
  /** passed / scenarios producing a valid assertion result */
  passRate: number | null;
  /** firstAttemptPassed / firstAttemptExecuted */
  firstAttemptPassRate: number | null;
};

export type CriticalSummary = {
  planned: number;
  executed: number;
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  incomplete: number;
  scenarioIds: string[];
};

export type AutomationRun = {
  runId: string;
  reportId: string;
  reportVersion: string;
  pipeline: string;
  startTime: string;
  endTime: string;
  generatedAt: string;
  frameworkStatus: string;
  verificationState: VerificationState;
  verificationStateReasons: string[];
  configuration: TestConfiguration;
  selection: {
    /** Tests discovered in the automation repository for this config. */
    availableInRepository: number | null;
    /** Tests selected for this execution. */
    selectedForExecution: number;
    grepInclude: string;
    grepExclude: string;
    projects: string[];
    shard: string;
  };
};

export type ReportData = {
  release: Release;
  run: AutomationRun;
  environment: EnvironmentInfo;
  metrics: RunMetrics;
  critical: CriticalSummary;
  areas: FunctionalArea[];
  scenarios: Scenario[];
  /** Evidence that was expected but could not be collected. */
  missingEvidence: Evidence[];
  metricDefinitions: { term: string; definition: string }[];
};
