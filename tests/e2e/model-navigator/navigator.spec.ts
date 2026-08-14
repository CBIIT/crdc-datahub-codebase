import { test } from '../../fixtures';

test.describe('Model Navigator', { tag: ["@unauthenticated"] }, () => {
  test('model navigator base', async ({ modelNavigatorPage }) => {
    await modelNavigatorPage.openGcModel();
    await modelNavigatorPage.expectOnModelNavigator();
  });

  test('file downloads', async ({ modelNavigatorPage }) => {
    await modelNavigatorPage.openGcModel();
    await modelNavigatorPage.switchToTableView();

    await modelNavigatorPage.page.screencast.showChapter('Template Download', {
      description: 'Clicking the Template Download button to download the template file.',
      duration: 2000,
    });

    const templateDownloadButton = modelNavigatorPage.page
      .getByRole('button', { name: 'Template Download' })
      .first();
    const templateDownloadPromise = modelNavigatorPage.page.waitForEvent('download');
    await templateDownloadButton.click();
    const download = await templateDownloadPromise;
    test.info().annotations.push({ type: 'info', description: `Downloaded file named: ${download.suggestedFilename()}` });
    test.info().attach('template.tsv', { path: await download.path(), contentType: 'text/tab-separated-values' });

    await modelNavigatorPage.page.screencast.showChapter('Data Dictionary', {
      description: 'Clicking the Data Dictionary Download button to download the data dictionary file.',
      duration: 2000,
    });

    const dataDictionaryDownloadButton = modelNavigatorPage.page
      .getByRole('button', { name: 'Data Dictionary Download' })
      .first();
    await dataDictionaryDownloadButton.click();
    const download1Promise = modelNavigatorPage.page.waitForEvent('download');
    await modelNavigatorPage.page.getByRole('menuitem', { name: 'All Properties (PDF)' }).click();
    const download1 = await download1Promise;
    test.info().annotations.push({ type: 'info', description: `Downloaded file named: ${download1.suggestedFilename()}` });
    test.info().attach('data-dictionary.pdf', { path: await download1.path(), contentType: 'application/pdf' });
  });
});

