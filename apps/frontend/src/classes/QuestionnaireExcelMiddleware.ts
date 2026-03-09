import { LazyQueryExecFunction } from "@apollo/client";
import ExcelJS from "exceljs";
import { cloneDeep, merge, union, toString } from "lodash";
import z from "zod";

import cancerTypeOptions from "@/config/CancerTypesConfig";
import DataTypes from "@/config/DataTypesConfig";
import { fileTypeExtensions } from "@/config/FileTypeConfig";
import fundingOptions from "@/config/FundingConfig";
import { InitialQuestionnaire } from "@/config/InitialValues";
import { NotApplicableProgram, OtherProgram } from "@/config/ProgramConfig";
import { InitialSections } from "@/config/SectionConfig";
import speciesOptions from "@/config/SpeciesConfig";
import env from "@/env";
import { ListInstitutionsResp, ListOrgsInput, ListOrgsResp } from "@/graphql";
import {
  SectionASchema,
  SectionBSchema,
  SectionCSchema,
  SectionDSchema,
} from "@/schemas/ApplicationSections";
import { isFormulaValue, isHyperlinkValue, isRichTextValue, isSharedFormulaValue } from "@/utils";
import { parseReleaseVersion } from "@/utils/envUtils";
import { determineSectionStatus, parseSchemaObject, sectionHasData } from "@/utils/formUtils";
import { Logger } from "@/utils/logger";

import { SectionA, SectionAColumns } from "./Excel/A/SectionA";
import { SectionB, SectionBColumns } from "./Excel/B/SectionB";
import { SectionC, SectionCColumns } from "./Excel/C/SectionC";
import { SectionD, SectionDColumns } from "./Excel/D/SectionD";
import { InstructionsSection } from "./Excel/Instructions/InstructionsSection";
import { MetaKeys } from "./Excel/Metadata/Columns";
import { MetadataColumns, MetadataSection } from "./Excel/Metadata/MetadataSection";
import { SectionCtxBase } from "./Excel/SectionBase";

/**
 * An internal template version identifier.
 */
export const TEMPLATE_VERSION = "1.6";

/**
 * The names of the HIDDEN sheets used in the Excel workbook.
 * Primarily used for hidden lists.
 */
export const HIDDEN_SHEET_NAMES = {
  institutions: "InstitutionList",
  programs: "ProgramList",
  fileTypes: "FileTypeList",
  cancerTypes: "CancerTypeList",
  speciesOptions: "SubjectSpeciesList",
  fundingAgencies: "FundingAgencyList",
  repositoryDataTypes: "RepositoryDataTypeList",
} as const;

/**
 * The required dependencies to import or export a Submission Request.
 */
export type MiddlewareDependencies = {
  application?: Omit<Application, "QuestionnaireData">;
  getPrograms?: LazyQueryExecFunction<ListOrgsResp, ListOrgsInput>;
  getInstitutions?: LazyQueryExecFunction<ListInstitutionsResp, unknown>;
};

/**
 * A specialized class to handle importing and exporting of a Submission Request.
 * This class is designed to work with QuestionnaireData, allowing for the import and export of data
 * via Excel files.
 */
export class QuestionnaireExcelMiddleware {
  /**
   * The internal ExcelJS Workbook object.
   * This object is used to create and manipulate the Excel file during the import/export process.
   */
  private workbook: ExcelJS.Workbook;

  /**
   * The internal QuestionnaireData object.
   * This object is mutated during the import process, but remains immutable for export.
   */
  private data: QuestionnaireData | null;

  /**
   * An internal array to store any validation issues encountered during the parsing process.
   */
  private validationIssues: z.core.$ZodIssue[] = [];

  /**
   * The dependencies required for exporting or importing,
   * such as fetching Programs or Institutions.
   */
  private dependencies: MiddlewareDependencies;

  /**
   * Creates an instance of the QuestionnaireExcelMiddleware.
   *
   * @param data The QuestionnaireData object, if applicable, to be exported.
   * @param dependencies The import/export dependencies
   */
  constructor(data: QuestionnaireData | null, dependencies: MiddlewareDependencies) {
    this.workbook = new ExcelJS.Workbook();
    this.data = data ? cloneDeep(data) : null;
    this.dependencies = dependencies;
  }

  /**
   * A method to serialize the QuestionnaireData object to an Excel file.
   * If no `QuestionnaireData` is provided, the Excel file will be generated with no pre-filled values.
   *
   * @throws Will throw an error if the serialization fails significantly.
   * @returns A Promise that resolves to an ArrayBuffer containing the Excel file data.
   */
  public async serialize(): Promise<ArrayBuffer> {
    this.setMetadataProperties();

    await this.serializeMetadata();
    await this.serializeInstructions();
    await this.serializeSectionA();
    await this.serializeSectionB();
    await this.serializeSectionC();
    await this.serializeSectionD();

    return this.workbook.xlsx.writeBuffer();
  }

  /**
   * A static method to parse the input file and return a QuestionnaireExcelMiddleware instance.
   * This method is the inverse of the `serialize` method.
   *
   * @param file The Excel file data to be parsed.
   * @param dependencies The dependencies required for parsing the data.
   * @throws Will throw an error if the data cannot be parsed or is invalid.
   * @returns A new instance of QuestionnaireExcelMiddleware with the parsed data.
   */
  public static async parse(
    file: File,
    dependencies: MiddlewareDependencies
  ): Promise<QuestionnaireData> {
    // Load the workbook from the File
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file?.arrayBuffer());

    // Create an instance with null data, then assign the loaded workbook
    const middleware = new QuestionnaireExcelMiddleware(null, dependencies);
    middleware.workbook = workbook;
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    await middleware.parseMetadata();
    await middleware.parseSectionA();
    await middleware.parseSectionB();
    await middleware.parseSectionC();
    await middleware.parseSectionD();

    return middleware.data;
  }

  /**
   * Sets the metadata properties for the Excel workbook.
   *
   * @returns A Promise that resolves when the properties have been set.
   */
  private async setMetadataProperties(): Promise<void> {
    this.workbook.creator = "crdc-datahub-ui";
    this.workbook.lastModifiedBy = "crdc-datahub-ui";
    this.workbook.title = "CRDC Submission Request";
    this.workbook.subject = "CRDC Submission Request Template";
    this.workbook.company = "National Cancer Institute";
    this.workbook.created = new Date();
    this.workbook.modified = new Date();
  }

  /**
   * Builds the metadata page for the Excel workbook.
   *
   * @returns A readonly reference to the created worksheet.
   */
  private async serializeMetadata(): Promise<Readonly<ExcelJS.Worksheet>> {
    const ctx: SectionCtxBase = {
      workbook: this.workbook,
      u: {
        header: (ws: ExcelJS.Worksheet, color?: string) => {
          const r1 = ws.getRow(1);
          r1.font = { bold: true };
          r1.alignment = { horizontal: "center" };
          r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
          ws.state = "veryHidden";
        },
      },
    };

    const metaSection = new MetadataSection({
      application: this.dependencies.application,
      templateVersion: TEMPLATE_VERSION,
      devTier: env.VITE_DEV_TIER || "N/A",
      appVersion: parseReleaseVersion(),
    });

    return metaSection.serialize(ctx);
  }

  /**
   * Serializes the instructions section into the Excel workbook.
   *
   * @returns A readonly reference to the created worksheet.
   */
  private async serializeInstructions(): Promise<Readonly<ExcelJS.Worksheet>> {
    const ctx: SectionCtxBase = {
      workbook: this.workbook,
      u: {
        header: (ws: ExcelJS.Worksheet, color?: string) => {
          const r1 = ws.getRow(1);
          r1.font = { bold: true };
          r1.alignment = { horizontal: "center" };
          r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        },
      },
    };

    const instructionsSection = new InstructionsSection();

    return instructionsSection.serialize(ctx);
  }

  /**
   * Adds the form section A to the Excel workbook.
   *
   * @returns A readonly reference to the created worksheet.
   */
  private async serializeSectionA(): Promise<Readonly<ExcelJS.Worksheet>> {
    const ctx: SectionCtxBase = {
      workbook: this.workbook,
      u: {
        header: (ws: ExcelJS.Worksheet, color?: string) => {
          const r1 = ws.getRow(1);
          r1.font = { bold: true };
          r1.alignment = { horizontal: "center" };
          r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        },
      },
    };

    const sectionA = new SectionA({
      data: this.data as QuestionnaireData,
      institutionSheet: await this.createInstitutionSheet(),
    });

    return sectionA.serialize(ctx);
  }

  /**
   * Serializes Section B data into the Excel workbook.
   *
   * @returns The serialized worksheet for Section B.
   */
  private async serializeSectionB(): Promise<Readonly<ExcelJS.Worksheet>> {
    const ctx: SectionCtxBase = {
      workbook: this.workbook,
      u: {
        header: (ws: ExcelJS.Worksheet, color?: string) => {
          const r1 = ws.getRow(1);
          r1.font = { bold: true };
          r1.alignment = { horizontal: "center" };
          r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        },
      },
    };

    const sectionB = new SectionB({
      data: this.data as QuestionnaireData,
      programSheet: await this.createProgramsSheet(),
      fundingAgenciesSheet: await this.createFundingAgencySheet(),
      repositoryDataTypesSheet: await this.createRepositoryDataTypesSheet(),
    });

    const sheet = await sectionB.serialize(ctx);

    return sheet;
  }

  /**
   * Adds the form section C to the Excel workbook.
   *
   * @returns A readonly reference to the created worksheet.
   */
  private async serializeSectionC(): Promise<Readonly<ExcelJS.Worksheet>> {
    const ctx: SectionCtxBase = {
      workbook: this.workbook,
      u: {
        header: (ws: ExcelJS.Worksheet, color?: string) => {
          const r1 = ws.getRow(1);
          r1.font = { bold: true };
          r1.alignment = { horizontal: "center" };
          r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        },
      },
    };

    const sectionC = new SectionC({
      data: this.data as QuestionnaireData,
      cancerTypesSheet: await this.createCancerTypesSheet(),
      speciesSheet: await this.createSpeciesListSheet(),
    });

    return sectionC.serialize(ctx);
  }

  private async serializeSectionD(): Promise<Readonly<ExcelJS.Worksheet>> {
    const ctx: SectionCtxBase = {
      workbook: this.workbook,
      u: {
        header: (ws: ExcelJS.Worksheet, color?: string) => {
          const r1 = ws.getRow(1);
          r1.font = { bold: true };
          r1.alignment = { horizontal: "center" };
          r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        },
      },
    };

    const sectionD = new SectionD({
      data: this.data as QuestionnaireData,
      programSheet: await this.createProgramsSheet(),
      fileTypesSheet: await this.createFileTypesSheet(),
    });

    const sheet = await sectionD.serialize(ctx);

    return sheet;
  }

  /**
   * Parses the data from the metadata section.
   *
   * @returns A Promise that resolves to a boolean indicating success or failure of the parsing.
   */
  private async parseMetadata(): Promise<boolean> {
    const sheet = this.workbook.getWorksheet(MetadataSection.SHEET_NAME);
    if (!sheet) {
      return false;
    }

    const data = await this.extractValuesFromWorksheet(sheet);
    const newData = new Map<MetaKeys, Array<unknown>>();

    data.forEach((values, key) => {
      const colKey = MetadataColumns.find((col) => col.header === key)?.key;
      newData.set(
        colKey,
        values.map((value) => toString(value).trim())
      );
    });

    if (newData?.get("devTier")?.[0] !== env.VITE_DEV_TIER) {
      Logger.info("QuestionnaireExcelMiddleware: Received mismatched devTier.", {
        expected: env.VITE_DEV_TIER,
        received: newData?.get("devTier")?.[0],
      });
    }
    if (newData?.get("templateVersion")?.[0] !== TEMPLATE_VERSION) {
      Logger.info("QuestionnaireExcelMiddleware: Received mismatched templateVersion.", {
        expected: TEMPLATE_VERSION,
        received: newData?.get("templateVersion")?.[0],
      });
    }
    if (
      newData?.get("submissionId")?.[0] &&
      newData?.get("submissionId")?.[0] !== this.dependencies?.application?._id
    ) {
      Logger.info("QuestionnaireExcelMiddleware: Received mismatched submissionId.", {
        expected: this.dependencies?.application?._id,
        received: newData?.get("submissionId")?.[0],
      });
    }
    if (
      newData?.get("appVersion")?.[0] &&
      newData?.get("appVersion")?.[0] !== parseReleaseVersion()
    ) {
      Logger.info("QuestionnaireExcelMiddleware: Received mismatched appVersion.", {
        expected: parseReleaseVersion(),
        received: newData?.get("appVersion")?.[0],
      });
    }

    return true;
  }

  /**
   * Parses the data from Section A of the Excel workbook.
   *
   * @returns A Promise that resolves to a boolean indicating success or failure of the parsing.
   */
  private async parseSectionA(): Promise<boolean> {
    const sheet = this.workbook.getWorksheet(SectionA.SHEET_NAME);
    if (!sheet) {
      Logger.info(`parseSectionA: No sheet found for ${SectionA.SHEET_NAME}. Skipping`);
      return false;
    }

    const data = await this.extractValuesFromWorksheet(sheet);
    const newData = new Map();

    data.forEach((values, key) => {
      const colKey = SectionAColumns.find((col) => col.header === key)?.key;
      newData.set(
        colKey,
        values.map((value) => toString(value).trim())
      );
    });

    const newMapping = SectionA.mapValues(newData, {
      institutionSheet: this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.institutions),
    });

    const result = parseSchemaObject(SectionASchema, newMapping);

    this.data = merge({}, this.data, result.data);
    this.data.sections.find((s) => s.name === "A").status = determineSectionStatus(
      result.passed,
      sectionHasData(SectionA.SHEET_ID, result.data)
    );
    this.validationIssues.push(...(result.issues || []));

    return true;
  }

  /**
   * Parses the data from Section B of the Excel workbook.
   *
   * @returns A Promise that resolves to a boolean indicating success or failure of the parsing.
   */
  private async parseSectionB(): Promise<boolean> {
    const ws = this.workbook.getWorksheet(SectionB.SHEET_NAME);
    if (!ws) {
      Logger.info("parseSectionB: No sheet found for Section B. Skipping");
      return false;
    }

    const data = await this.extractValuesFromWorksheet(ws);
    const newData = new Map();
    // Swap the column headers for the column keys in the mapping
    data.forEach((values, key) => {
      const colKey = SectionBColumns.find((col) => col.header === key)?.key;
      newData.set(
        colKey,
        values.map((value) => toString(value).trim())
      );
    });
    const newMapping = SectionB.mapValues(newData, {
      programSheet: this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.programs),
    });

    const result = parseSchemaObject(SectionBSchema, newMapping);

    this.data = merge({}, this.data, result.data);
    this.data.sections.find((s) => s.name === "B").status = determineSectionStatus(
      result.passed,
      sectionHasData(SectionB.SHEET_ID, result.data)
    );
    this.validationIssues.push(...(result.issues || []));

    return true;
  }

  /**
   * Parses the data from Section C of the Excel workbook.
   *
   * @returns A Promise that resolves to a boolean indicating success or failure of the parsing.
   */
  private async parseSectionC(): Promise<boolean> {
    const sheet = this.workbook.getWorksheet(SectionC.SHEET_NAME);
    if (!sheet) {
      Logger.info(`parseSectionC: No sheet found for ${SectionC.SHEET_NAME}. Skipping`);
      return false;
    }

    const data = await this.extractValuesFromWorksheet(sheet);
    const newData = new Map();

    data.forEach((values, key) => {
      const colKey = SectionCColumns.find((col) => col.header === key)?.key;
      newData.set(
        colKey,
        values.map((value) => toString(value).trim())
      );
    });

    const newMapping = SectionC.mapValues(newData, {
      cancerTypesSheet: this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.cancerTypes),
      speciesSheet: this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.speciesOptions),
    });

    const result = parseSchemaObject(SectionCSchema, newMapping);

    this.data = merge({}, this.data, result.data);
    this.data.sections.find((s) => s.name === "C").status = determineSectionStatus(
      result.passed,
      sectionHasData(SectionC.SHEET_ID, result.data)
    );
    this.validationIssues.push(...(result.issues || []));

    return true;
  }

  private async parseSectionD(): Promise<boolean> {
    const ws = this.workbook.getWorksheet(SectionD.SHEET_NAME);
    if (!ws) {
      Logger.info("parseSectionD: No sheet found for Section D. Skipping");
      return false;
    }

    const data = await this.extractValuesFromWorksheet(ws);
    const newData = new Map();

    data.forEach((values, key) => {
      const colKey = SectionDColumns.find((col) => col.header === key)?.key;
      newData.set(
        colKey,
        values.map((value) => toString(value).trim())
      );
    });

    const newMapping = SectionD.mapValues(newData, {
      programSheet: this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.programs),
      fileTypesSheet: this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.fileTypes),
    });

    const result = parseSchemaObject(SectionDSchema, newMapping);

    this.data = merge({}, this.data, result.data);
    this.data.sections.find((s) => s.name === "D").status = determineSectionStatus(
      result.passed,
      sectionHasData(SectionD.SHEET_ID, result.data)
    );
    this.validationIssues.push(...(result.issues || []));

    return true;
  }

  /**
   * Adds a hidden sheet which contains the full list of API provided institutions at function call.
   *
   * Columns:
   * - `A` - Institution ID
   * - `B` - Institution Name
   *
   * @returns An immutable internal reference to the sheet.
   */
  private async createInstitutionSheet(): Promise<Readonly<ExcelJS.Worksheet>> {
    let sheet = this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.institutions);
    if (!sheet) {
      sheet = this.workbook.addWorksheet(HIDDEN_SHEET_NAMES.institutions, { state: "veryHidden" });

      const institutions = await this.getAPIInstitutions();
      institutions?.forEach((institution, index) => {
        sheet.getCell(`A${index + 1}`).value = institution._id;
        sheet.getCell(`B${index + 1}`).value = institution.name;
      });
    }

    return sheet;
  }

  /**
   * Adds a hidden sheet which contains the full list of API provided programs at function call.
   *
   * Columns:
   * - `A` - Program ID
   * - `B` - Program Name
   *
   * @returns The created worksheet.
   */
  private async createProgramsSheet(): Promise<Readonly<ExcelJS.Worksheet>> {
    let sheet = this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.programs);
    if (!sheet) {
      sheet = this.workbook.addWorksheet(HIDDEN_SHEET_NAMES.programs, { state: "veryHidden" });

      const programs = await this.getAPIPrograms();
      const fullPrograms: ProgramInput[] = [NotApplicableProgram, ...programs, OtherProgram];

      fullPrograms.forEach((program, index) => {
        const row = index + 1;

        sheet.getCell(`A${row}`).value = program._id || "";
        sheet.getCell(`B${row}`).value = program.name || "";
        sheet.getCell(`C${row}`).value = program.abbreviation || "";
        sheet.getCell(`D${row}`).value = program.description || "";

        // Set the formula for the Program name to default to Program ID if empty
        sheet.getCell(`E${row}`).value = {
          formula: `IF(LEN(TRIM(B${row}))>0,B${row},A${row})`,
        };
      });
    }

    return sheet;
  }

  /**
   * Creates a hidden sheet containing the file types.
   *
   * @returns The created worksheet.
   */
  private async createFileTypesSheet(): Promise<Readonly<ExcelJS.Worksheet>> {
    let sheet = this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.fileTypes);
    if (!sheet) {
      sheet = this.workbook.addWorksheet(HIDDEN_SHEET_NAMES.fileTypes, { state: "veryHidden" });

      Object.keys(fileTypeExtensions)?.forEach((file, index) => {
        sheet.getCell(`A${index + 1}`).value = file;
      });

      const allExtensions = union(...Object.values(fileTypeExtensions));
      allExtensions?.forEach((extension, index) => {
        sheet.getCell(`B${index + 1}`).value = extension;
      });
    }

    return sheet;
  }

  /**
   * Creates a hidden sheet containing the funding agency options.
   *
   * @returns The created worksheet.
   */
  private async createFundingAgencySheet(): Promise<Readonly<ExcelJS.Worksheet>> {
    let sheet = this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.fundingAgencies);
    if (!sheet) {
      sheet = this.workbook.addWorksheet(HIDDEN_SHEET_NAMES.fundingAgencies, {
        state: "veryHidden",
      });

      fundingOptions?.forEach((agency, index) => {
        sheet.getCell(`A${index + 1}`).value = agency;
      });
    }

    return sheet;
  }

  /**
   * Creates a sheet with the full list of Cancer Types
   *
   * @returns A readonly reference to the worksheet.
   */
  private async createCancerTypesSheet(): Promise<Readonly<ExcelJS.Worksheet>> {
    let sheet = this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.cancerTypes);
    if (!sheet) {
      sheet = this.workbook.addWorksheet(HIDDEN_SHEET_NAMES.cancerTypes, { state: "veryHidden" });

      cancerTypeOptions.forEach((file, index) => {
        sheet.getCell(`A${index + 1}`).value = file;
      });
    }

    return sheet;
  }

  /**
   * Creates a hidden sheet containing the species options.
   *
   * @returns A readonly reference to the worksheet.
   */
  private async createSpeciesListSheet(): Promise<Readonly<ExcelJS.Worksheet>> {
    let sheet = this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.speciesOptions);
    if (!sheet) {
      sheet = this.workbook.addWorksheet(HIDDEN_SHEET_NAMES.speciesOptions, {
        state: "veryHidden",
      });

      speciesOptions.forEach((file, index) => {
        sheet.getCell(`A${index + 1}`).value = file;
      });
    }

    return sheet;
  }

  /**
   * Creates a hidden sheet containing the repository data types.
   *
   * @returns The created worksheet.
   */
  private async createRepositoryDataTypesSheet(): Promise<Readonly<ExcelJS.Worksheet>> {
    let sheet = this.workbook.getWorksheet(HIDDEN_SHEET_NAMES.repositoryDataTypes);
    if (!sheet) {
      sheet = this.workbook.addWorksheet(HIDDEN_SHEET_NAMES.repositoryDataTypes, {
        state: "veryHidden",
      });

      const repositoryDataTypeOptions = [
        DataTypes.clinicalTrial.name,
        DataTypes.genomics.name,
        DataTypes.imaging.name,
        DataTypes.proteomics.name,
      ];
      repositoryDataTypeOptions.forEach((file, index) => {
        sheet.getCell(`A${index + 1}`).value = file;
      });
    }

    return sheet;
  }

  /**
   * An internal utility to retrieve the Institution List from the dependencies
   *
   * @note This is error-safe
   * @returns The array of institutions
   */
  private async getAPIInstitutions(): Promise<Institution[]> {
    try {
      const { data } = (await this.dependencies.getInstitutions?.()) || {};
      return data?.listInstitutions?.institutions || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Retrieves the list of programs from the dependencies.
   *
   * @note This excludes 'readOnly' programs from the program list.
   * @returns The array of programs.
   */
  private async getAPIPrograms(): Promise<Organization[]> {
    try {
      const { data } = (await this.dependencies.getPrograms?.()) || {};
      return (
        (data?.listPrograms?.programs as Organization[])?.filter((program) => !program.readOnly) ||
        []
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Normalizes the cell value for consistent processing.
   *
   * @param value The cell value to normalize.
   * @returns The normalized value.
   */
  private normalizeCellValue(value: ExcelJS.CellValue | undefined): unknown {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (value instanceof Date) {
      return new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).format(value);
    }

    if (isHyperlinkValue(value)) {
      return value.text;
    }
    if (isFormulaValue(value)) {
      return value.result !== undefined ? this.normalizeCellValue(value.result) : null;
    }
    if (isSharedFormulaValue(value)) {
      return value.result !== undefined ? this.normalizeCellValue(value.result) : null;
    }
    if (isRichTextValue(value)) {
      return value.richText.map((seg) => seg.text).join("");
    }

    Logger.error(
      "QuestionnaireExcelMiddleware: Found unknown value while normalizing data:",
      value
    );
    return null;
  }

  /**
   * Extracts the header key from a cell value.
   *
   * @param value The cell value to extract the header key from.
   * @returns The extracted header key or null if not found.
   */
  private headerKey(value: ExcelJS.CellValue | undefined): string | null {
    const normalized = this.normalizeCellValue(value);
    if (normalized === null || normalized === undefined) {
      return null;
    }

    return toString(normalized);
  }

  /**
   * Extracts values from the specified worksheet.
   *
   * @param ws The worksheet to extract values from.
   * @returns A map of header names to their corresponding cell values.
   */
  private async extractValuesFromWorksheet(
    ws: ExcelJS.Worksheet
  ): Promise<Map<string, Array<unknown>>> {
    const data = new Map<string, Array<unknown>>();
    const headerRow = ws.getRow(1);
    const headers = headerRow.values;

    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = this.headerKey(headers[colNumber]);
        if (!header) {
          // Invalid data, ignore
          return;
        }

        const allValues = data.get(header) || [];
        const normalizedValue = this.normalizeCellValue(cell.value);

        allValues[rowNumber - 2] = normalizedValue;

        data.set(header, allValues);
      });
    });

    return data;
  }
}
