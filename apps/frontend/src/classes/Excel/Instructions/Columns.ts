import { ColumnDef } from "../SectionBase";

export type InstructionsKeys = "margin" | "left" | "right";

export const COLUMNS: ColumnDef<InstructionsKeys>[] = [
  {
    key: "margin",
    header: "",
    protection: { locked: true },
  },
  {
    key: "left",
    header: "",
    protection: { locked: true },
  },
  {
    key: "right",
    header: "",
    protection: { locked: true },
  },
];
