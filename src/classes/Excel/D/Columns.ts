import { ColumnDef } from "../SectionBase";

export type DKeys =
  | "targetedSubmissionDate"
  | "targetedReleaseDate"
  | "dataTypes.clinicalTrial"
  | "dataTypes.genomics"
  | "dataTypes.imaging"
  | "dataTypes.proteomics"
  | "imagingDataDeIdentified"
  | "otherDataTypes"
  | "clinicalData.dataTypes.demographicData"
  | "clinicalData.dataTypes.relapseRecurrenceData"
  | "clinicalData.dataTypes.diagnosisData"
  | "clinicalData.dataTypes.outcomeData"
  | "clinicalData.dataTypes.treatmentData"
  | "clinicalData.dataTypes.biospecimenData"
  | "clinicalData.otherDataTypes"
  | "clinicalData.futureDataTypes"
  | "files.type"
  | "files.extension"
  | "files.count"
  | "files.amount"
  | "dataDeIdentified"
  | "cellLines"
  | "modelSystems"
  | "submitterComment";

const protection = { locked: true };

export const COLUMNS: ColumnDef<DKeys>[] = [
  {
    header: "Targeted Data Submission Delivery Date",
    key: "targetedSubmissionDate",
    width: 40,
    protection,
  },
  {
    header: "Expected Publication Date",
    key: "targetedReleaseDate",
    width: 30,
    protection,
  },
  {
    header: "Clinical",
    key: "dataTypes.clinicalTrial",
    width: 15,
    protection,
  },
  {
    header: "Genomics",
    key: "dataTypes.genomics",
    width: 15,
    protection,
  },
  {
    header: "Imaging",
    key: "dataTypes.imaging",
    width: 15,
    protection,
  },
  {
    header: "Confirm the imaging data you plan to submit are de-identified",
    key: "imagingDataDeIdentified",
    width: 50,
    protection,
  },
  {
    header: "Proteomics",
    key: "dataTypes.proteomics",
    width: 15,
    protection,
  },
  {
    header: "Other Data Type(s)",
    annotation:
      'Data that do not fit in any of the other categories. Enter additional Data Types, separated by pipes ("|").',
    key: "otherDataTypes",
    width: 50,
    protection,
  },
  {
    header: "Demographic Data",
    key: "clinicalData.dataTypes.demographicData",
    width: 20,
    protection,
  },
  {
    header: "Relapse/Recurrence Data",
    key: "clinicalData.dataTypes.relapseRecurrenceData",
    width: 20,
    protection,
  },
  {
    header: "Diagnosis Data",
    key: "clinicalData.dataTypes.diagnosisData",
    width: 15,
    protection,
  },
  {
    header: "Outcome Data",
    key: "clinicalData.dataTypes.outcomeData",
    width: 15,
    protection,
  },
  {
    header: "Treatment Data",
    key: "clinicalData.dataTypes.treatmentData",
    width: 15,
    protection,
  },
  {
    header: "Biospecimen Data",
    key: "clinicalData.dataTypes.biospecimenData",
    width: 15,
    protection,
  },
  {
    header: "Other Clinical Data Types",
    annotation:
      'If there are any additional types of data included with the study not already specified above, describe here. Enter additional Clinical Data Types, separated by pipes ("|").',
    key: "clinicalData.otherDataTypes",
    width: 50,
    protection,
  },
  {
    header: "Additional Data Types with a future submission?",
    key: "clinicalData.futureDataTypes",
    width: 40,
    protection,
  },
  {
    header: "File Type",
    key: "files.type",
    width: 30,
    annotation:
      "If there is more than one entry, you may use additional rows for the details of each entry.",
    protection,
  },
  {
    header: "File Extension",
    key: "files.extension",
    width: 15,
    protection,
  },
  {
    header: "Number of files",
    key: "files.count",
    width: 15,
    protection,
  },
  {
    header: "Estimated data size",
    key: "files.amount",
    width: 20,
    protection,
  },
  {
    header: "Confirm the data you plan to submit are de-identified",
    key: "dataDeIdentified",
    width: 50,
    protection,
  },
  {
    header: "Cell lines",
    key: "cellLines",
    width: 10,
    protection,
  },
  {
    header: "Model systems",
    key: "modelSystems",
    width: 15,
    protection,
  },
  {
    header: "Additional Comments or Information about this submission.",
    key: "submitterComment",
    width: 80,
    protection,
  },
];
