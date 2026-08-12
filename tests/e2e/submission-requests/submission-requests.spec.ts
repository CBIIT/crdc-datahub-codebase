import { test } from '../../fixtures';

test('should create a blank submission request form', async ({ page, submissionRequestsPage }) => {
  await submissionRequestsPage.open();
  
  await submissionRequestsPage.createSRF();
  await page.screenshot();
});
