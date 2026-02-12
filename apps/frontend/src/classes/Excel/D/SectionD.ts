import type ExcelJS from "exceljs";
import { union, toString, toSafeInteger } from "lodash";

import DataTypes from "@/config/DataTypesConfig";
import { fileTypeExtensions } from "@/config/FileTypeConfig";
import { DATE_NOT_BEFORE_TODAY, FormatDate } from "@/utils";

import { LIST_FORMULA, toYesNo } from "../../../utils/excelUtils";
import { ErrorCatalog } from "../ErrorCatalog";
import { CharacterLimitsMap, SectionBase, SectionCtxBase } from "../SectionBase";

import { COLUMNS, DKeys } from "./Columns";

/**
 * List of options for Yes/No validation.
 */
export const YesNoList = '"Yes,No"';

const DEFAULT_CHARACTER_LIMITS: CharacterLimitsMap<DKeys> = {
  otherDataTypes: 200,
  "clinicalData.otherDataTypes": 200,
  "files.type": 30,
  "files.extension": 10,
  "files.count": 10,
  "files.amount": 50,
  submitterComment: 500,
};

type SectionDDeps = {
  data: QuestionnaireData | null;
  programSheet: ExcelJS.Worksheet;
  fileTypesSheet: ExcelJS.Worksheet;
};

export class SectionD extends SectionBase<DKeys, SectionDDeps> {
  static SHEET_NAME = "Data Types";

  static SHEET_ID: SectionKey = "D";

  constructor(deps: SectionDDeps) {
    super({
      id: SectionD.SHEET_ID,
      sheetName: SectionD.SHEET_NAME,
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

    const row = ws.getRow(startRow);
    this.setRowValues(ws, startRow, {
      targetedSubmissionDate: data?.targetedSubmissionDate || "",
      targetedReleaseDate: data?.targetedReleaseDate || "",
      "dataTypes.clinicalTrial": toYesNo(data?.dataTypes?.includes("clinicalTrial") || false),
      "dataTypes.genomics": toYesNo(data?.dataTypes?.includes("genomics") || false),
      "dataTypes.imaging": toYesNo(data?.dataTypes?.includes("imaging") || false),
      "dataTypes.proteomics": toYesNo(data?.dataTypes?.includes("proteomics") || false),
      imagingDataDeIdentified: toYesNo(data?.imagingDataDeIdentified ?? null),
      otherDataTypes: data?.otherDataTypes || "",
      "clinicalData.dataTypes.demographicData": toYesNo(
        data?.clinicalData?.dataTypes?.includes("demographicData") || false
      ),
      "clinicalData.dataTypes.relapseRecurrenceData": toYesNo(
        data?.clinicalData?.dataTypes?.includes("relapseRecurrenceData") || false
      ),
      "clinicalData.dataTypes.diagnosisData": toYesNo(
        data?.clinicalData?.dataTypes?.includes("diagnosisData") || false
      ),
      "clinicalData.dataTypes.outcomeData": toYesNo(
        data?.clinicalData?.dataTypes?.includes("outcomeData") || false
      ),
      "clinicalData.dataTypes.treatmentData": toYesNo(
        data?.clinicalData?.dataTypes?.includes("treatmentData") || false
      ),
      "clinicalData.dataTypes.biospecimenData": toYesNo(
        data?.clinicalData?.dataTypes?.includes("biospecimenData") || false
      ),
      "clinicalData.otherDataTypes": data?.clinicalData?.otherDataTypes || "",
      "clinicalData.futureDataTypes": toYesNo(data?.clinicalData?.futureDataTypes || false),
      dataDeIdentified: toYesNo(data?.dataDeIdentified ?? null),
      cellLines: toYesNo(data?.cellLines || false),
      modelSystems: toYesNo(data?.modelSystems || false),
      submitterComment: data?.submitterComment || "",
    });
    rows.add(row);

    const files = data?.files || [];
    files.forEach((f, index) => {
      this.setRowValues(ws, index + startRow, {
        "files.type": f.type || "",
        "files.extension": f.extension || "",
        "files.count": f.count || null,
        "files.amount": f.amount || "",
      });
      rows.add(ws.getRow(index + startRow));
    });

    return [...rows];
  }

  protected async applyValidation(_ctx: SectionCtxBase, ws: ExcelJS.Worksheet): Promise<void> {
    const startRow = 2;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, _Q, _R, _S, _T, U, V, W, X] =
      this.getRowCells(ws, startRow);

    // Targeted Submission Date
    A.dataValidation = {
      type: "custom",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("dateMMDDYYYY"),
      formulae: [DATE_NOT_BEFORE_TODAY(A, { allowBlank: false })],
    };
    // Targeted Release Date
    B.dataValidation = {
      type: "custom",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("dateMMDDYYYY"),
      formulae: [DATE_NOT_BEFORE_TODAY(B, { allowBlank: false })],
    };

    // Data Types
    C.dataValidation = {
      type: "list",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };
    D.dataValidation = {
      type: "list",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };
    E.dataValidation = {
      type: "list",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };
    F.dataValidation = {
      type: "list",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };

    ws.addConditionalFormatting({
      ref: "F2:F2",
      rules: [
        {
          type: "expression",
          formulae: ['AND($E2<>"Yes", LEN(TRIM($E2))>0)'],
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
    ws.addConditionalFormatting({
      ref: "I2:P2",
      rules: [
        {
          type: "expression",
          formulae: ['AND($C2<>"Yes", LEN(TRIM($C2))>0)'],
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

    // Imaging Data De-identified
    G.dataValidation = {
      type: "list",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };

    // Other Data Type(s)
    H.dataValidation = {
      type: "textLength",
      operator: "lessThanOrEqual",
      allowBlank: true,
      showErrorMessage: true,
      error: ErrorCatalog.get("max", { max: this.CHARACTER_LIMITS.otherDataTypes }),
      formulae: [this.CHARACTER_LIMITS.otherDataTypes],
    };

    // Clinical Data Types
    I.dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };
    J.dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };
    K.dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };
    L.dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };
    M.dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };
    N.dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };
    O.dataValidation = {
      type: "textLength",
      operator: "lessThanOrEqual",
      allowBlank: true,
      showErrorMessage: true,
      error: ErrorCatalog.get("max", { max: 200 }),
      formulae: [this.CHARACTER_LIMITS["clinicalData.otherDataTypes"]],
    };
    P.dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };

    // Files
    const { fileTypesSheet } = this.deps || {};
    this.forEachCellInColumn(ws, "files.type", (cell) => {
      cell.dataValidation = {
        type: "list",
        allowBlank: false,
        showErrorMessage: false,
        formulae: [
          LIST_FORMULA(fileTypesSheet.name, "A", 1, Object.keys(fileTypeExtensions).length || 1),
        ],
      };
    });
    const allExtensions = union(...Object.values(fileTypeExtensions));
    this.forEachCellInColumn(ws, "files.extension", (cell) => {
      cell.dataValidation = {
        type: "list",
        allowBlank: false,
        showErrorMessage: false,
        formulae: [LIST_FORMULA(fileTypesSheet.name, "B", 1, allExtensions.length || 1)],
      };
    });
    this.forEachCellInColumn(ws, "files.count", (cell) => {
      cell.dataValidation = {
        type: "whole",
        operator: "greaterThan",
        allowBlank: false,
        showErrorMessage: true,
        error: ErrorCatalog.get("min", { min: 0 }),
        formulae: [0],
      };
    });
    this.forEachCellInColumn(ws, "files.amount", (cell) => {
      cell.dataValidation = {
        type: "textLength",
        operator: "lessThanOrEqual",
        allowBlank: false,
        showErrorMessage: true,
        error: ErrorCatalog.get("requiredMax", { max: this.CHARACTER_LIMITS["files.amount"] }),
        formulae: [this.CHARACTER_LIMITS["files.amount"]],
      };
    });

    // Data De-Identified
    U.dataValidation = {
      type: "list",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };

    // Cell Lines
    V.dataValidation = {
      type: "list",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };
    // Model Systems
    W.dataValidation = {
      type: "list",
      allowBlank: false,
      showErrorMessage: true,
      error: ErrorCatalog.get("yesNo"),
      formulae: [YesNoList],
    };

    X.dataValidation = {
      type: "textLength",
      operator: "lessThanOrEqual",
      allowBlank: true,
      showErrorMessage: true,
      error: ErrorCatalog.get("max", { max: this.CHARACTER_LIMITS.submitterComment }),
      formulae: [this.CHARACTER_LIMITS.submitterComment],
    };
  }

  public static mapValues(
    data: Map<DKeys, Array<unknown>>,
    _deps: Partial<SectionDDeps>
  ): RecursivePartial<QuestionnaireData> {
    const yesNoOptions = ["Yes", "No"];

    // Extract data types
    const dataTypes = [];
    if (data.get("dataTypes.clinicalTrial")?.[0] === "Yes") {
      dataTypes.push(DataTypes.clinicalTrial.name);
    }
    if (data.get("dataTypes.genomics")?.[0] === "Yes") {
      dataTypes.push(DataTypes.genomics.name);
    }
    if (data.get("dataTypes.imaging")?.[0] === "Yes") {
      dataTypes.push(DataTypes.imaging.name);
    }
    if (data.get("dataTypes.proteomics")?.[0] === "Yes") {
      dataTypes.push(DataTypes.proteomics.name);
    }

    // Extract imaging data de-identification
    const hasImagingDataType = dataTypes.includes(DataTypes.imaging.name);

    let imagingDataDeIdentified: boolean | null = hasImagingDataType ? false : null;
    const rawImagingDataDeIdentified = toString(data.get("imagingDataDeIdentified")?.[0]);
    if (hasImagingDataType && yesNoOptions.includes(rawImagingDataDeIdentified)) {
      imagingDataDeIdentified = rawImagingDataDeIdentified === "Yes";
    }

    // Extract clinical data types
    const hasClinicalDataType = dataTypes.includes(DataTypes.clinicalTrial.name);

    const clinicalDataTypes = [];
    if (hasClinicalDataType && data.get("clinicalData.dataTypes.demographicData")?.[0] === "Yes") {
      clinicalDataTypes.push(DataTypes.demographicData.name);
    }
    if (
      hasClinicalDataType &&
      data.get("clinicalData.dataTypes.relapseRecurrenceData")?.[0] === "Yes"
    ) {
      clinicalDataTypes.push(DataTypes.relapseRecurrenceData.name);
    }
    if (hasClinicalDataType && data.get("clinicalData.dataTypes.diagnosisData")?.[0] === "Yes") {
      clinicalDataTypes.push(DataTypes.diagnosisData.name);
    }
    if (hasClinicalDataType && data.get("clinicalData.dataTypes.outcomeData")?.[0] === "Yes") {
      clinicalDataTypes.push(DataTypes.outcomeData.name);
    }
    if (hasClinicalDataType && data.get("clinicalData.dataTypes.treatmentData")?.[0] === "Yes") {
      clinicalDataTypes.push(DataTypes.treatmentData.name);
    }
    if (hasClinicalDataType && data.get("clinicalData.dataTypes.biospecimenData")?.[0] === "Yes") {
      clinicalDataTypes.push(DataTypes.biospecimenData.name);
    }

    // Extract future data types
    let futureDataTypes = false;
    const rawFutureDataTypes = toString(data.get("clinicalData.futureDataTypes")?.[0]);
    if (hasClinicalDataType && yesNoOptions.includes(rawFutureDataTypes)) {
      futureDataTypes = rawFutureDataTypes === "Yes";
    }

    // Extract files
    const fileTypes = data.get("files.type") || [];
    const fileExtensions = data.get("files.extension") || [];
    const fileCounts = data.get("files.count") || [];
    const fileAmounts = data.get("files.amount") || [];
    const filesMax = Math.max(
      fileTypes.length,
      fileExtensions.length,
      fileCounts.length,
      fileAmounts.length
    );
    const files: FileInfo[] = [];
    Array.from({ length: filesMax }).forEach((_, i) => {
      const type = toString(fileTypes?.[i]).trim() || "";
      const extension = toString(fileExtensions?.[i]).trim() || "";
      const count = toSafeInteger(fileCounts?.[i]) || null;
      const amount = toString(fileAmounts?.[i]).trim() || "";

      if (type || extension || count || amount) {
        files.push({ type, extension, count, amount });
      }
    });

    const dataDeIdentified = yesNoOptions.includes(toString(data.get("dataDeIdentified")?.[0]))
      ? data.get("dataDeIdentified")?.[0] === "Yes"
      : null;

    return {
      targetedSubmissionDate: FormatDate(
        toString(data.get("targetedSubmissionDate")?.[0]).trim(),
        "MM/DD/YYYY",
        ""
      ),
      targetedReleaseDate: FormatDate(
        toString(data.get("targetedReleaseDate")?.[0]).trim(),
        "MM/DD/YYYY",
        ""
      ),
      dataTypes,
      imagingDataDeIdentified,
      clinicalData: {
        dataTypes: clinicalDataTypes,
        otherDataTypes: hasClinicalDataType
          ? toString(data.get("clinicalData.otherDataTypes")?.[0]).trim()
          : "",
        futureDataTypes,
      },
      otherDataTypes: toString(data.get("otherDataTypes")?.[0]).trim(),
      files,
      dataDeIdentified,
      cellLines: toString(data.get("cellLines")?.[0]) === "Yes",
      modelSystems: toString(data.get("modelSystems")?.[0]) === "Yes",
      submitterComment: toString(data.get("submitterComment")?.[0]).trim(),
    };
  }
}

export { COLUMNS as SectionDColumns };
