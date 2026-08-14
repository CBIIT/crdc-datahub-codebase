import { test } from '../../fixtures';

test.describe('Submission Requests', () => {
  test('should create a blank submission request form', async ({ page, submissionRequestsPage }) => {
    await submissionRequestsPage.open();
    await test.info().attach('SRF-Page', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    await submissionRequestsPage.openCreateSRFModal();
    await test.info().attach('Create-SRF-Modal', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    await submissionRequestsPage.confirmCreateSRF();
    await test.info().attach('New-SRF-Page', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });
});
