import type ExcelJS from "exceljs";
import { Row } from "exceljs";
import { toString } from "lodash";

import DataTypes from "@/config/DataTypesConfig";
import {
  IF,
  STR_EQ,
  REQUIRED,
  TEXT_MAX,
  AND,
  LIST_FORMULA,
  DATE_NOT_BEFORE_TODAY,
  FormatDate,
  Logger,
} from "@/utils";

import { ErrorCatalog } from "../ErrorCatalog";
import { CharacterLimitsMap, SectionBase, SectionCtxBase } from "../SectionBase";

import { COLUMNS, BKeys } from "./Columns";

const DEFAULT_CHARACTER_LIMITS: CharacterLimitsMap<BKeys> = {
  "program.name": 100,
  "program.abbreviation": 100,
  "program.description": 500,
  "study.name": 1_000,
  "study.abbreviation": 20,
  "study.description": 2_500,
  // "study.funding.agency": 0,
  "study.funding.grantNumbers": 250,
  "study.funding.nciProgramOfficer": 50,
  "study.publications.title": 500,
  "study.publications.pubmedID": 20,
  "study.publications.DOI": 200,
  "study.plannedPublications.title": 500,
  // "study.plannedPublications.expectedDate": 0,
  "study.repositories.name": 50,
  "study.repositories.studyID": 50,
  // "study.repositories.dataTypesSubmitted": 0,
  "study.repositories.otherDataTypesSubmitted": 100,
};

type SectionBDeps = {
  data: QuestionnaireData | null;
  programSheet: ExcelJS.Worksheet;
  fundingAgenciesSheet: ExcelJS.Worksheet;
  repositoryDataTypesSheet: ExcelJS.Worksheet;
};

export class SectionB extends SectionBase<BKeys, SectionBDeps> {
  static SHEET_NAME = "Program and Study";

  static SHEET_ID: SectionKey = "B";

  constructor(deps: SectionBDeps) {
    super({
      id: SectionB.SHEET_ID,
      sheetName: SectionB.SHEET_NAME,
      columns: COLUMNS,
      headerColor: "D9EAD3",
      characterLimits: DEFAULT_CHARACTER_LIMITS,
      deps,
    });
  }

  protected write(_ctx: SectionCtxBase, ws: ExcelJS.Worksheet): ExcelJS.Row[] {
    const { data } = this.deps;
    if (!data) {
      return null;
    }

    const startRow = 2;
    const rows = new Set<ExcelJS.Row>();

    let foundProgramName = "";
    const rawProgramId = data?.program?._id;
    const foundProgramCell = this.findProgramById(rawProgramId);

    // Use name if available
    if (rawProgramId?.length > 0) {
      foundProgramName = foundProgramCell
        ? `${this.deps?.programSheet?.getCell(`B${foundProgramCell.row}`).value || ""}`
        : "Other";
    }

    // Otherwise use ID
    if (!foundProgramName && rawProgramId?.length > 0 && foundProgramCell) {
      foundProgramName = `${
        this.deps?.programSheet?.getCell(`A${foundProgramCell.row}`).value || ""
      }`;
    }

    const row = ws.getRow(startRow);
    this.setRowValues(ws, startRow, {
      "program._id": foundProgramName,
      "program.name": foundProgramName === "Other" ? data?.program?.name || "" : "",
      "program.abbreviation": foundProgramName === "Other" ? data?.program?.abbreviation || "" : "",
      "program.description": foundProgramName === "Other" ? data?.program?.description || "" : "",
      "study.name": data?.study?.name || "",
      "study.abbreviation": data?.study?.abbreviation || "",
      "study.description": data?.study?.description || "",
    });
    rows.add(row);

    const funding = data?.study?.funding || [];
    funding.forEach((f, index) => {
      this.setRowValues(ws, index + startRow, {
        "study.funding.agency": f.agency || "",
        "study.funding.grantNumbers": f.grantNumbers || "",
        "study.funding.nciProgramOfficer": f.nciProgramOfficer || "",
      });
      rows.add(ws.getRow(index + startRow));
    });

    const publications = data?.study?.publications || [];
    publications.forEach((p, index) => {
      this.setRowValues(ws, index + startRow, {
        "study.publications.title": p.title || "",
        "study.publications.pubmedID": p.pubmedID || "",
        "study.publications.DOI": p.DOI || "",
      });
      rows.add(ws.getRow(index + startRow));
    });

    const plannedPublications = data?.study?.plannedPublications || [];
    plannedPublications.forEach((p, index) => {
      this.setRowValues(ws, index + startRow, {
        "study.plannedPublications.title": p.title || "",
        "study.plannedPublications.expectedDate": p.expectedDate || "",
      });
      rows.add(ws.getRow(index + startRow));
    });

    const repositories = data?.study?.repositories || [];
    repositories.forEach((repo, index) => {
      this.setRowValues(ws, index + startRow, {
        "study.repositories.name": repo.name || "",
        "study.repositories.studyID": repo.studyID || "",
        "study.repositories.dataTypesSubmitted": repo.dataTypesSubmitted?.join(" | "),
        "study.repositories.otherDataTypesSubmitted": repo.otherDataTypesSubmitted || "",
      });
      rows.add(ws.getRow(index + startRow));
    });

    return [...rows];
  }

  protected async applyValidation(_ctx: SectionCtxBase, ws: ExcelJS.Worksheet): Promise<void> {
    const startRow = 2;
    const [A2, B2, C2, D2, E2, F2, G2] = this.getRowCells(ws, startRow);

    ws.addConditionalFormatting({
      ref: "B2:D2",
      rules: [
        {
          type: "expression",
          formulae: ['$A2<>"Other"'],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "000000" },
            },
          },
          priority: 1,
        },
      ],
    });

    // Program
    A2.dataValidation = {
      type: "list",
      allowBlank: false,
      showErrorMessage: true,
      formulae: [
        LIST_FORMULA(this.deps.programSheet.name, "E", 1, this.deps.programSheet.rowCount || 1),
      ],
    };

    // Program Name
    B2.dataValidation = {
      type: "custom",
      allowBlank: true,
      showErrorMessage: true,
      showInputMessage: true,
      error: ErrorCatalog.get("invalidOperation"),
      formulae: [
        IF(
          STR_EQ(A2, "Other"),
          AND(REQUIRED("B2"), TEXT_MAX("B2", this.CHARACTER_LIMITS["program.name"])),
          `LEN(TRIM(${"B2"}))=0`
        ),
      ],
    };

    // Program Abbreviation
    C2.dataValidation = {
      type: "custom",
      allowBlank: true,
      showErrorMessage: true,
      showInputMessage: true,
      error: ErrorCatalog.get("invalidOperation"),
      formulae: [
        IF(
          STR_EQ(A2, "Other"),
          AND(REQUIRED("C2"), TEXT_MAX("C2", this.CHARACTER_LIMITS["program.abbreviation"])),
          `LEN(TRIM(${"C2"}))=0`
        ),
      ],
    };

    // Program Description
    D2.dataValidation = {
      type: "custom",
      allowBlank: true,
      showErrorMessage: true,
      showInputMessage: true,
      error: ErrorCatalog.get("invalidOperation"),
      formulae: [
        IF(
          STR_EQ(A2, "Other"),
          AND(REQUIRED("D2"), TEXT_MAX("D2", this.CHARACTER_LIMITS["program.description"])),
          `LEN(TRIM(${"D2"}))=0`
        ),
      ],
    };

    // Study
    E2.dataValidation = {
      type: "textLength",
      operator: "lessThanOrEqual",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("requiredMax", { max: this.CHARACTER_LIMITS["study.name"] }),
      formulae: [this.CHARACTER_LIMITS["study.name"]],
    };
    F2.dataValidation = {
      type: "textLength",
      operator: "lessThanOrEqual",
      allowBlank: true,
      showErrorMessage: true,
      error: ErrorCatalog.get("max", { max: this.CHARACTER_LIMITS["study.abbreviation"] }),
      formulae: [this.CHARACTER_LIMITS["study.abbreviation"]],
    };

    G2.dataValidation = {
      type: "textLength",
      operator: "lessThanOrEqual",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("requiredMax", { max: this.CHARACTER_LIMITS["study.description"] }),
      formulae: [this.CHARACTER_LIMITS["study.description"]],
    };

    // Funding
    this.forEachCellInColumn(ws, "study.funding.agency", (cell) => {
      cell.dataValidation = {
        type: "list",
        allowBlank: false,
        showErrorMessage: false,
        formulae: [
          LIST_FORMULA(
            this.deps.fundingAgenciesSheet.name,
            "A",
            1,
            this.deps.fundingAgenciesSheet.rowCount || 1
          ),
        ],
      };
    });
    this.forEachCellInColumn(ws, "study.funding.grantNumbers", (cell) => {
      cell.dataValidation = {
        type: "textLength",
        operator: "lessThanOrEqual",
        allowBlank: false,
        showErrorMessage: true,
        error: ErrorCatalog.get("requiredMax", {
          max: this.CHARACTER_LIMITS["study.funding.grantNumbers"],
        }),
        formulae: [this.CHARACTER_LIMITS["study.funding.grantNumbers"]],
      };
    });
    this.forEachCellInColumn(ws, "study.funding.nciProgramOfficer", (cell) => {
      cell.dataValidation = {
        type: "textLength",
        operator: "lessThanOrEqual",
        allowBlank: false,
        showErrorMessage: true,
        error: ErrorCatalog.get("requiredMax", {
          max: this.CHARACTER_LIMITS["study.funding.nciProgramOfficer"],
        }),
        formulae: [this.CHARACTER_LIMITS["study.funding.nciProgramOfficer"]],
      };
    });

    // Publications
    this.forEachCellInColumn(ws, "study.publications.title", (cell) => {
      cell.dataValidation = {
        type: "textLength",
        operator: "lessThanOrEqual",
        allowBlank: false,
        showErrorMessage: true,
        error: ErrorCatalog.get("requiredMax", {
          max: this.CHARACTER_LIMITS["study.publications.title"],
        }),
        formulae: [this.CHARACTER_LIMITS["study.publications.title"]],
      };
    });
    this.forEachCellInColumn(ws, "study.publications.pubmedID", (cell) => {
      cell.dataValidation = {
        type: "textLength",
        operator: "lessThanOrEqual",
        allowBlank: true,
        showErrorMessage: true,
        error: ErrorCatalog.get("max", {
          max: this.CHARACTER_LIMITS["study.publications.pubmedID"],
        }),
        formulae: [this.CHARACTER_LIMITS["study.publications.pubmedID"]],
      };
    });
    this.forEachCellInColumn(ws, "study.publications.DOI", (cell) => {
      cell.dataValidation = {
        type: "textLength",
        operator: "lessThanOrEqual",
        allowBlank: true,
        showErrorMessage: true,
        error: ErrorCatalog.get("max", {
          max: this.CHARACTER_LIMITS["study.publications.DOI"],
        }),
        formulae: [this.CHARACTER_LIMITS["study.publications.DOI"]],
      };
    });

    // Planned Publications
    this.forEachCellInColumn(ws, "study.plannedPublications.title", (cell) => {
      cell.dataValidation = {
        type: "textLength",
        operator: "lessThanOrEqual",
        allowBlank: false,
        showErrorMessage: true,
        error: ErrorCatalog.get("requiredMax", {
          max: this.CHARACTER_LIMITS["study.plannedPublications.title"],
        }),
        formulae: [this.CHARACTER_LIMITS["study.plannedPublications.title"]],
      };
    });
    this.forEachCellInColumn(ws, "study.plannedPublications.expectedDate", (cell) => {
      cell.dataValidation = {
        type: "custom",
        allowBlank: false,
        showErrorMessage: true,
        error: ErrorCatalog.get("dateMMDDYYYY"),
        formulae: [DATE_NOT_BEFORE_TODAY(cell, { allowBlank: false })],
      };
    });

    // Repositories
    this.forEachCellInColumn(ws, "study.repositories.name", (cell) => {
      cell.dataValidation = {
        type: "textLength",
        operator: "lessThanOrEqual",
        allowBlank: false,
        showErrorMessage: true,
        error: ErrorCatalog.get("requiredMax", {
          max: this.CHARACTER_LIMITS["study.repositories.name"],
        }),
        formulae: [this.CHARACTER_LIMITS["study.repositories.name"]],
      };
    });
    this.forEachCellInColumn(ws, "study.repositories.studyID", (cell) => {
      cell.dataValidation = {
        type: "textLength",
        operator: "lessThanOrEqual",
        allowBlank: false,
        showErrorMessage: true,
        error: ErrorCatalog.get("requiredMax", {
          max: this.CHARACTER_LIMITS["study.repositories.studyID"],
        }),
        formulae: [this.CHARACTER_LIMITS["study.repositories.studyID"]],
      };
    });
    this.forEachCellInColumn(ws, "study.repositories.dataTypesSubmitted", (cell) => {
      cell.dataValidation = {
        type: "list",
        allowBlank: false,
        showErrorMessage: false,
        formulae: [
          LIST_FORMULA(
            this.deps.repositoryDataTypesSheet.name,
            "A",
            1,
            this.deps.repositoryDataTypesSheet.rowCount || 1
          ),
        ],
      };
    });
    this.forEachCellInColumn(ws, "study.repositories.otherDataTypesSubmitted", (cell) => {
      cell.dataValidation = {
        type: "textLength",
        operator: "lessThanOrEqual",
        allowBlank: true,
        showErrorMessage: true,
        error: ErrorCatalog.get("max", {
          max: this.CHARACTER_LIMITS["study.repositories.otherDataTypesSubmitted"],
        }),
        formulae: [this.CHARACTER_LIMITS["study.repositories.otherDataTypesSubmitted"]],
      };
    });
  }

  public static mapValues(
    data: Map<BKeys, Array<unknown>>,
    deps: Partial<SectionBDeps>
  ): RecursivePartial<QuestionnaireData> {
    const { programSheet } = deps;
    if (!programSheet || !programSheet.rowCount) {
      Logger.error(`SectionB.ts: The programs sheet is missing or invalid.`);
    }

    const fundingAgencies = data.get("study.funding.agency") || [];
    const fundingGrantNumbers = data.get("study.funding.grantNumbers") || [];
    const fundingNciProgramOfficers = data.get("study.funding.nciProgramOfficer") || [];
    const fundingsMax = Math.max(
      fundingAgencies.length,
      fundingGrantNumbers.length,
      fundingNciProgramOfficers.length
    );
    const funding: Funding[] = [];
    Array.from({ length: fundingsMax }).forEach((_, i) => {
      const agency = toString(fundingAgencies?.[i]).trim();
      const grantNumbers = toString(fundingGrantNumbers?.[i]).trim();
      const nciProgramOfficer = toString(fundingNciProgramOfficers?.[i]).trim();

      if (agency || grantNumbers || nciProgramOfficer) {
        funding.push({ agency, grantNumbers, nciProgramOfficer });
      }
    });

    const publicationTitles = data.get("study.publications.title") || [];
    const publicationPubmedIDs = data.get("study.publications.pubmedID") || [];
    const publicationDois = data.get("study.publications.DOI") || [];
    const publicationsMax = Math.max(
      publicationTitles.length,
      publicationPubmedIDs.length,
      publicationDois.length
    );
    const publications: Publication[] = [];
    Array.from({ length: publicationsMax }).forEach((_, i) => {
      const title = toString(publicationTitles?.[i]).trim();
      const pubmedID = toString(publicationPubmedIDs?.[i]).trim();
      const DOI = toString(publicationDois?.[i]).trim();

      if (title || pubmedID || DOI) {
        publications.push({ title, pubmedID, DOI });
      }
    });

    const plannedPublicationTitles = data.get("study.plannedPublications.title") || [];
    const plannedPublicationExpectedDates =
      data.get("study.plannedPublications.expectedDate") || [];
    const plannedPublicationsMax = Math.max(
      plannedPublicationTitles.length,
      plannedPublicationExpectedDates.length
    );
    const plannedPublications: PlannedPublication[] = [];
    Array.from({ length: plannedPublicationsMax }).forEach((_, i) => {
      const title = toString(plannedPublicationTitles?.[i]).trim();
      const expectedDate = FormatDate(
        toString(plannedPublicationExpectedDates?.[i]).trim(),
        "MM/DD/YYYY",
        ""
      );

      if (title || expectedDate) {
        plannedPublications.push({ title, expectedDate });
      }
    });

    const repositoryNames = data.get("study.repositories.name") || [];
    const repositoryStudyIDs = data.get("study.repositories.studyID") || [];
    const repositoryDataTypesSubmitted = data.get("study.repositories.dataTypesSubmitted") || [];
    const repositoryOtherDataTypesSubmitted =
      data.get("study.repositories.otherDataTypesSubmitted") || [];
    const repositoriesMax = Math.max(
      repositoryNames.length,
      repositoryStudyIDs.length,
      repositoryDataTypesSubmitted.length,
      repositoryOtherDataTypesSubmitted.length
    );
    const repositories: Repository[] = [];
    Array.from({ length: repositoriesMax }).forEach((_, i) => {
      const name = toString(repositoryNames?.[i]).trim();
      const studyID = toString(repositoryStudyIDs?.[i]).trim();
      const dataTypesSubmitted = toString(repositoryDataTypesSubmitted?.[i])
        .split("|")
        .map((item) => item.trim())
        .filter((item) => {
          const dataTypes: string[] = [
            DataTypes.clinicalTrial.name,
            DataTypes.genomics.name,
            DataTypes.imaging.name,
            DataTypes.proteomics.name,
          ];

          return dataTypes.includes(item);
        }) as Repository["dataTypesSubmitted"];
      const otherDataTypesSubmitted = toString(repositoryOtherDataTypesSubmitted?.[i]).trim();

      if (name || studyID || dataTypesSubmitted.length || otherDataTypesSubmitted) {
        repositories.push({ name, studyID, dataTypesSubmitted, otherDataTypesSubmitted });
      }
    });

    // Match program name to get the _id
    let programId = "";
    let programRow: Row | undefined;
    const rawProgramId = toString(data.get("program._id")?.[0]).trim();
    if (rawProgramId === "Not Applicable" || rawProgramId === "Other") {
      programId = rawProgramId;
    } else if (programSheet && rawProgramId?.length > 0) {
      const programColB = programSheet.getColumn(2);
      programColB.eachCell((cell, rowNumber) => {
        const name = toString(cell.value).trim();
        if (name === toString(data.get("program._id")?.[0])) {
          programId = toString(programSheet.getCell(`A${rowNumber}`).value).trim();
          programRow = programSheet.getRow(rowNumber);
        }
      });
    }

    const questionnaireData: RecursivePartial<QuestionnaireData> = {
      program: {
        _id: programId,
        name: programRow
          ? toString(programRow.getCell(2).value).trim()
          : toString(data.get("program.name")?.[0]).trim(),
        abbreviation: programRow
          ? toString(programRow.getCell(3).value).trim()
          : toString(data.get("program.abbreviation")?.[0]).trim(),
        description: programRow
          ? toString(programRow.getCell(4).value).trim()
          : toString(data.get("program.description")?.[0]).trim(),
      },
      study: {
        name: toString(data.get("study.name")?.[0]).trim(),
        abbreviation: toString(data.get("study.abbreviation")?.[0]).trim(),
        description: toString(data.get("study.description")?.[0]).trim(),
        funding,
        publications,
        plannedPublications,
        repositories,
      },
    };

    return questionnaireData;
  }

  /**
   * Finds a program by its ID.
   * @param id The ID of the program to find.
   * @returns The ExcelJS cell containing the program ID, or null if not found.
   */
  private findProgramById(id: string): ExcelJS.Cell | null {
    if (!id?.trim()?.length) {
      return null;
    }

    const colA = this.deps?.programSheet?.getColumn(1);
    if (!colA) {
      return null;
    }

    let cell: ExcelJS.Cell | undefined;
    colA.eachCell((c) => {
      if (!cell && c.value === id) {
        cell = c;
      }
    });

    return cell || null;
  }
}

export { COLUMNS as SectionBColumns };
