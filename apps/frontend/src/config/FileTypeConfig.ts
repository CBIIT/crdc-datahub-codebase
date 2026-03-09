/**
 * Configuration for Questionnaire Section D FileType List
 *
 */
export const fileTypeOptions: string[] = [
  "Raw sequencing data",
  "Derived sequencing data",
  "Clinical data",
  "Protein expression data",
  "Imaging data",
];

export const fileTypeExtensions = {
  "Raw sequencing data": ["BAM", "FASTQ"],
  "Derived sequencing data": ["VCF", "MAF"],
  "Clinical data": ["XML", "JSON", "TSV"],
  "Protein expression data": ["TSV"],
  "Imaging data": ["DICOM", "SVS"],
};
