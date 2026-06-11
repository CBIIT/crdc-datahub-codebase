import ExcelJS from "exceljs";
import { isEqual } from "lodash";

import { FormatDate, coerceToString } from "@/utils";

const DELETE_DATA_SYMBOL = "<delete>";
const SUMMARY_SHEET_NAME = "Summary";

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF083A50" } },
  border: {
    top: { style: "thin", color: { argb: "FFDDDDDD" } },
    left: { style: "thin", color: { argb: "FFDDDDDD" } },
    bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
    right: { style: "thin", color: { argb: "FFDDDDDD" } },
  },
};

const CHANGED_CELL_STYLE: Partial<ExcelJS.Style> = {
  font: { color: { argb: "FFCA4F1A" }, bold: true },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEFE6" } },
};

export type UpdatedComparisonRow = {
  submittedID: string;
  nodeType: string;
  existing: Record<string, unknown>;
  incoming: Record<string, unknown>;
};

export class ValidationResultsExcelBuilder {
  /**
   * The internal ExcelJS Workbook object.
   * This object is used to create and manipulate the Excel file during the export process.
   */
  private workbook: ExcelJS.Workbook;

  /**
   * The internal array of unpacked QCResult objects that represent the validation results to be exported.
   * Each QCResult in this array has been unpacked so that it contains either errors or warnings (not both).
   */
  private results: QCResult[];

  /**
   * The internal array of UpdatedComparisonRow objects that represent the comparisons between
   * existing and incoming data for updated records.
   */
  private comparisons: UpdatedComparisonRow[];

  constructor(results: QCResult[], comparisons: UpdatedComparisonRow[]) {
    this.workbook = new ExcelJS.Workbook();
    this.results = results;
    this.comparisons = comparisons;
  }

  public async serialize(): Promise<ArrayBuffer> {
    this.setMetadataProperties();
    this.addSummarySheet();
    this.addUpdatedSheets();

    return this.workbook.xlsx.writeBuffer();
  }

  private setMetadataProperties(): void {
    this.workbook.creator = "crdc-datahub-ui";
    this.workbook.lastModifiedBy = "crdc-datahub-ui";
    this.workbook.title = "Data Submission Validation Results";
    this.workbook.subject = "Validation Results Export";
    this.workbook.company = "National Cancer Institute";
    this.workbook.category = "Data Export";
    this.workbook.created = new Date();
    this.workbook.modified = new Date();
  }

  private addSummarySheet(): void {
    const ws = this.workbook.addWorksheet(SUMMARY_SHEET_NAME);
    const rows = this.results.map((result) => {
      const issue = result.errors?.[0] ?? result.warnings?.[0];

      return {
        "Batch ID": result.displayID,
        "Node Type": result.type,
        "Submitted Identifier": result.submittedID,
        Severity: result.severity,
        "Validated Date": FormatDate(result?.validatedDate, "MM-DD-YYYY [at] hh:mm A", ""),
        "Issue Type": issue?.title ?? "",
        "Full Issue Description": ValidationResultsExcelBuilder.normalizeIssueDescription(
          issue?.description
        ),
      };
    });

    ValidationResultsExcelBuilder.setSheetRows(ws, rows);

    if (!rows.length) {
      return;
    }

    ws.getColumn("Validated Date").width = 20;
    ws.getColumn("Issue Type").width = 20;
    ws.getColumn("Full Issue Description").width = 85;
  }

  private addUpdatedSheets(): void {
    if (!this.comparisons?.length) {
      return;
    }

    const byNodeType = this.comparisons.reduce<Record<string, UpdatedComparisonRow[]>>(
      (acc, row) => {
        const key = row.nodeType;
        acc[key] = acc[key] ?? [];
        acc[key].push(row);
        return acc;
      },
      {}
    );

    Object.entries(byNodeType).forEach(([nodeType, rows]) => {
      const ws = this.workbook.addWorksheet(`Updated ${nodeType}`);

      const allPropertyNames = Array.from(
        new Set(rows.flatMap((row) => [...Object.keys(row.existing), ...Object.keys(row.incoming)]))
      ).sort();

      const tableRows = rows.map((row) => {
        const base: Record<string, string> = { "Submitted ID": row.submittedID };

        allPropertyNames.forEach((property) => {
          base[`${property}_existing`] = coerceToString(row.existing?.[property]);
          base[`${property}_new`] = coerceToString(row.incoming?.[property]);
        });

        return base;
      });

      ValidationResultsExcelBuilder.setSheetRows(ws, tableRows);

      rows.forEach((row, rowIndex) => {
        const changedProperties = allPropertyNames.filter((property) => {
          const [incomingValue, existingValue] = [
            row.incoming?.[property],
            row.existing?.[property],
          ];

          return (
            (!isEqual(incomingValue, existingValue) &&
              incomingValue !== "" &&
              incomingValue !== null) ||
            incomingValue === DELETE_DATA_SYMBOL
          );
        });

        changedProperties.forEach((property) => {
          const columnKey = `${property}_new`;
          const targetCol = ws.columns.findIndex((column) => column.key === columnKey) + 1;

          if (!targetCol) {
            return;
          }

          const cell = ws.getRow(rowIndex + 2).getCell(targetCol);
          cell.style = { ...cell.style, ...CHANGED_CELL_STYLE };
        });
      });
    });
  }

  private static setSheetRows<T extends Record<string, string | number>>(
    ws: ExcelJS.Worksheet,
    rows: T[]
  ): void {
    if (!rows.length) {
      ws.views = [{ state: "frozen", ySplit: 1 }];
      return;
    }

    const first = rows[0];
    const keys = Object.keys(first);

    ws.columns = keys.map((key) => ({
      header: key,
      key,
      width: Math.min(55, Math.max(16, key.length + 4)),
    }));

    rows.forEach((row) => {
      ws.addRow(row);
    });

    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.style = { ...cell.style, ...HEADER_STYLE };
    });

    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  private static normalizeIssueDescription(value?: string): string {
    if (!value || typeof value !== "string") {
      return "";
    }

    // NOTE: The ErrorMessage descriptions contain non-standard double quotes
    // that don't render correctly in Excel. This replaces them with standard double quotes.
    return value.replaceAll(/[“”‟〞＂]/g, '"');
  }
}
