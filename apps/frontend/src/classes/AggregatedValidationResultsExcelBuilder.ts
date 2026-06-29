import ExcelJS from "exceljs";

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

type AggregatedSummaryRow = {
  "Issue Type": string;
  Property: string;
  Value: string;
  Severity: string;
  "Record Count": string;
};

export class AggregatedValidationResultsExcelBuilder {
  private workbook: ExcelJS.Workbook;

  private results: AggregatedQCResult[];

  constructor(results: AggregatedQCResult[]) {
    this.workbook = new ExcelJS.Workbook();
    this.results = results;
  }

  public async serialize(): Promise<ArrayBuffer> {
    this.setMetadataProperties();
    this.addSummarySheet();

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

    const rows = this.results.map((result) => ({
      "Issue Type": result.title ?? "",
      Property: result.property ?? "",
      Value: result.value ?? "",
      Severity: result.severity ?? "",
      "Record Count": Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
        result.count || 0
      ),
    }));

    AggregatedValidationResultsExcelBuilder.setSheetRows(ws, rows);

    if (!rows.length) {
      return;
    }

    ws.getColumn("Issue Type").width = 30;
    ws.getColumn("Property").width = 30;
    ws.getColumn("Value").width = 30;
    ws.getColumn("Record Count").width = 16;
  }

  private static setSheetRows(ws: ExcelJS.Worksheet, rows: AggregatedSummaryRow[]): void {
    if (!rows.length) {
      ws.columns = [
        { header: "Issue Type", key: "Issue Type", width: 30 },
        { header: "Property", key: "Property", width: 30 },
        { header: "Value", key: "Value", width: 30 },
        { header: "Severity", key: "Severity", width: 16 },
        { header: "Record Count", key: "Record Count", width: 16 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.eachCell((cell) => {
        cell.style = { ...cell.style, ...HEADER_STYLE };
      });

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
}
