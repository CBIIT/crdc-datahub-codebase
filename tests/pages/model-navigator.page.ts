import { expect, Locator, Page } from '@playwright/test';

import { BasePage } from './base.page';

export class ModelNavigatorPage extends BasePage {
  readonly modelNavigatorButton: Locator;
  readonly tableViewTab: Locator;

  constructor(page: Page) {
    super(page);
    this.modelNavigatorButton = page.getByRole('button', { name: 'Model Navigator' });
    this.tableViewTab = page.getByRole('tab', { name: 'Table View' });
  }

  async openModel(model: string): Promise<void> {
    await this.navigate('/');
    await this.modelNavigatorButton.click();
    await this.page.getByRole('link', { name: `${model} Model` }).click();
    await this.waitForUrlPath(/\/model-navigator\/.+\/latest(?:\?.*)?$/);
  }

  async switchToTableView(): Promise<void> {
    await this.tableViewTab.click();
  }

  async expectOnModelNavigator(): Promise<void> {
    await expect(this.page).toHaveURL(/\/model-navigator\/.+\/latest(?:\?.*)?$/);
  }
}
