import ExcelJS from "exceljs";

import { aggregatedQCResultFactory } from "@/factories/submission/AggregatedQCResultFactory";

import { AggregatedValidationResultsExcelBuilder } from "./AggregatedValidationResultsExcelBuilder";

describe("AggregatedValidationResultsExcelBuilder", () => {
  it("should serialize a workbook with a Summary sheet and expected columns", async () => {
    const results = aggregatedQCResultFactory.build(1, {
      title: "Updated value differs from released",
      property: "participant_id",
      value: "PT-001",
      severity: "Warning",
      count: 1234,
    });

    const builder = new AggregatedValidationResultsExcelBuilder(results);
    const buffer = await builder.serialize();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const summary = workbook.getWorksheet("Summary");
    expect(summary).toBeDefined();

    const header = summary.getRow(1).values as string[];
    expect(header).toEqual([
      undefined,
      "Issue Type",
      "Property",
      "Value",
      "Severity",
      "Record Count",
    ]);

    const row = summary.getRow(2).values as string[];
    expect(row[1]).toBe("Updated value differs from released");
    expect(row[2]).toBe("participant_id");
    expect(row[3]).toBe("PT-001");
    expect(row[4]).toBe("Warning");
    expect(row[5]).toBe("1,234");
  });

  it("should create only the Summary sheet", async () => {
    const results = aggregatedQCResultFactory.build(2);

    const builder = new AggregatedValidationResultsExcelBuilder(results);
    const buffer = await builder.serialize();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.worksheets).toHaveLength(1);
    expect(workbook.getWorksheet("Summary")).toBeDefined();
  });

  it("should serialize safely with empty results", async () => {
    const builder = new AggregatedValidationResultsExcelBuilder([]);
    const buffer = await builder.serialize();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const summary = workbook.getWorksheet("Summary");
    expect(summary).toBeDefined();

    const header = summary.getRow(1).values as string[];
    expect(header).toEqual([
      undefined,
      "Issue Type",
      "Property",
      "Value",
      "Severity",
      "Record Count",
    ]);
  });
});
