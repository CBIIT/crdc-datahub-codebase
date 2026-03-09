/**
 * Configuration for Questionnaire Section D Data Types
 *
 */
const DataTypes = {
  clinicalTrial: {
    name: "clinicalTrial",
    label: "Clinical",
  },
  genomics: {
    name: "genomics",
    label: "Genomics",
  },
  proteomics: {
    name: "proteomics",
    label: "Proteomics",
  },
  imaging: {
    name: "imaging",
    label: "Imaging",
  },
  demographicData: {
    name: "demographicData",
    label: "Demographic Data",
  },
  relapseRecurrenceData: {
    name: "relapseRecurrenceData",
    label: "Relapse/Recurrence Data",
  },
  diagnosisData: {
    name: "diagnosisData",
    label: "Diagnosis Data",
  },
  outcomeData: {
    name: "outcomeData",
    label: "Outcome Data",
  },
  treatmentData: {
    name: "treatmentData",
    label: "Treatment Data",
  },
  biospecimenData: {
    name: "biospecimenData",
    label: "Biospecimen Data",
  },
} as const;

export default DataTypes;
