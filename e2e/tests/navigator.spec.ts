import { test } from './fixtures';

test('model navigator base', async ({ page }) => {
  await page.goto('https://hub-dev.datacommons.cancer.gov/');

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Model Navigator' }).click();
  await page.getByRole('link', { name: 'GC Model' }).click();
});

test('file downloads', async ({ page }) => {
  await page.goto('https://hub-dev.datacommons.cancer.gov/');

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Model Navigator' }).click();
  await page.getByRole('link', { name: 'GC Model' }).click();
  await page.getByRole('button', { name: 'Category', exact: true }).click();
  await page.getByRole('tab', { name: 'Table View' }).click();
  
  await page.screencast.showChapter("Template Download", { description: "Clicking the Template Download button to download the template file.", duration: 2000 });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Template Download' }).first().click();
  const download = await downloadPromise;
  test.info().annotations.push({ type: 'info', description: `Downloaded file named: ${download.suggestedFilename()}` });
  test.info().attach("template.tsv", { path: await download.path(), contentType: 'text/tab-separated-values' });

  await page.screencast.showChapter("Data Dictionary", { description: "Clicking the Data Dictionary Download button to download the data dictionary file.", duration: 2000 });

  await page.getByRole('button', { name: 'Data Dictionary Download' }).first().click();
  const download1Promise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'All Properties (PDF)' }).click();
  const download1 = await download1Promise;
  test.info().annotations.push({ type: 'info', description: `Downloaded file named: ${download1.suggestedFilename()}` });
  test.info().attach("data-dictionary.pdf", { path: await download1.path(), contentType: 'application/pdf' });
});
