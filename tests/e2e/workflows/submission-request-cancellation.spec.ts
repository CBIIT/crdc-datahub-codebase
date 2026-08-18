import { expect, test } from '../../fixtures';

test("should be able to cancel a submitted Submission Request", async ({ page, submissionRequestsPage }) => {
  test.slow();

  const executedAt = new Date().toISOString().replace(/[:.]/g, "-");

  await submissionRequestsPage.open();
  await submissionRequestsPage.openCreateSRFModal();
  await submissionRequestsPage.confirmCreateSRF();

  await expect(page.getByTestId('status-bar-status')).toContainText('New');

  // Section A
  await page.locator('#section-a-pi-first-name').fill('test-automation-pi-firstname');
  await page.locator('#section-a-pi-last-name').fill('test-automation-pi-lastname');
  await page.locator('#section-a-pi-position').fill('test-automation-pi-position');
  await page.locator('#section-a-pi-email').fill('test-automation-pi-email@example.com');
  await page.locator('#section-a-pi-institution').fill(`New Test auto Institution ${executedAt}`);
  await page.getByRole('textbox', { name: 'Institution Address*' }).fill('1001 Mock Institution address');
  await page.getByRole('checkbox', { name: 'Same as Principal Investigator' }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await test.info().attach('Section A', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Next' }).click();

  // Section B
  await page.getByRole('button', { name: 'Select a program' }).click();
  await page.getByTestId('section-b-program').getByText('Other').click();
  await page.getByRole('textbox', { name: 'Program Title*' }).fill(`Test automation title ${executedAt}`);
  await page.getByRole('textbox', { name: 'Program Abbreviation*' }).fill(`TA-ABBR-${executedAt}`);
  await page.getByRole('textbox', { name: 'Program Description*' }).fill(`TEST AUTOMATION EXECUTED ${executedAt}`);
  await page.getByRole('textbox', { name: 'Study Title* Toggle Tooltip' }).fill(`TEST-AUTO-STUDY-TITLE-${executedAt}`);
  await page.getByRole('textbox', { name: 'Study Description* Toggle' }).fill(`TEST AUTOMATION STUDY DESCRIPTION ${executedAt}`);
  await page.getByRole('combobox', { name: 'Funding Agency/Organization*' }).click();
  await page.getByRole('option', { name: 'National Cancer Institute (' }).click();
  await page.getByRole('textbox', { name: 'Grant or Contract Number(s)*' }).fill('GRANT-AAA-0001');
  await page.getByRole('button', { name: 'Save' }).click();
  await test.info().attach('Section B', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Next' }).click();

  // Section C
  await page.getByRole('checkbox', { name: 'Access Types (Select all that apply):* Open Access Toggle Tooltip' }).check();
  await page.getByRole('button', { name: 'Select species' }).click();
  await page.getByText('Homo sapiens').click();
  await page.locator('.MuiBackdrop-root').click();
  await page.getByRole('textbox', { name: 'Number of subjects included' }).fill('9010');
  await page.getByRole('button', { name: 'Save' }).click();
  await test.info().attach('Section C', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Next' }).click();

  // Section D
  await page.getByRole('textbox', { name: 'Targeted Data Submission Delivery Date*' }).fill(`01/01/${new Date().getFullYear() + 1}`);
  await page.getByRole('textbox', { name: 'Expected Publication Date*' }).fill(`01/01/${new Date().getFullYear() + 1}`);
  await page.locator('form').filter({ hasText: 'DATA DELIVERY AND RELEASE' }).click();
  await page.getByRole('checkbox', { name: 'Genomics' }).check();
  await page.getByRole('combobox', { name: 'File type' }).click();
  await page.getByRole('option', { name: 'Raw sequencing data' }).click();
  await page.getByRole('combobox', { name: 'File extension' }).click();
  await page.getByRole('option', { name: 'FASTQ' }).click();
  await page.getByRole('textbox', { name: 'File count' }).click();
  await page.getByRole('textbox', { name: 'File count' }).fill('9');
  await page.getByRole('textbox', { name: 'File size' }).click();
  await page.getByRole('textbox', { name: 'File size' }).fill('90 GB');
  await page.getByRole('radio', { name: 'No' }).check();
  await page.getByRole('checkbox', { name: 'Cell lines, model systems (select all that apply or neither) Model systems' }).check();
  await page.getByRole('textbox', { name: 'ADDITIONAL INFORMATION' }).fill(`TEST AUTOMATION EXECUTED ${executedAt}.`);
  await page.getByRole('button', { name: 'Save' }).click();
  await test.info().attach('Section D', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Next' }).click();

  // Review
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled();
  await test.info().attach('Review', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm to Submit' }).click();

  // List page
  await expect(page.getByLabel(`TEST-AUTO-STUDY-TITLE-${executedAt}`)).toBeVisible();
  await test.info().attach('Submitted-SRF-Page', { body: await page.screenshot(), contentType: 'image/png' });

  // Cancel dialog
  await page.getByLabel("Cancel/Restore action").first().click();
  await expect(page.getByRole('dialog', { name: 'Cancel Submission Request' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Cancel Submission Request' }).getByText(`TEST-AUTO-STUDY-TITLE-${executedAt}`)).toBeVisible();
  await test.info().attach('Cancel-Dialog', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('dialog').getByRole('textbox', { name: "Reason" }).fill(`TEST AUTOMATION CANCELLATION ${executedAt}`);
  await page.getByRole('dialog').getByRole('button', { name: "Confirm" }).click();

  // List page after cancellation
  await expect(page.getByLabel(`TEST-AUTO-STUDY-TITLE-${executedAt}`)).not.toBeVisible();
  await test.info().attach('Cancelled-SRF-Page', { body: await page.screenshot(), contentType: 'image/png' });
});
