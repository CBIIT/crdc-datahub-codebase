import { test } from './fixtures';

test('Upload data submission', async ({ dataSubmissionsPage }) => {
  const submissionName = `ta-${Date.now()}`;

  await dataSubmissionsPage.createDataSubmissionFlow({
    submissionName,
    dataType: 'Metadata Only',
    dataCommons: 'CTDC',
    studyId: '2a0eecf4-60ba-4919-b469-972ab616aea9',
  });
  await dataSubmissionsPage.uploadMetadataFiles(['study.tsv', 'program.tsv']);
  await dataSubmissionsPage.runValidationAndExpectCompleted();
  await dataSubmissionsPage.adminSubmit('test automation');
});
