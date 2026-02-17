import { ColumnDef } from "../SectionBase";

export type MetaKeys =
  | "submissionId"
  | "applicantName"
  | "applicantId"
  | "lastStatus"
  | "formVersion"
  | "createdAt"
  | "updatedAt"
  | "devTier"
  | "templateVersion"
  | "appVersion"
  | "exportedAt";

export const COLUMNS: ColumnDef<MetaKeys>[] = [
  { header: "Submission ID", key: "submissionId", width: 35, protection: { locked: true } },
  { header: "Applicant", key: "applicantName", width: 30, protection: { locked: true } },
  { header: "Applicant ID", key: "applicantId", width: 35, protection: { locked: true } },
  { header: "Last Status", key: "lastStatus", width: 10, protection: { locked: true } },
  { header: "Form Version", key: "formVersion", width: 15, protection: { locked: true } },
  { header: "Created Date", key: "createdAt", width: 30, protection: { locked: true } },
  { header: "Last Modified", key: "updatedAt", width: 30, protection: { locked: true } },
  { header: "Tier", key: "devTier", width: 10, protection: { locked: true } },
  {
    header: "Template Version",
    key: "templateVersion",
    width: 15,
    protection: { locked: true },
  },
  { header: "App Version", key: "appVersion", width: 15, protection: { locked: true } },
  { header: "Export Date", key: "exportedAt", width: 30, protection: { locked: true } },
];
