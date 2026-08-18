import { expect, test } from '../../fixtures';

test.describe('Submission Requests', () => {
  test('should create a blank submission request form', async ({ page, submissionRequestsPage }) => {
    await submissionRequestsPage.open();
    await test.info().attach('Submission Requests Page', { body: await page.screenshot(), contentType: 'image/png' });

    await submissionRequestsPage.openCreateSRFModal();
    await test.info().attach('Creation Modal', { body: await page.screenshot(), contentType: 'image/png' });

    await submissionRequestsPage.confirmCreateSRF();
    await expect(page.getByTestId('status-bar-status')).toContainText('New');
    await test.info().attach('Blank Submission Request Form', { body: await page.screenshot(), contentType: 'image/png' });
  });
});
