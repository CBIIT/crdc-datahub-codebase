import type ExcelJS from "exceljs";
import { CellValue } from "exceljs";

import { Logger } from "@/utils/logger";

import { ErrorCatalog } from "./ErrorCatalog";

/**
 * Represents the context for a section in the Excel worksheet.
 */
export type SectionCtxBase = {
  /**
   * The Excel workbook.
   */
  workbook: ExcelJS.Workbook;
  /**
   * The utility functions for the section.
   */
  u: {
    /**
     * Set the header for the worksheet.
     *
     * @param ws The worksheet to modify.
     * @param color The color to use for the header.
     * @returns void
     */
    header: (ws: ExcelJS.Worksheet, color?: string) => void;
  };
};

/**
 * Represents the definition of a column in the section.
 */
export type ColumnDef<K extends string> = Omit<Partial<ExcelJS.Column>, "key"> & {
  key: K;
  /**
   * An optional annotation for the column header.
   */
  annotation?: string;
};

/**
 * Represents the character limits for each column in the section.
 */
export type CharacterLimitsMap<K extends string> = Readonly<Partial<{ [key in K]: number }>>;

/**
 * Represents the configuration for a section in the Excel worksheet.
 */
export type SectionConfig<K extends string, D> = {
  id: string;
  deps: D;
  sheetName: string;
  columns: ColumnDef<K>[];
  headerColor?: string;
  characterLimits?: CharacterLimitsMap<K>;
};

/**
 * Represents a section in the Excel worksheet.
 */
export type Section = {
  /**
   * The unique identifier for the section.
   *
   * @example "B"
   */
  id: string;
  /**
   * Serialize the section data to the worksheet.
   *
   * @param ctx The section context.
   * @returns The created worksheet.
   */
  serialize: (ctx: SectionCtxBase) => Promise<ExcelJS.Worksheet>;
};

/**
 * Represents a section in the Excel worksheet.
 */
export abstract class SectionBase<K extends string, D> implements Section {
  /**
   * The unique identifier for the section.
   * @example "B"
   */
  public readonly id: string;

  /**
   * The section dependencies.
   */
  protected readonly deps: D;

  /**
   * The name of the worksheet.
   * @example "Program and Study"
   */
  private readonly _sheetName: string;

  /**
   * The columns in the section.
   */
  private readonly _columns: ColumnDef<K>[];

  /**
   * The color of the header row.
   * @example "#D9EAD3"
   */
  private readonly _headerColor: string;

  /**
   * The character limits for each column in the section.
   */
  protected readonly CHARACTER_LIMITS: CharacterLimitsMap<K>;

  /**
   * Create a new section.
   *
   * @param cfg The section configuration.
   */
  constructor(cfg: SectionConfig<K, D>) {
    this.id = cfg.id;
    this.deps = cfg.deps;
    this._sheetName = cfg.sheetName;
    this._columns = cfg.columns;
    this._headerColor = cfg.headerColor || "#D9EAD3";
    this.CHARACTER_LIMITS = Object.freeze({ ...(cfg.characterLimits ?? {}) });
  }

  /**
   * Serialize the section data to the worksheet.
   *
   * @param ctx The section context.
   * @returns The created worksheet.
   */
  public async serialize(ctx: SectionCtxBase): Promise<ExcelJS.Worksheet> {
    const ws = this.create(ctx);
    this.write(ctx, ws);
    this.applyValidation(ctx, ws);
    this.annotate(
      ws,
      this._columns
        .filter((c) => c.annotation)
        .reduce(
          (acc, col) => {
            acc[col.key] = col.annotation;
            return acc;
          },
          {} as Partial<Record<K, string>>
        )
    );

    return ws;
  }

  /**
   * Create worksheet, add columns, and style header.
   *
   * @param ctx The section context.
   * @returns The created worksheet.
   */
  protected create(ctx: SectionCtxBase): ExcelJS.Worksheet {
    const existing = ctx.workbook.worksheets.find((ws) => ws.name === this._sheetName);
    if (existing) {
      ctx.workbook.removeWorksheet(existing.id);
    }

    const ws = ctx.workbook.addWorksheet(this._sheetName);
    ws.columns = this._columns;

    const color = (this._headerColor || "#D9EAD3").replace(/^#/, "").toUpperCase();
    ctx.u.header(ws, color);

    ws.views = [{ state: "frozen", ySplit: 1 }];

    return ws;
  }

  /**
   * Write data to the worksheet.
   *
   * @param ctx The section context.
   * @param ws The worksheet.
   * @returns The created row.
   */
  protected abstract write(ctx: SectionCtxBase, ws: ExcelJS.Worksheet): ExcelJS.Row[];

  /**
   * Attach data validation to the data in the worksheet.
   *
   * @param ctx The section context.
   * @param ws The worksheet.
   * @param row The row to validate.
   */
  protected abstract applyValidation(ctx: SectionCtxBase, ws: ExcelJS.Worksheet): Promise<void>;

  /**
   * Write annotations on the specified cells in the worksheet.
   *
   * @param ws The worksheet to annotate
   * @param annotations A map of Cell Key -> Note
   * @param rowNum The row to annotate. Default is the header row.
   */
  protected annotate(
    ws: ExcelJS.Worksheet,
    annotations: Partial<Record<K, string>>,
    rowNum = 1
  ): void {
    const row = ws.getRow(rowNum);
    this._columns.forEach((col, index) => {
      if (col.key in annotations) {
        const cell = row.getCell(index + 1);
        cell.note = {
          texts: [{ text: annotations[col.key] || "" }],
          protection: { locked: "True", lockText: "True" },
        };
      }
    });
  }

  /**
   * Get the cells in row 2 of the worksheet.
   *
   * @note Follows the order of the defined columns.
   * @param ws The worksheet.
   * @param row The row number to get cells from.
   * @returns The cells in the specified row.
   */
  protected getRowCells(ws: ExcelJS.Worksheet, row = 2) {
    const r = ws.getRow(row);
    const cells = this._columns.map((col) => r.getCell(col.key)) || [];

    return cells;
  }

  /**
   * Set the values for a specific row in the worksheet.
   *
   * @param ws The worksheet.
   * @param rowIndex The index of the row to update.
   * @param values The values to set.
   */
  protected setRowValues(
    ws: ExcelJS.Worksheet,
    rowIndex: number,
    values: Partial<Record<K, CellValue>>
  ) {
    const row = ws.getRow(rowIndex);
    this._columns.forEach((col, index) => {
      if (col.key in values) {
        row.getCell(index + 1).value = values[col.key] || null;
      }
    });
  }

  /**
   * Apply data validation to a specific column in the worksheet.
   *
   * @param ws The worksheet.
   * @param key The column key.
   * @param callback The callback to apply to each cell.
   * @param options The options for the cell range.
   */
  protected forEachCellInColumn(
    ws: ExcelJS.Worksheet,
    key: K,
    callback: (cell: ExcelJS.Cell, rowNumber: number) => void,
    options?: { startRow?: number; endRow?: number }
  ): void {
    const keyIsFound = this._columns?.find((c) => c.key === key);
    if (!keyIsFound) {
      Logger.error(`SectionBase.tsx: Column with key "${key}" not found.`);
      return;
    }

    const { startRow = 2, endRow = 100 } = options ?? {};
    const column = ws.getColumn(key as string);

    Array.from({ length: endRow - startRow + 1 }, (_, i) => i + startRow).forEach((rowNum) => {
      const row = ws.getRow(rowNum);
      const cell = row.getCell(column.number);
      callback(cell, rowNum);
    });
  }

  /**
   * Applies a standard character limit validation to the specified cell.
   *
   * @param cell The cell to apply the ruleset to
   * @param limit The character limit to apply
   */
  // eslint-disable-next-line class-methods-use-this
  protected applyTextLengthValidation(cell: ExcelJS.Cell, limit: number): void {
    cell.dataValidation = {
      type: "textLength",
      operator: "lessThanOrEqual",
      showErrorMessage: true,
      error: ErrorCatalog.get("max", { max: limit }),
      allowBlank: false,
      formulae: [limit],
    };
  }
}
