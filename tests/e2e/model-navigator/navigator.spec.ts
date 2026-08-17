import { expect, test } from '../../fixtures';

test.describe('Model Navigator', { tag: ["@unauthenticated"] }, () => {
  test('should load Data Model Navigator successfully', async ({ page, modelNavigatorPage }) => {
    await modelNavigatorPage.openModel("GC");

    await expect(page).toHaveURL(/\/model-navigator\/.+\/latest(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'GC Data Model' })).toBeVisible();
  });

  test('should download the TSV template file', async ({ modelNavigatorPage }) => {
    await modelNavigatorPage.openModel("GC");
    await modelNavigatorPage.switchToTableView();

    const templateDownloadButton = modelNavigatorPage.page
      .getByRole('button', { name: 'Template Download' })
      .first();
    const downloadPromise = modelNavigatorPage.page.waitForEvent('download');
    await templateDownloadButton.click();
    const download = await downloadPromise;
    test.info().annotations.push({ type: 'info', description: `Downloaded file named: ${download.suggestedFilename()}` });
    test.info().attach('template.tsv', { path: await download.path(), contentType: 'text/tab-separated-values' });
  });

  test('should download the Data Dictionary PDF file', async ({ modelNavigatorPage }) => {
    await modelNavigatorPage.openModel("GC");
    await modelNavigatorPage.switchToTableView();

    const dataDictionaryDownloadButton = modelNavigatorPage.page
      .getByRole('button', { name: 'Data Dictionary Download' })
      .first();

    await dataDictionaryDownloadButton.click();
    const downloadPromise = modelNavigatorPage.page.waitForEvent('download');
    await modelNavigatorPage.page.getByRole('menuitem', { name: 'All Properties (PDF)' }).click();
    const download = await downloadPromise;

    test.info().annotations.push({ type: 'info', description: `Downloaded file named: ${download.suggestedFilename()}` });
    test.info().attach('data-dictionary.pdf', { path: await download.path(), contentType: 'application/pdf' });
  });

  test('should support showing Version History if available', async ({ modelNavigatorPage }) => {
    await modelNavigatorPage.openModel("GC");

    await modelNavigatorPage.switchToVersionHistoryView();

    test.info().attach('version-history', { body: await modelNavigatorPage.page.screenshot(), contentType: 'image/png' });
  });
});

