import { test } from '../../fixtures';

test.describe('Data Submissions', () => {
  test('should create a Data Submission successfully', async ({ dataSubmissionsPage }) => {
    await dataSubmissionsPage.open();

    const submission = await dataSubmissionsPage.createDataSubmissionFlow({
      submissionName: `ta-${Date.now()}`,
      dataType: 'Metadata Only',
      dataCommons: 'CTDC',
      studyId: '2a0eecf4-60ba-4919-b469-972ab616aea9',
    });

    await submission.click();
  });
});
