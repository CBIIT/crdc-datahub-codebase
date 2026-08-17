import { test as base, ConsoleMessage } from '@playwright/test';
import { DataSubmissionsPage } from './pages/data-submissions.page';
import { ModelNavigatorPage } from './pages/model-navigator.page';
import { SubmissionRequestsPage } from './pages/submission-requests.page';

type E2EFixtures = {
  dataSubmissionsPage: DataSubmissionsPage;
  modelNavigatorPage: ModelNavigatorPage;
  submissionRequestsPage: SubmissionRequestsPage;
};

export const test = base.extend<E2EFixtures>({
  page: async ({ page }, use) => {
    // Show mouse cursor and highlight elements during test execution
    await page.screencast.showActions({ cursor: 'pointer' });

    // Capture console as context annotations
    page.on("console", (msg: ConsoleMessage) => {
      if (["info", "log", "error", "warning"].includes(msg.type())) {
        test.info().annotations.push({ type: msg.type(), description: msg.text() });
      }
    });

    await use(page);
  },
  dataSubmissionsPage: async ({ page }, use) => {
    await use(new DataSubmissionsPage(page));
  },
  modelNavigatorPage: async ({ page }, use) => {
    await use(new ModelNavigatorPage(page));
  },
  submissionRequestsPage: async ({ page }, use) => {
    await use(new SubmissionRequestsPage(page));
  }
});

export { expect } from '@playwright/test';
