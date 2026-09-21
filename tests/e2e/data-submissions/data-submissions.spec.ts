import { expect, test } from '../../fixtures';

test.describe('Data Submissions', () => {
  test('should create a Data Submission successfully', async ({ dataSubmissionsPage }) => {
    await dataSubmissionsPage.open();

    const submission = await dataSubmissionsPage.createSubmission({
      submissionName: `ta-${Date.now()}`,
      dataType: 'Metadata Only',
      dataCommons: 'CTDC',
      studyName: '0452-test', // TODO: Use tier-agnostic study selection
    });

    await submission.click();
  });

  test('should cancel a new Data Submission successfully', async ({ dataSubmissionsPage }) => {
    await dataSubmissionsPage.open();

    const submission = await dataSubmissionsPage.createSubmission({
      submissionName: `ta-${Date.now()}`,
      dataType: 'Metadata Only',
      dataCommons: 'CTDC',
      studyName: '0452-test', // TODO: Use tier-agnostic study selection
    });

    await submission.click();

    await dataSubmissionsPage.page.getByRole('button', { name: 'Cancel', exact: true }).click();

    await dataSubmissionsPage.page.getByRole('dialog', { name: 'Cancel Data Submission' }).getByRole('button', { name: 'Yes' }).click();

    await expect(submission).not.toBeVisible();
  });
});
