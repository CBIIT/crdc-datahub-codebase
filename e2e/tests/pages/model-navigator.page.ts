import { expect, Locator, Page } from '@playwright/test';

import { BasePage } from './base.page';

export class ModelNavigatorPage extends BasePage {
  readonly modelNavigatorButton: Locator;
  readonly gcModelLink: Locator;
  readonly categoryButton: Locator;
  readonly tableViewTab: Locator;

  constructor(page: Page) {
    super(page);
    this.modelNavigatorButton = page.getByRole('button', { name: 'Model Navigator' });
    this.gcModelLink = page.getByRole('link', { name: 'GC Model' });
    this.categoryButton = page.getByRole('button', { name: 'Category', exact: true });
    this.tableViewTab = page.getByRole('tab', { name: 'Table View' });
  }

  async openGcModel(): Promise<void> {
    await this.navigate('/');
    await this.modelNavigatorButton.click();
    await this.gcModelLink.click();
    await this.waitForUrlPath(/\/model-navigator\/.+\/latest(?:\?.*)?$/);
  }

  async switchToTableView(): Promise<void> {
    await this.categoryButton.click();
    await this.tableViewTab.click();
  }

  async expectOnModelNavigator(): Promise<void> {
    await expect(this.page).toHaveURL(/\/model-navigator\/.+\/latest(?:\?.*)?$/);
  }
}
