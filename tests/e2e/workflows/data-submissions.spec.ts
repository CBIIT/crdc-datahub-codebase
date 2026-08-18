import { expect, test } from '../../fixtures';
import path from 'path';

test('should complete a Data Submission successfully', async ({ page, dataSubmissionsPage }) => {
  await dataSubmissionsPage.open();

  const submissionName = `ta-${Date.now()}`;
  const submission = await dataSubmissionsPage.createSubmission({
    submissionName,
    dataType: 'Metadata Only',
    dataCommons: 'GC',
    studyName: '0452-test', // TODO: Use tier-agnostic study selection
  });

  await submission.click();

  await dataSubmissionsPage.waitForUrlPath(/\/data-submission\/.+$/);
  await expect(page.getByLabel(submissionName)).toBeVisible();
  await expect(page.getByLabel('0452-test', { exact: true })).toBeVisible(); // TODO: Use tier-agnostic study selection

  // Upload metadata file
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Choose Files', { exact: true }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    path.join(__dirname, 'program.tsv'),
    path.join(__dirname, 'study.tsv'),
  ]);
  await page.getByTestId('metadata-upload-file-upload-button').click();

  await expect(page.getByTestId('metadata-upload-file-upload-button')).toHaveText('Uploading...');

  await expect(page.getByTestId('metadata-upload-file-upload-button')).toHaveText('Upload');
});
