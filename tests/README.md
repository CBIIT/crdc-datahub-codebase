# Playwright E2E Scaffold

This is a standalone Playwright + TypeScript e2e subproject.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Install Playwright browsers:

```bash
npx playwright install
```

3. Run tests:

```bash
npm test
```

## Notes

- Test files live in `tests/`.
- Main config is `playwright.config.ts`.
- HTML report is available via `npm run report`.

## QA Release Verification document

Every run generates one PDF covering the whole execution (not one document per test) through the custom
reporter in `reporters/qa-release-report`. The PDF is composed directly with PDFKit — there is no HTML,
browser rendering, or conversion step involved.

Output is written to `qa-release-report/<run-timestamp>/`:

| File | Contents |
| --- | --- |
| `qa-release-verification.pdf` | The generated document (bookmarked, with internal links from summary tables to scenario detail) |
| `qa-release-verification.json` | Structured execution data the document is generated from |
| `evidence/<test-id>/<attempt>/` | Retained screenshots, videos, traces, and other attachments |

Each run writes to its own directory, so previously generated evidence is never modified.

### Release metadata

The reporter only records values it can observe; anything else is reported as `Not available`. Supply release
identity through the environment (CI variables such as `GITHUB_SHA`, `GITHUB_RUN_ID`, and `GITHUB_RUN_NUMBER`
are picked up automatically):

```bash
QA_RELEASE_VERSION=3.4.0 \
QA_RELEASE_CANDIDATE=RC2 \
QA_BUILD_ID=1482 \
QA_COMMIT_SHA=$(git rev-parse HEAD) \
QA_ENVIRONMENT=Dev2 \
QA_BASE_URL=https://example.gov \
QA_FRONTEND_VERSION=3.4.0 \
QA_BACKEND_VERSION=3.4.0 \
npm test
```

### Test metadata used by the document

- **Critical scenarios** — tag a test with `@critical`, `@critical-user-journey`, `@smoke`, `@release-critical`,
  or `@priority-1`.
- **Categories** — tags such as `@functional`, `@regression`, `@api`, `@ui`, `@e2e`, `@accessibility`.
- **Functional area** — derived from the test folder via the `areaMap` option in `playwright.config.ts`, or
  overridden per test with `test.info().annotations.push({ type: 'area', description: 'Payments' })`.
- **Human-readable name** — the test title, or an annotation of type `scenario` for a business-friendly name.

```ts
test('customer completes purchase using saved payment method', { tag: ['@critical', '@e2e'] }, async () => {
  // ...
});
```

### Options

Set in the reporter entry of `playwright.config.ts`: `outputDir`, `fileName`, `product`, `criticalTags`,
`categoryTags`, `areaMap`, `maxScreenshotsPerAttempt`, `includeSuccessEvidence`.

### Scope

The document reports what was tested, what executed, what happened, and what evidence exists. It does not
classify failures as defects, assess risk, or approve a release. Credentials, tokens, and email addresses are
redacted from captured text before it reaches the document.
