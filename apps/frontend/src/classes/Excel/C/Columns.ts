import { CharacterLimitsMap, ColumnDef } from "../SectionBase";

export type CKeys =
  | "accessTypes.openAccess"
  | "accessTypes.controlledAccess"
  | "study.isDbGapRegistered"
  | "study.dbGaPPPHSNumber"
  | "study.GPAName"
  | "cancerTypes"
  // | "otherCancerTypesEnabled"
  | "otherCancerTypes"
  | "preCancerTypes"
  | "species"
  // | "otherSpeciesEnabled"
  | "otherSpeciesOfSubjects"
  | "numberOfParticipants";

export const COLUMNS: ColumnDef<CKeys>[] = [
  {
    header: "Access Types: Open Access",
    key: "accessTypes.openAccess",
    width: 30,
    protection: { locked: true },
  },
  {
    header: "Access Types: Controlled Access",
    key: "accessTypes.controlledAccess",
    width: 30,
    protection: { locked: true },
  },
  {
    header: "Has your study been registered in dbGaP?",
    key: "study.isDbGapRegistered",
    width: 45,
    protection: { locked: true },
  },
  {
    header: "If yes, provide dbGaP PHS number with the version number",
    key: "study.dbGaPPPHSNumber",
    width: 50,
    protection: { locked: true },
  },
  {
    header: "GPA Name",
    key: "study.GPAName",
    width: 30,
    protection: { locked: true },
  },
  {
    header: "Cancer Types",
    key: "cancerTypes",
    width: 30,
    protection: { locked: true },
    annotation:
      "If there is more than one entry, you may use additional rows for the details of each entry.",
  },
  {
    header: "Other cancer type(s)",
    annotation: 'Enter additional Cancer Types, separated by pipes ("|").',
    key: "otherCancerTypes",
    width: 50,
    protection: { locked: true },
  },
  {
    header: "Pre-Cancer types (provide all that apply)",
    annotation: 'Enter additional Pre-Cancer Types, separated by pipes ("|").',
    key: "preCancerTypes",
    width: 50,
    protection: { locked: true },
  },
  {
    header: "Species of subjects",
    key: "species",
    width: 30,
    protection: { locked: true },
    annotation:
      "If there is more than one entry, you may use additional rows for the details of each entry.",
  },
  {
    header: "Other Specie(s) involved",
    key: "otherSpeciesOfSubjects",
    width: 30,
    protection: { locked: true },
  },
  {
    header: "Number of subjects included in the submission",
    key: "numberOfParticipants",
    width: 45,
    protection: { locked: true },
  },
];

export const DEFAULT_CHARACTER_LIMITS: CharacterLimitsMap<CKeys> = {
  "study.dbGaPPPHSNumber": 50,
  otherCancerTypes: 1000,
  preCancerTypes: 500,
  otherSpeciesOfSubjects: 500,
  numberOfParticipants: 10,
};
