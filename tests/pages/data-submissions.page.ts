import { expect, Locator, Page } from '@playwright/test';

import { BasePage } from './base.page';

export type DataSubmissionIntention = 'New/Update' | 'Delete';
export type DataSubmissionDataType = 'Metadata and Data Files' | 'Metadata Only';

export type CreateDataSubmissionOptions = {
  submissionName: string;
  studyId: string;
  dataCommons?: string;
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
  readonly studyIdInput: Locator;
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
    this.studyIdInput = page.getByTestId('create-data-submission-dialog-study-id-input');
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

  async chooseDataType(dataType: DataSubmissionDataType): Promise<void> {
    await this.dataTypeInput.getByText(dataType, { exact: true }).click();
  }

  async chooseDataCommonsAndStudy(dataCommons: string, studyId: string): Promise<void> {
    await this.dataCommonsInput.getByRole('button').click();
    await this.dataCommonsInput.getByText(dataCommons, { exact: true }).click();

    await this.studyIdInput.getByRole('button').click();
    await this.page.getByTestId(`study-option-${studyId}`).click();
  }

  async createSubmission(submissionName: string, clickSubmissionLinkAfterCreate = true): Promise<void> {
    await this.submissionNameInputWrapper.getByRole('textbox').fill(submissionName);
    await this.createSubmissionButton.click();

    if (clickSubmissionLinkAfterCreate) {
      await this.page.getByRole('link', { name: submissionName, exact: true }).first().click();
    }
  }

  async createDataSubmissionFlow(options: CreateDataSubmissionOptions): Promise<void> {
    const {
      submissionName,
      studyId,
      dataCommons = 'CTDC',
      intention = 'New/Update',
      dataType = 'Metadata Only',
      openFromHome = true,
      clickSubmissionLinkAfterCreate = true,
    } = options;

    if (openFromHome) {
      await this.open();
    }

    await this.openCreateDataSubmissionDialog(intention);
    await this.chooseDataType(dataType);
    await this.chooseDataCommonsAndStudy(dataCommons, studyId);
    await this.createSubmission(submissionName, clickSubmissionLinkAfterCreate);
  }

  async uploadMetadataFiles(files: string[]): Promise<void> {
    await this.metadataFileSelectButton.click();
    await this.metadataFileInput.setInputFiles(files);
    await this.metadataUploadButton.click();
    await expect(this.genericTableRow).toContainText('Uploaded');
  }

  async runValidationAndExpectCompleted(): Promise<void> {
    await this.runAllValidationsRadio.check();
    await this.validateButton.click();
    await expect(this.page.locator('#notistack-snackbar')).toContainText(
      'Validation process is starting; this may take some time. Please wait before initiating another validation.'
    );
    await expect(this.validationStatusChip).toContainText('VALIDATION COMPLETED');
  }

  async adminSubmit(justification: string): Promise<void> {
    await this.adminSubmitButton.click();
    await this.adminJustificationInput.fill(justification);
    await this.confirmSubmitButton.click();
  }
}
