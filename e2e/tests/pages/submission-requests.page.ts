import { expect, Locator, Page } from '@playwright/test';

import { BasePage } from './base.page';

export class SubmissionRequestsPage extends BasePage {
  readonly pageTitle: Locator;
  readonly createSrfButton: Locator;
  readonly createSrfConfirmButton: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.getByRole('heading', { name: 'Submission Requests' });
    this.createSrfButton = page.getByTestId('create-application-button');
    this.createSrfConfirmButton = page.getByRole('button', { name: 'I Read and Accept' });
  }

  async open(): Promise<void> {
    await this.navigate('/submission-requests');

    await this.waitForUrlPath(/\/submission-requests(?:\?.*)?$/);
    await expect(this.pageTitle).toBeVisible();
  }

  async clickCreateSrfButton(): Promise<void> {
    await expect(this.createSrfButton).toBeVisible();
    await this.createSrfButton.click();
  }

  async confirmCreateSrf(): Promise<void> {
    await expect(this.createSrfConfirmButton).toBeVisible();
    await this.createSrfConfirmButton.click();
    await this.waitForUrlPath(/\/submission-request\/new(?:\?.*)?$/);
  }
}
