import { CharacterLimitsMap, ColumnDef } from "../SectionBase";

export type AKeys =
  | "pi.firstName"
  | "pi.lastName"
  | "pi.position"
  | "pi.email"
  | "pi.ORCID"
  | "pi.institution"
  | "pi.address"
  // | "pi.institutionID"
  | "piAsPrimaryContact"
  | "primaryContact.firstName"
  | "primaryContact.lastName"
  | "primaryContact.position"
  | "primaryContact.email"
  | "primaryContact.institution"
  // | "primaryContact.institutionID"
  | "primaryContact.phone"
  | "additionalContacts.firstName"
  | "additionalContacts.lastName"
  | "additionalContacts.position"
  | "additionalContacts.email"
  | "additionalContacts.institution"
  // | "additionalContacts.institutionID"
  | "additionalContacts.phone";

export const COLUMNS: ColumnDef<AKeys>[] = [
  // Principal Investigator
  {
    header: "Principal Investigator First name",
    key: "pi.firstName",
    width: 28,
    protection: { locked: true },
  },
  {
    header: "Principal Investigator Last name",
    key: "pi.lastName",
    width: 28,
    protection: { locked: true },
  },
  {
    header: "Principal Investigator Position",
    key: "pi.position",
    width: 25,
    protection: { locked: true },
  },
  {
    header: "Principal Investigator Email",
    key: "pi.email",
    width: 30,
    protection: { locked: true },
  },
  {
    header: "Principal Investigator ORCID",
    key: "pi.ORCID",
    width: 30,
    protection: { locked: true },
  },
  {
    header: "Principal Investigator Institution",
    key: "pi.institution",
    width: 30,
    protection: { locked: true },
  },
  {
    header: "Principal Investigator Institution Address",
    key: "pi.address",
    width: 35,
    protection: { locked: true },
  },
  // Primary Contact
  {
    header: "Primary Contact Same as Principal Investigator",
    key: "piAsPrimaryContact",
    width: 40,
    protection: { locked: true },
  },
  {
    header: "Primary Contact First name",
    key: "primaryContact.firstName",
    width: 25,
    protection: { locked: true },
  },
  {
    header: "Primary Contact Last name",
    key: "primaryContact.lastName",
    width: 25,
    protection: { locked: true },
  },
  {
    header: "Primary Contact Position",
    key: "primaryContact.position",
    width: 23,
    protection: { locked: true },
  },
  {
    header: "Primary Contact Email",
    key: "primaryContact.email",
    width: 30,
    protection: { locked: true },
  },
  {
    header: "Primary Contact Institution",
    key: "primaryContact.institution",
    width: 30,
    protection: { locked: true },
  },
  {
    header: "Primary Contact Phone number",
    key: "primaryContact.phone",
    width: 30,
    protection: { locked: true },
  },
  // Additional Contact(s)
  {
    header: "Additional Contact(s) First name",
    key: "additionalContacts.firstName",
    width: 25,
    protection: { locked: true },
    annotation:
      "If there is more than one entry, you may use additional rows for the details of each entry.",
  },
  {
    header: "Additional Contact(s) Last name",
    key: "additionalContacts.lastName",
    width: 25,
    protection: { locked: true },
  },
  {
    header: "Additional Contact(s) Position",
    key: "additionalContacts.position",
    width: 25,
    protection: { locked: true },
  },
  {
    header: "Additional Contact(s) Email",
    key: "additionalContacts.email",
    width: 30,
    protection: { locked: true },
  },
  {
    header: "Additional Contact(s) Institution",
    key: "additionalContacts.institution",
    width: 30,
    protection: { locked: true },
  },
  {
    header: "Additional Contact(s) Phone number",
    key: "additionalContacts.phone",
    width: 30,
    protection: { locked: true },
  },
];

export const DEFAULT_CHARACTER_LIMITS: CharacterLimitsMap<AKeys> = {
  "pi.firstName": 50,
  "pi.lastName": 50,
  "pi.position": 100,
  // "pi.email": 0,
  // "pi.ORCID": 0,
  "pi.institution": 100,
  "pi.address": 200,
  "primaryContact.firstName": 50,
  "primaryContact.lastName": 50,
  "primaryContact.position": 100,
  // "primaryContact.email": 0,
  "primaryContact.institution": 100,
  "primaryContact.phone": 25,
  "additionalContacts.firstName": 50,
  "additionalContacts.lastName": 50,
  "additionalContacts.position": 100,
  // "additionalContacts.email": 0,
  "additionalContacts.institution": 100,
  "additionalContacts.phone": 25,
};
