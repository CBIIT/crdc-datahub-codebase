import { test as base } from '@playwright/test';
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
