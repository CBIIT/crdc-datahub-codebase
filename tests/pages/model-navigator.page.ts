import { expect, Locator, Page } from '@playwright/test';

import { BasePage } from './base.page';

export class ModelNavigatorPage extends BasePage {
  readonly modelNavigatorButton: Locator;

  constructor(page: Page) {
    super(page);
    this.modelNavigatorButton = page.getByRole('button', { name: 'Model Navigator' });
  }

  async openModel(model: string): Promise<void> {
    await this.navigate('/');
    await this.modelNavigatorButton.click();
    await this.page.getByRole('link', { name: `${model} Model` }).click();
    await this.waitForUrlPath(/\/model-navigator\/.+\/latest(?:\?.*)?$/);
  }

  async switchToTableView(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Table View' }).click();
  }

  async switchToVersionHistoryView(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Version History' }).click();
  }
}
