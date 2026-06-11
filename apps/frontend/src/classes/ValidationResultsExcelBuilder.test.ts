import ExcelJS from "exceljs";

import { ValidationErrorCodes } from "@/config/ValidationErrors";
import { errorMessageFactory } from "@/factories/submission/ErrorMessageFactory";
import { qcResultFactory } from "@/factories/submission/QCResultFactory";

import { ValidationResultsExcelBuilder } from "./ValidationResultsExcelBuilder";

describe("ValidationResultsExcelBuilder", () => {
  it("should serialize a workbook with a Summary sheet and required columns", async () => {
    const results = qcResultFactory.build(1, {
      displayID: 42,
      type: "participant",
      submittedID: "participant_01",
      severity: "Warning",
      validatedDate: "2026-05-01T10:00:00.000Z",
      errors: [],
      warnings: errorMessageFactory.build(1, () => ({
        code: ValidationErrorCodes.UPDATING_DATA,
        title: "Update Existing Data",
        description: "Incoming data will update an existing record",
      })),
    });

    const builder = new ValidationResultsExcelBuilder(results, []);
    const buffer = await builder.serialize();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const summary = workbook.getWorksheet("Summary");
    expect(summary).toBeDefined();

    const header = summary.getRow(1).values as string[];
    expect(header).toEqual([
      undefined,
      "Batch ID",
      "Node Type",
      "Submitted Identifier",
      "Severity",
      "Validated Date",
      "Issue Type",
      "Full Issue Description",
    ]);
  });

  it("should create Updated sheets and highlight changed *_new cells", async () => {
    const results = qcResultFactory.build(1);

    const builder = new ValidationResultsExcelBuilder(results, [
      {
        submittedID: "participant_01",
        nodeType: "participant",
        existing: { program_name: "Old Name", pi_email: "same@example.org" },
        incoming: { program_name: "New Name", pi_email: "same@example.org" },
      },
    ]);

    const buffer = await builder.serialize();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const updatedSheet = workbook.getWorksheet("Updated participant");
    expect(updatedSheet).toBeDefined();

    const header = updatedSheet.getRow(1).values as string[];
    expect(header).toContain("Submitted ID");
    expect(header).toContain("program_name_existing");
    expect(header).toContain("program_name_new");

    const changedColumnIndex = header.findIndex((value) => value === "program_name_new");
    const unchangedColumnIndex = header.findIndex((value) => value === "pi_email_new");

    const changedCell = updatedSheet.getRow(2).getCell(changedColumnIndex);
    const unchangedCell = updatedSheet.getRow(2).getCell(unchangedColumnIndex);

    expect(changedCell.style?.font?.bold).toBe(true);
    expect(changedCell.style?.font?.color?.argb).toBe("FFCA4F1A");
    expect(unchangedCell.style?.font?.bold).not.toBe(true);
  });
});
