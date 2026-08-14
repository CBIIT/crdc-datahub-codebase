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
    this.createSrfConfirmButton = page.getByRole("dialog").getByTestId('delete-dialog-confirm-button');
  }

  async open(): Promise<void> {
    await this.navigate('/submission-requests');

    await this.waitForUrlPath(/\/submission-requests(?:\?.*)?$/);
  }

  async openCreateSRFModal(): Promise<void> {
    await expect(this.createSrfButton).toBeVisible();
    await this.createSrfButton.click();

    await expect(this.createSrfConfirmButton).toBeVisible();
  }

  async confirmCreateSRF(): Promise<void> {
    await this.createSrfConfirmButton.click();

    await this.waitForUrlPath(/\/submission-request\/new(?:\?.*)?$/);

    await expect(this.page.getByRole('heading', { name: 'Submission Request Form' })).toBeVisible();
  }
}
