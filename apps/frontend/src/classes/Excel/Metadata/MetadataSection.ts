import type ExcelJS from "exceljs";

import { SectionBase, SectionCtxBase } from "../SectionBase";

import { MetaKeys, COLUMNS } from "./Columns";

type SectionADeps = {
  application: Omit<Application, "QuestionnaireData">;
  templateVersion: string;
  devTier: string;
  appVersion: string;
};

export class MetadataSection extends SectionBase<MetaKeys, SectionADeps> {
  static SHEET_NAME = "Metadata";

  constructor(deps: SectionADeps) {
    super({
      id: "A",
      sheetName: MetadataSection.SHEET_NAME,
      columns: COLUMNS,
      headerColor: "96ebff",
      deps,
    });
  }

  protected write(ctx: SectionCtxBase, ws: ExcelJS.Worksheet): ExcelJS.Row[] {
    const { application, templateVersion, devTier, appVersion } = this.deps;

    ws.getRow(2).values = {
      submissionId: application?._id,
      applicantName: application?.applicant?.applicantName,
      applicantId: application?.applicant?.applicantID,
      lastStatus: application?.status,
      formVersion: application?.version,
      createdAt: application?.createdAt,
      updatedAt: application?.updatedAt,
      devTier,
      templateVersion,
      appVersion,
      exportedAt: new Date().toISOString(),
    };

    return [ws.getRow(2)];
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
  protected async applyValidation(ctx: SectionCtxBase, ws: ExcelJS.Worksheet): Promise<void> {}
}

export { COLUMNS as MetadataColumns };
