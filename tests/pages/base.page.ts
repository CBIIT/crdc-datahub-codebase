import { expect, Locator, Page } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;

  protected constructor(page: Page) {
    this.page = page;
  }

  protected get baseUrl(): string {
    if (!process.env.BASE_URL) {
      throw new Error('BASE_URL environment variable is not defined');
    }

    return process.env.BASE_URL;
  }

  async navigate(path: string): Promise<void> {
    await this.page.goto(`${this.baseUrl}${path}`);
    await this.acceptConsentIfPresent();
  }

  private async acceptConsentIfPresent(): Promise<void> {
    const continueButton = this.page.getByRole('button', { name: 'Continue' }).first();

    if (await continueButton.isVisible()) {
      await continueButton.click();
    }
  }

  async waitForUrlPath(pathOrPattern: RegExp | string): Promise<void> {
    if (typeof pathOrPattern === 'string') {
      await expect(this.page).toHaveURL(new RegExp(`${pathOrPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
      return;
    }

    await expect(this.page).toHaveURL(pathOrPattern);
  }

  async clickIfVisible(locator: Locator): Promise<boolean> {
    if (await locator.isVisible()) {
      await locator.click();
      return true;
    }

    return false;
  }
}
