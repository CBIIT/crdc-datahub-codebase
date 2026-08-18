import { expect, Locator, Page } from '@playwright/test';

import { BasePage } from './base.page';

export type DataSubmissionIntention = 'New/Update' | 'Delete';
export type DataSubmissionDataType = 'Metadata and Data Files' | 'Metadata Only';

export type CreateDataSubmissionOptions = {
  submissionName: string;
  studyName: string;
  dataCommons: string;
  intention?: DataSubmissionIntention;
  dataType?: DataSubmissionDataType;
  openFromHome?: boolean;
  clickSubmissionLinkAfterCreate?: boolean;
};

export class DataSubmissionsPage extends BasePage {
  readonly dataSubmissionsButton: Locator;
  readonly createDataSubmissionButton: Locator;
  readonly submissionTypeInput: Locator;
  readonly dataTypeInput: Locator;
  readonly dataCommonsInput: Locator;
  readonly studyInput: Locator;
  readonly submissionNameInputWrapper: Locator;
  readonly createSubmissionButton: Locator;
  readonly metadataFileSelectButton: Locator;
  readonly metadataFileInput: Locator;
  readonly metadataUploadButton: Locator;
  readonly genericTableRow: Locator;
  readonly runAllValidationsRadio: Locator;
  readonly validateButton: Locator;
  readonly validationStatusChip: Locator;
  readonly adminSubmitButton: Locator;
  readonly adminJustificationInput: Locator;
  readonly confirmSubmitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.dataSubmissionsButton = page.getByRole('button', { name: 'Data Submissions' });
    this.createDataSubmissionButton = page.getByRole('button', { name: 'Create a Data Submission' });
    this.submissionTypeInput = page.getByTestId('create-data-submission-dialog-submission-type-input');
    this.dataTypeInput = page.getByTestId('create-data-submission-dialog-data-type-input');
    this.dataCommonsInput = page.getByTestId('create-data-submission-dialog-data-commons-input');
    this.studyInput = page.getByTestId('create-data-submission-dialog-study-id-input');
    this.submissionNameInputWrapper = page.getByTestId('create-data-submission-dialog-submission-name-input');
    this.createSubmissionButton = page.getByTestId('create-data-submission-dialog-create-button');
    this.metadataFileSelectButton = page.getByTestId('metadata-upload-file-select-button');
    this.metadataFileInput = page.getByTestId('metadata-upload-file-input');
    this.metadataUploadButton = page.getByTestId('metadata-upload-file-upload-button');
    this.genericTableRow = page.getByTestId('generic-table-row');
    this.runAllValidationsRadio = page.getByRole('radio', { name: 'Run validations on all files' });
    this.validateButton = page.getByTestId('validate-controls-validate-button');
    this.validationStatusChip = page.getByTestId('validation-status-chip');
    this.adminSubmitButton = page.getByRole('button', { name: 'Admin Submit' });
    this.adminJustificationInput = page.getByRole('textbox', { name: 'Admin override justification' });
    this.confirmSubmitButton = page.getByRole('button', { name: 'Confirm to Submit' });
  }

  async open(): Promise<void> {
    await this.navigate('/');
    await this.dataSubmissionsButton.click();
    await this.waitForUrlPath(/\/data-submissions(?:\?.*)?$/);
  }

  async openCreateDataSubmissionDialog(intention: DataSubmissionIntention = 'New/Update'): Promise<void> {
    await this.createDataSubmissionButton.click();
    await this.submissionTypeInput.getByText(intention, { exact: true }).click();
  }

  async createSubmission(options: CreateDataSubmissionOptions): Promise<Locator> {
    const {
      submissionName,
      studyName,
      dataCommons,
      intention = 'New/Update',
      dataType = 'Metadata Only',
    } = options;

    await this.openCreateDataSubmissionDialog(intention);
    await this.dataTypeInput.getByText(dataType, { exact: true }).click();

    await this.dataCommonsInput.getByRole('button').click();
    await this.dataCommonsInput.getByText(dataCommons, { exact: true }).click();

    await this.studyInput.getByRole('button').click();
    await this.studyInput.getByText(studyName, { exact: true }).click();
    await this.submissionNameInputWrapper.getByRole('textbox').fill(submissionName);
    await this.createSubmissionButton.click();

    return this.page.getByRole('link', { name: submissionName, exact: true }).first();
  }

  async adminSubmit(justification: string): Promise<void> {
    await this.adminSubmitButton.click();
    await this.adminJustificationInput.fill(justification);
    await this.confirmSubmitButton.click();
  }
}
