import type ExcelJS from "exceljs";
import { toString } from "lodash";

import {
  AND,
  EMAIL,
  IF,
  LIST_FORMULA,
  Logger,
  ORCID,
  PHONE,
  REQUIRED,
  STR_EQ,
  TEXT_MAX,
} from "@/utils";

import { YesNoList } from "../D/SectionD";
import { ErrorCatalog } from "../ErrorCatalog";
import { SectionBase, SectionCtxBase } from "../SectionBase";

import { AKeys, COLUMNS, DEFAULT_CHARACTER_LIMITS } from "./Columns";

type SectionADeps = {
  data: QuestionnaireData | null;
  institutionSheet: ExcelJS.Worksheet;
};

export class SectionA extends SectionBase<AKeys, SectionADeps> {
  static SHEET_NAME = "PI and Contact";

  static SHEET_ID: SectionKey = "A";

  constructor(deps: SectionADeps) {
    super({
      id: SectionA.SHEET_ID,
      sheetName: SectionA.SHEET_NAME,
      columns: COLUMNS,
      headerColor: "D9EAD3",
      characterLimits: DEFAULT_CHARACTER_LIMITS,
      deps,
    });
  }

  protected write(ctx: SectionCtxBase, ws: ExcelJS.Worksheet): ExcelJS.Row[] {
    const { data } = this.deps;
    if (!data) {
      return null;
    }

    const startRow = 2;
    const rows = new Set<ExcelJS.Row>();

    const row = ws.getRow(startRow);
    this.setRowValues(ws, startRow, {
      "pi.firstName": data?.pi?.firstName || "",
      "pi.lastName": data?.pi?.lastName || "",
      "pi.position": data?.pi?.position || "",
      "pi.email": data?.pi?.email || "",
      "pi.ORCID": data?.pi?.ORCID || "",
      "pi.institution": data?.pi?.institution || "",
      "pi.address": data?.pi?.address || "",
      piAsPrimaryContact: data?.piAsPrimaryContact ? "Yes" : "No",
      "primaryContact.firstName": data?.primaryContact?.firstName || "",
      "primaryContact.lastName": data?.primaryContact?.lastName || "",
      "primaryContact.position": data?.primaryContact?.position || "",
      "primaryContact.email": data?.primaryContact?.email || "",
      "primaryContact.institution": data?.primaryContact?.institution || "",
      "primaryContact.phone": data?.primaryContact?.phone || "",
    });
    rows.add(row);

    data?.additionalContacts?.forEach((contact, idx) => {
      this.setRowValues(ws, idx + startRow, {
        "additionalContacts.firstName": contact.firstName || "",
        "additionalContacts.lastName": contact.lastName || "",
        "additionalContacts.position": contact.position || "",
        "additionalContacts.email": contact.email || "",
        "additionalContacts.institution": contact.institution || "",
        "additionalContacts.phone": contact.phone || "",
      });
      rows.add(ws.getRow(idx + startRow));
    });

    return [...rows];
  }

  protected async applyValidation(ctx: SectionCtxBase, ws: ExcelJS.Worksheet): Promise<void> {
    const [A2, B2, C2, D2, E2, F2, G2, H2, I2, J2, K2, L2, M2, N2] = this.getRowCells(ws);

    ws.addConditionalFormatting({
      ref: "I2:N2",
      rules: [
        {
          type: "expression",
          formulae: ['IF($H$2="Yes",TRUE,FALSE)'],
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

    this.applyTextLengthValidation(A2, DEFAULT_CHARACTER_LIMITS["pi.firstName"]);
    this.applyTextLengthValidation(B2, DEFAULT_CHARACTER_LIMITS["pi.lastName"]);
    this.applyTextLengthValidation(C2, DEFAULT_CHARACTER_LIMITS["pi.position"]);
    this.applyTextLengthValidation(G2, DEFAULT_CHARACTER_LIMITS["pi.address"]);

    D2.dataValidation = {
      type: "custom",
      showErrorMessage: true,
      error: ErrorCatalog.get("email"),
      allowBlank: true,
      formulae: [EMAIL(D2)],
    };
    E2.dataValidation = {
      type: "custom",
      showErrorMessage: true,
      error: ErrorCatalog.get("orcid"),
      allowBlank: true,
      formulae: [ORCID(E2)],
    };
    F2.dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: false,
      formulae: [
        LIST_FORMULA(
          this.deps.institutionSheet.name,
          "B",
          1,
          this.deps.institutionSheet.rowCount || 0
        ),
      ],
    };
    H2.dataValidation = {
      type: "list",
      allowBlank: false,
      showErrorMessage: false,
      formulae: [YesNoList],
    };

    // Primary Contact
    [I2, J2, K2].forEach((cell) => {
      const columnKey = ws.getColumn(cell.col).key;
      const cellLimit = DEFAULT_CHARACTER_LIMITS[columnKey as AKeys] ?? 0;

      cell.dataValidation = {
        type: "custom",
        allowBlank: true,
        showErrorMessage: true,
        error: ErrorCatalog.get("max", { max: cellLimit }),
        formulae: [IF(STR_EQ(H2, "Yes"), "TRUE", AND(REQUIRED(cell), TEXT_MAX(cell, cellLimit)))],
      };
    });
    M2.dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: false,
      formulae: [
        LIST_FORMULA(
          this.deps.institutionSheet.name,
          "B",
          1,
          this.deps.institutionSheet.rowCount || 0
        ),
      ],
    };
    N2.dataValidation = {
      type: "custom",
      allowBlank: true,
      error: ErrorCatalog.get("phone"),
      showErrorMessage: true,
      formulae: [PHONE(N2)],
    };
    L2.dataValidation = {
      type: "custom",
      showErrorMessage: true,
      error: ErrorCatalog.get("email"),
      allowBlank: true,
      formulae: [EMAIL(L2)],
    };

    // Additional Contacts
    this.forEachCellInColumn(ws, "additionalContacts.firstName", (cell) => {
      this.applyTextLengthValidation(
        cell,
        DEFAULT_CHARACTER_LIMITS["additionalContacts.firstName"]
      );
    });
    this.forEachCellInColumn(ws, "additionalContacts.lastName", (cell) => {
      this.applyTextLengthValidation(cell, DEFAULT_CHARACTER_LIMITS["additionalContacts.lastName"]);
    });
    this.forEachCellInColumn(ws, "additionalContacts.position", (cell) => {
      this.applyTextLengthValidation(cell, DEFAULT_CHARACTER_LIMITS["additionalContacts.position"]);
    });
    this.forEachCellInColumn(ws, "additionalContacts.email", (cell) => {
      cell.dataValidation = {
        type: "custom",
        allowBlank: true,
        showErrorMessage: true,
        error: ErrorCatalog.get("email"),
        formulae: [EMAIL(cell)],
      };
    });
    this.forEachCellInColumn(ws, "additionalContacts.institution", (cell) => {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        showErrorMessage: false,
        formulae: [
          LIST_FORMULA(
            this.deps.institutionSheet.name,
            "B",
            1,
            this.deps.institutionSheet.rowCount || 0
          ),
        ],
      };
    });
    this.forEachCellInColumn(ws, "additionalContacts.phone", (cell) => {
      cell.dataValidation = {
        type: "custom",
        allowBlank: true,
        error: ErrorCatalog.get("phone"),
        showErrorMessage: true,
        formulae: [PHONE(cell)],
      };
    });
  }

  public static mapValues(
    data: Map<AKeys, Array<unknown>>,
    deps: Partial<SectionADeps>
  ): RecursivePartial<QuestionnaireData> {
    const { institutionSheet } = deps;
    const institutionMap = new Map<string, string>();
    if (!institutionSheet || !institutionSheet?.rowCount) {
      Logger.error(`SectionA.ts: The institution sheet is missing or invalid.`);
    } else {
      institutionSheet.eachRow((row) => {
        const institutionID = row.getCell("A").value.toString();
        const institutionName = row.getCell("B").value.toString();
        institutionMap.set(institutionName?.trim(), institutionID);
      });
    }

    const piInstitution = (data.get("pi.institution")?.[0] as string)?.trim();
    const pi: PI = {
      firstName: data.get("pi.firstName")?.[0] as string,
      lastName: data.get("pi.lastName")?.[0] as string,
      position: data.get("pi.position")?.[0] as string,
      email: data.get("pi.email")?.[0] as string,
      ORCID: data.get("pi.ORCID")?.[0] as string,
      institution: piInstitution,
      institutionID: institutionMap.get(piInstitution) || "",
      address: data.get("pi.address")?.[0] as string,
    };

    const piAsPrimaryContact = data.get("piAsPrimaryContact")?.[0] === "Yes";
    const pcInstitution = (data.get("primaryContact.institution")?.[0] as string)?.trim();
    const primaryContact: Contact = {
      firstName: data.get("primaryContact.firstName")?.[0] as string,
      lastName: data.get("primaryContact.lastName")?.[0] as string,
      position: data.get("primaryContact.position")?.[0] as string,
      email: data.get("primaryContact.email")?.[0] as string,
      institution: pcInstitution,
      institutionID: institutionMap.get(pcInstitution) || "",
      phone: toString(data.get("primaryContact.phone")?.[0])
        .trim()
        .slice(0, DEFAULT_CHARACTER_LIMITS["primaryContact.phone"]),
    };

    const additionalContactFirstNames = data.get("additionalContacts.firstName") || [];
    const additionalContactLastNames = data.get("additionalContacts.lastName") || [];
    const additionalContactPositions = data.get("additionalContacts.position") || [];
    const additionalContactEmails = data.get("additionalContacts.email") || [];
    const additionalContactInstitutions = data.get("additionalContacts.institution") || [];
    const additionalContactPhones = data.get("additionalContacts.phone") || [];
    const additionalContactsMax = Math.max(
      additionalContactFirstNames.length,
      additionalContactLastNames.length,
      additionalContactPositions.length,
      additionalContactEmails.length,
      additionalContactInstitutions.length,
      additionalContactPhones.length
    );
    const additionalContacts: Contact[] = [];
    Array.from({ length: additionalContactsMax }).forEach((_, i) => {
      const firstName = toString(additionalContactFirstNames?.[i]).trim() || "";
      const lastName = toString(additionalContactLastNames?.[i]).trim() || "";
      const position = toString(additionalContactPositions?.[i]).trim() || "";
      const email = toString(additionalContactEmails?.[i]).trim() || "";
      const institution = toString(additionalContactInstitutions?.[i]).trim() || "";
      const institutionID = institutionMap.get(institution) || "";
      const phone = toString(additionalContactPhones?.[i])
        .trim()
        .slice(0, DEFAULT_CHARACTER_LIMITS["additionalContacts.phone"]);

      if (firstName || lastName || position || email || institution || phone) {
        additionalContacts.push({
          firstName,
          lastName,
          position,
          email,
          institution,
          institutionID,
          phone,
        });
      }
    });

    return {
      pi,
      piAsPrimaryContact,
      primaryContact: piAsPrimaryContact ? null : primaryContact,
      additionalContacts,
    };
  }
}

export { COLUMNS as SectionAColumns };
