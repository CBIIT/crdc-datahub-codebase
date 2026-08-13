import fs from 'node:fs';
import path from 'node:path';

import { NOT_AVAILABLE, ResolvedOptions } from './config';
import { COLORS, Cell, PdfBuilder } from './layout';
import type { Attempt, Evidence, ReportData, Scenario, ScenarioStatus } from './model';

const STATUS_STYLE: Record<ScenarioStatus, { color: string; background: string }> = {
  Passed: { color: '#1c6b32', background: '#eaf6ee' },
  Failed: { color: '#98211f', background: '#fbeceb' },
  Errored: { color: '#8a5300', background: '#fdf3e3' },
  Skipped: { color: '#4a5764', background: '#eef1f4' },
  Incomplete: { color: '#5c3d8a', background: '#f1ecf9' },
};

const STATUS_TAXONOMY: { status: ScenarioStatus; definition: string }[] = [
  { status: 'Passed', definition: 'The scenario executed and all required assertions were satisfied.' },
  {
    status: 'Failed',
    definition: 'The scenario executed and one or more required assertions or test conditions were not satisfied.',
  },
  { status: 'Skipped', definition: 'The test framework intentionally did not execute the scenario.' },
  {
    status: 'Errored',
    definition:
      'The scenario did not produce a meaningful assertion result because execution timed out or encountered a technical error.',
  },
  {
    status: 'Incomplete',
    definition: 'Execution began or was scheduled but did not reach a final expected result.',
  },
];

function statusCell(status: ScenarioStatus): Cell {
  return { text: status, pill: { text: status, ...STATUS_STYLE[status] } };
}

function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return NOT_AVAILABLE;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function percent(value: number | null): string {
  return value === null ? NOT_AVAILABLE : `${(value * 100).toFixed(1)}%`;
}

function stamp(value?: string): string {
  if (!value) return NOT_AVAILABLE;
  return new Date(value).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

function destinationFor(scenario: Scenario): string {
  return `scenario-${scenario.id}`;
}

function evidenceCount(scenario: Scenario): number {
  return scenario.attempts.reduce((sum, a) => sum + a.evidence.filter((e) => !e.missingReason).length, 0);
}

function renderSummaryPage(pdf: PdfBuilder, data: ReportData, options: ResolvedOptions): void {
  const { release, run, metrics, critical } = data;

  pdf.bookmark('1. Release verification summary', undefined, 'summary');
  pdf.title('QA Release Verification Document', `${release.product} — automated verification evidence record`);

  pdf.heading('Release identification');
  pdf.keyValues([
    { label: 'Product', value: release.product },
    { label: 'Release / version', value: release.version },
    { label: 'Release candidate', value: release.releaseCandidate },
    { label: 'Build identifier', value: release.build },
    { label: 'Source revision', value: release.commit },
    { label: 'Deployment / package', value: release.package },
    { label: 'Environment', value: release.environment },
    { label: 'Environment URL', value: release.environmentUrl },
    { label: 'Automation run ID', value: run.runId },
    { label: 'Pipeline / job', value: run.pipeline },
    { label: 'Execution started', value: stamp(run.startTime) },
    { label: 'Execution completed', value: stamp(run.endTime) },
    { label: 'Report generated', value: stamp(run.generatedAt) },
    { label: 'Report identifier', value: run.reportId },
  ]);

  pdf.heading('Verification execution state');
  pdf.stateBox(run.verificationState, run.verificationStateReasons);
  pdf.notice(
    'This state describes automated test execution only. It is not a QA approval, a release decision, or an assessment of business risk.'
  );

  pdf.heading('Execution metrics');
  pdf.metricCards([
    { label: 'Planned', value: String(metrics.planned) },
    { label: 'Executed', value: String(metrics.executed) },
    { label: 'Passed', value: String(metrics.passed) },
    { label: 'Failed', value: String(metrics.failed) },
    { label: 'Errored', value: String(metrics.errored) },
    { label: 'Skipped', value: String(metrics.skipped) },
    { label: 'Incomplete', value: String(metrics.incomplete) },
    { label: 'Retries', value: String(metrics.retries) },
  ]);
  pdf.keyValues([
    {
      label: 'Execution completeness',
      value: `${metrics.executed} of ${metrics.planned} planned scenarios executed (${percent(
        metrics.executionCompleteness
      )})`,
    },
    {
      label: 'Pass rate',
      value: `${metrics.passed} of ${metrics.passed + metrics.failed} scenarios producing an assertion result passed (${percent(
        metrics.passRate
      )})`,
    },
    {
      label: 'First-attempt pass rate',
      value: `${metrics.firstAttemptPassed} of ${metrics.firstAttemptExecuted} initial attempts passed (${percent(
        metrics.firstAttemptPassRate
      )})`,
    },
    { label: 'Scenarios requiring retries', value: String(metrics.scenariosRetried) },
    { label: 'Total execution duration', value: duration(metrics.durationMs) },
  ]);

  pdf.heading('Critical scenario summary');
  pdf.keyValues([
    { label: 'Critical scenarios planned', value: String(critical.planned) },
    { label: 'Executed', value: String(critical.executed) },
    { label: 'Passed', value: String(critical.passed) },
    { label: 'Failed', value: String(critical.failed) },
    { label: 'Errored', value: String(critical.errored) },
    { label: 'Skipped or incomplete', value: String(critical.skipped + critical.incomplete) },
  ]);

  const criticalScenarios = data.scenarios.filter((s) => s.critical);
  if (criticalScenarios.length) {
    pdf.table(
      [
        { header: 'Critical scenario', weight: 2.6 },
        { header: 'Functional area', weight: 1.2 },
        { header: 'Result', weight: 0.9 },
        { header: 'Attempts', weight: 0.6, align: 'right' },
      ],
      criticalScenarios.map((scenario) => [
        { text: scenario.name, goTo: destinationFor(scenario), color: COLORS.accent },
        { text: scenario.area },
        statusCell(scenario.status),
        { text: String(scenario.attempts.length), align: 'right' },
      ])
    );
  } else {
    pdf.paragraph(
      `No scenarios in this execution carry a release-critical tag (${options.criticalTags.join(', ')}).`,
      { muted: true }
    );
  }

  pdf.heading('Items requiring review');
  pdf.keyValues([
    { label: 'Unsuccessful scenarios', value: String(metrics.failed + metrics.errored) },
    { label: 'Skipped or incomplete scenarios', value: String(metrics.skipped + metrics.incomplete) },
    { label: 'Expected evidence not collected', value: String(data.missingEvidence.length) },
  ]);
  pdf.paragraph(
    'Detail for every item above is provided in the "Unsuccessful and incomplete verification" and "Scenario evidence" sections of this document.'
  );

  pdf.heading('Where to find additional evidence');
  pdf.paragraph(
    `Retained artifacts for this run are stored alongside this document in the evidence/ directory, organised as evidence/<test-id>/<attempt>/<artifact>. The structured execution data used to generate this document is available as ${options.fileName}.json.` +
      (data.run.pipeline === NOT_AVAILABLE ? '' : ` Pipeline artifacts are published by the ${data.run.pipeline} job.`)
  );
}

function renderScopePage(pdf: PdfBuilder, data: ReportData): void {
  pdf.pageBreak();
  pdf.bookmark('2. Verification scope and coverage', undefined, 'scope');
  pdf.title('Verification scope and coverage');

  pdf.heading('Test selection');
  pdf.keyValues([
    {
      label: 'Scenarios available in the automation repository',
      value:
        data.run.selection.availableInRepository === null
          ? NOT_AVAILABLE
          : String(data.run.selection.availableInRepository),
    },
    { label: 'Scenarios selected for this execution', value: String(data.run.selection.selectedForExecution) },
    { label: 'Projects executed', value: data.run.selection.projects.join(', ') || NOT_AVAILABLE },
    { label: 'Tags included (grep)', value: data.run.selection.grepInclude },
    { label: 'Tags excluded (grep-invert)', value: data.run.selection.grepExclude },
    { label: 'Shard', value: data.run.selection.shard },
  ]);
  pdf.notice(
    'Coverage reported in this document corresponds only to scenarios selected for this execution. Tests that exist in the automation repository but were not selected are not represented as verified.'
  );

  pdf.heading('Coverage by functional area');
  pdf.table(
    [
      { header: 'Functional area', weight: 1.7 },
      { header: 'Planned', weight: 0.6, align: 'right' },
      { header: 'Executed', weight: 0.6, align: 'right' },
      { header: 'Passed', weight: 0.6, align: 'right' },
      { header: 'Unsuccessful', weight: 0.75, align: 'right' },
      { header: 'Skipped / incomplete', weight: 0.9, align: 'right' },
      { header: 'Execution status', weight: 1.5 },
      { header: 'Evidence', weight: 0.6, align: 'right' },
    ],
    data.areas.map((area) => [
      { text: area.name },
      { text: String(area.planned), align: 'right' },
      { text: String(area.executed), align: 'right' },
      { text: String(area.passed), align: 'right' },
      { text: String(area.failed + area.errored), align: 'right' },
      { text: String(area.skipped + area.incomplete), align: 'right' },
      {
        text:
          area.executed === area.planned
            ? 'Executed as planned'
            : `${area.planned - area.executed} scenario(s) did not execute`,
      },
      { text: String(area.evidenceCount), align: 'right' },
    ])
  );

  pdf.heading('Test categories');
  const categories = [...new Set(data.scenarios.flatMap((s) => s.categories))].sort();
  pdf.paragraph(
    categories.length
      ? categories.join(', ')
      : 'No category metadata was supplied by the automation configuration for the selected scenarios.',
    { muted: !categories.length }
  );
  pdf.notice(
    'Categories originate from automation metadata (tags and annotations) only. They are never inferred from test outcomes.'
  );
}

function renderResultsPage(pdf: PdfBuilder, data: ReportData): void {
  pdf.pageBreak();
  pdf.bookmark('3. Execution results', undefined, 'results');
  pdf.title('Execution results', 'Grouped by functional capability, then suite, then scenario.');

  for (const area of data.areas) {
    const scenarios = data.scenarios.filter((s) => area.scenarioIds.includes(s.id));
    pdf.heading(area.name);

    for (const suite of [...new Set(scenarios.map((s) => s.suite))]) {
      pdf.heading(suite, 3);
      pdf.table(
        [
          { header: 'Scenario', weight: 2.1 },
          { header: 'Test ID', weight: 1 },
          { header: 'Categories', weight: 0.85 },
          { header: 'Status', weight: 0.85 },
          { header: 'Duration', weight: 0.7, align: 'right' },
          { header: 'Attempts', weight: 0.75, align: 'right' },
          { header: 'Started', weight: 1.35 },
        ],
        scenarios
          .filter((s) => s.suite === suite)
          .map((scenario) => [
            {
              text: scenario.critical ? `${scenario.name}  [critical]` : scenario.name,
              goTo: destinationFor(scenario),
              color: COLORS.accent,
            },
            { text: scenario.id, mono: true },
            { text: scenario.categories.join(', ') || '—' },
            statusCell(scenario.status),
            { text: duration(scenario.totalDurationMs), align: 'right' },
            { text: String(scenario.attempts.length), align: 'right' },
            { text: stamp(scenario.attempts[scenario.attempts.length - 1]?.startTime) },
          ])
      );
    }
  }

  pdf.heading('Retry history');
  const retried = data.scenarios.filter((s) => s.attempts.length > 1);
  if (retried.length) {
    pdf.table(
      [
        { header: 'Scenario', weight: 2 },
        { header: 'Attempt sequence', weight: 1.8 },
        { header: 'Final result', weight: 0.9 },
        { header: 'Attempt durations', weight: 1.2 },
      ],
      retried.map((scenario) => [
        { text: scenario.name },
        { text: scenario.attempts.map((a) => `${a.attemptNumber}: ${a.status}`).join('  ->  ') },
        statusCell(scenario.status),
        { text: scenario.attempts.map((a) => duration(a.durationMs)).join(', ') },
      ])
    );
  } else {
    pdf.paragraph('No scenario required more than one execution attempt.', { muted: true });
  }
}

function renderExceptionsPage(pdf: PdfBuilder, data: ReportData): void {
  pdf.pageBreak();
  pdf.bookmark('4. Unsuccessful and incomplete verification', undefined, 'exceptions');
  pdf.title(
    'Unsuccessful and incomplete verification',
    'Scenarios that did not produce a straightforward successful result.'
  );
  pdf.notice(
    'Entries are reported as observed by the automation framework. No defect, root-cause, business-impact, or release-risk classification is applied.'
  );

  const unsuccessful = data.scenarios.filter((s) => s.status !== 'Passed');
  if (unsuccessful.length) {
    pdf.table(
      [
        { header: 'Scenario', weight: 2 },
        { header: 'Functional area', weight: 1.1 },
        { header: 'Result', weight: 0.85 },
        { header: 'Attempts', weight: 0.6, align: 'right' },
        { header: 'Execution stopped at', weight: 1.9 },
        { header: 'Evidence', weight: 0.6, align: 'right' },
      ],
      unsuccessful.map((scenario) => {
        const last = scenario.attempts[scenario.attempts.length - 1];
        return [
          { text: scenario.name, goTo: destinationFor(scenario), color: COLORS.accent },
          { text: scenario.area },
          statusCell(scenario.status),
          { text: String(scenario.attempts.length), align: 'right' },
          { text: last?.failedStep ?? last?.skipReason ?? NOT_AVAILABLE },
          { text: String(evidenceCount(scenario)), align: 'right' },
        ];
      })
    );
  } else {
    pdf.paragraph(
      'All executed scenarios produced a successful result and no scenarios were skipped or left incomplete.',
      { muted: true }
    );
  }

  pdf.heading('Expected evidence that could not be collected');
  if (data.missingEvidence.length) {
    pdf.table(
      [
        { header: 'Scenario ID', weight: 0.9 },
        { header: 'Attempt', weight: 0.5, align: 'right' },
        { header: 'Artifact', weight: 1 },
        { header: 'Reason', weight: 3 },
      ],
      data.missingEvidence.map((evidence) => [
        { text: evidence.scenarioId, mono: true },
        { text: String(evidence.attemptNumber), align: 'right' },
        { text: evidence.name },
        { text: evidence.missingReason ?? NOT_AVAILABLE, color: COLORS.warn },
      ])
    );
  } else {
    pdf.paragraph('All expected artifacts were captured and retained.', { muted: true });
  }
}

function renderEvidence(pdf: PdfBuilder, scenario: Scenario, attempt: Attempt, options: ResolvedOptions, reportDir: string): void {
  const showScreenshots = attempt.status !== 'Passed' || (options.includeSuccessEvidence && scenario.critical);
  const screenshots = showScreenshots
    ? attempt.evidence.filter((e) => e.type === 'screenshot' && e.path).slice(0, options.maxScreenshotsPerAttempt)
    : [];

  for (const evidence of screenshots) {
    const embedded = pdf.image(path.join(reportDir, evidence.path!), [
      evidence.description,
      `Scenario: ${scenario.name} · Attempt ${attempt.attemptNumber} · Status: ${attempt.status} · Captured: ${stamp(
        evidence.timestamp
      )}`,
      evidence.path!,
    ]);
    if (!embedded) {
      pdf.paragraph(`Screenshot could not be embedded; the artifact is retained at ${evidence.path}.`, {
        muted: true,
      });
    }
  }

  if (!attempt.evidence.length) {
    pdf.paragraph('No evidence artifacts were recorded for this attempt.', { muted: true });
    return;
  }

  pdf.table(
    [
      { header: 'Type', weight: 0.7 },
      { header: 'Name', weight: 1 },
      { header: 'Description', weight: 2.2 },
      { header: 'Location', weight: 2.1 },
    ],
    attempt.evidence.map((evidence: Evidence) => [
      { text: evidence.type },
      { text: evidence.name },
      { text: evidence.description },
      evidence.path
        ? { text: evidence.path, mono: true, link: evidence.path, color: COLORS.accent }
        : { text: evidence.missingReason ?? NOT_AVAILABLE, color: COLORS.warn },
    ])
  );
}

function renderScenarioDetail(pdf: PdfBuilder, scenario: Scenario, options: ResolvedOptions, reportDir: string): void {
  pdf.ensureSpace(90);
  pdf.destination(destinationFor(scenario));
  pdf.bookmark(`${scenario.name} — ${scenario.status}`, 'evidence');
  pdf.heading(`${scenario.name}${scenario.critical ? '  [critical]' : ''}`, 2);

  pdf.keyValuePairs([
    { label: 'Final result', value: scenario.status },
    { label: 'Functional area', value: scenario.area },
    { label: 'Test identifier', value: scenario.id },
    { label: 'Source', value: `${scenario.file}:${scenario.line ?? ''}` },
    { label: 'Categories', value: scenario.categories.join(', ') || NOT_AVAILABLE },
    { label: 'Tags', value: scenario.tags.join(', ') || NOT_AVAILABLE },
    { label: 'Attempts', value: String(scenario.attempts.length) },
    { label: 'Total duration', value: duration(scenario.totalDurationMs) },
    { label: 'Project', value: scenario.project },
    {
      label: 'Framework flaky classification',
      value: scenario.frameworkFlaky ? 'Reported as flaky' : 'Not reported',
    },
  ]);

  for (const attempt of scenario.attempts) {
    pdf.heading(`Attempt ${attempt.attemptNumber} — ${attempt.status}`, 3);
    pdf.keyValuePairs([
      { label: 'Framework status', value: attempt.frameworkStatus },
      { label: 'Started', value: stamp(attempt.startTime) },
      { label: 'Duration', value: duration(attempt.durationMs) },
      { label: 'Worker', value: attempt.workerIndex === undefined ? NOT_AVAILABLE : String(attempt.workerIndex) },
    ]);
    pdf.keyValues(
      [
        {
          label: 'Execution stopped at',
          value: attempt.failedStep ?? (attempt.status === 'Passed' ? 'Completed' : NOT_AVAILABLE),
        },
        ...(attempt.status === 'Skipped'
          ? [{ label: 'Skip reason', value: attempt.skipReason ?? 'No reason supplied by the framework' }]
          : []),
        ...(attempt.assertion
          ? [
              { label: 'Assertion', value: attempt.assertion.message ?? NOT_AVAILABLE },
              { label: 'Expected', value: attempt.assertion.expected ?? NOT_AVAILABLE },
              { label: 'Observed', value: attempt.assertion.observed ?? NOT_AVAILABLE },
            ]
          : []),
      ],
      0.28
    );

    if (attempt.errorMessages.length) {
      pdf.codeBlock(attempt.errorMessages.join('\n\n'));
    }

    renderEvidence(pdf, scenario, attempt, options, reportDir);
  }

  pdf.rule();
}

function renderEvidencePages(pdf: PdfBuilder, data: ReportData, options: ResolvedOptions, reportDir: string): void {
  pdf.pageBreak();
  pdf.bookmark('5. Scenario evidence and technical detail', undefined, 'evidence');
  pdf.title(
    'Scenario evidence and technical detail',
    'Unsuccessful, incomplete, retried, and release-critical scenarios.'
  );
  pdf.paragraph(
    'Successful non-critical scenarios are summarised in the execution results section; their retained artifacts remain available in the evidence directory.',
    { muted: true }
  );

  const detailScenarios = data.scenarios.filter(
    (s) => s.attempts.length > 0 && (s.status !== 'Passed' || s.critical || s.attempts.length > 1)
  );
  const withoutExecution = data.scenarios.filter((s) => s.attempts.length === 0);

  if (!detailScenarios.length) {
    pdf.paragraph('No executed scenario met the criteria for detailed evidence presentation.', { muted: true });
  }

  for (const scenario of detailScenarios) {
    renderScenarioDetail(pdf, scenario, options, reportDir);
  }

  if (withoutExecution.length) {
    pdf.heading('Scenarios with no execution record');
    pdf.paragraph(
      'These planned scenarios produced no attempt, so no execution evidence exists for them.',
      { muted: true }
    );
    pdf.table(
      [
        { header: 'Scenario', weight: 2.4 },
        { header: 'Functional area', weight: 1.2 },
        { header: 'Test ID', weight: 1 },
        { header: 'Result', weight: 0.9 },
      ],
      withoutExecution.map((scenario) => [
        { text: scenario.name },
        { text: scenario.area },
        { text: scenario.id, mono: true },
        statusCell(scenario.status),
      ])
    );
  }
}

function renderAppendix(pdf: PdfBuilder, data: ReportData): void {
  pdf.pageBreak();
  pdf.bookmark('Appendix', undefined, 'appendix');
  pdf.title('Appendix');

  pdf.heading('A. Environment');
  pdf.keyValues(data.environment.map((entry) => ({ label: entry.label, value: entry.value })));

  pdf.heading('B. Test configuration');
  pdf.keyValues(data.run.configuration.map((entry) => ({ label: entry.label, value: entry.value })));

  pdf.heading('C. Status taxonomy');
  pdf.table(
    [
      { header: 'Status', weight: 0.8 },
      { header: 'Definition', weight: 4 },
    ],
    STATUS_TAXONOMY.map((entry) => [statusCell(entry.status), { text: entry.definition }])
  );

  pdf.heading('D. Metric definitions');
  pdf.table(
    [
      { header: 'Metric', weight: 1.3 },
      { header: 'Definition', weight: 3.5 },
    ],
    data.metricDefinitions.map((entry) => [{ text: entry.term, bold: true }, { text: entry.definition }])
  );

  pdf.heading('E. Scope of this document');
  pdf.notice(
    'This document is generated automatically from automated test execution data. It records what was tested, what executed, what happened, and what evidence exists. It does not determine whether an unsuccessful result represents a software defect, does not assess business impact or release risk, and does not constitute QA approval or a release decision. Interpretation of this evidence is performed by QA and engineering; release decisions are made by release stakeholders.'
  );
  pdf.keyValues([
    { label: 'Report identifier', value: data.run.reportId },
    { label: 'Report version', value: data.run.reportVersion },
    { label: 'Automation run ID', value: data.run.runId },
    { label: 'Build identifier', value: data.release.build },
    { label: 'Generated at', value: stamp(data.run.generatedAt) },
  ]);
}

/** Writes the QA Release Verification document as a native PDF. */
export function writePdf(
  data: ReportData,
  options: ResolvedOptions,
  reportDir: string,
  filePath: string
): Promise<void> {
  const pdf = new PdfBuilder(
    `QA Release Verification — ${data.release.product} ${data.release.version}`,
    `Automated test evidence for build ${data.release.build}`
  );

  const stream = fs.createWriteStream(filePath);
  const done = new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  pdf.doc.pipe(stream);

  renderSummaryPage(pdf, data, options);
  renderScopePage(pdf, data);
  renderResultsPage(pdf, data);
  renderExceptionsPage(pdf, data);
  renderEvidencePages(pdf, data, options, reportDir);
  renderAppendix(pdf, data);

  pdf.finalize(
    `QA Release Verification — ${data.release.product} · build ${data.release.build}`,
    `Report ${data.run.reportId}`,
    'Automated test evidence record — not a release approval'
  );

  return done;
}
