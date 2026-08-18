import { test } from '../../fixtures';

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
});
