import dayjs from "dayjs";
import * as z from "zod";

import { repositoryDataTypesOptions } from "@/components/Questionnaire/Repository";
import accessTypeOptions from "@/config/AccessTypesConfig";
import cancerTypeOptions from "@/config/CancerTypesConfig";
import DataTypes from "@/config/DataTypesConfig";
import { validatePHSNumber } from "@/utils";

const FIELD_IS_REQUIRED = "This field is required.";

/**
 * Schema for a section in the application questionnaire.
 */
export const sectionSchema = z
  .object({
    /**
     * Name of the section within the form.
     */
    name: z.enum(["A", "B", "C", "D", "REVIEW"]),
    /**
     * Progress state used to render checkmarks and gate navigation.
     */
    status: z.enum(["In Progress", "Completed", "Not Started"]),
  })
  .strict();

/**
 * Schema for a time constraint
 *
 * @deprecated Time Constraints are no longer used within the application questionnaire.
 */
export const timeConstraintSchema = z
  .object({
    /**
     * Short explanation of the constraint.
     */
    description: z.string().max(100),
    /**
     * First day the constraint applies.
     * @format MM/DD/YYYY
     */
    effectiveDate: z.string().refine((val) => dayjs(val, "MM/DD/YYYY", true)?.isValid()),
  })
  .strict();

export const clinicalDataSchema = z
  .object({
    /**
     * Clinical data categories included in the submission
     *
     * @example ["imaging", "proteomics", "genomics"]
     */
    dataTypes: z
      .array(
        z.enum(
          [
            DataTypes.demographicData,
            DataTypes.relapseRecurrenceData,
            DataTypes.diagnosisData,
            DataTypes.outcomeData,
            DataTypes.treatmentData,
            DataTypes.biospecimenData,
          ].map((option) => option.name)
        )
      )
      .optional(),
    /**
     * Free-text list of additional data types that are not listed.
     * List items should be separated by pipes ("|").
     *
     * @example "metabolomics | proteomics | genomics"
     */
    otherDataTypes: z.string().optional(),
    /**
     * Indicates intent to add additional type of data in a future submission.
     *
     * @note List items should be separated by pipes ("|").
     * @example "dataType1 | dataType2 | dataType3"
     */
    futureDataTypes: z.boolean().optional(),
  })
  .strict();

export const contactSchema = z
  .object({
    /**
     * Role of the contact within the project
     */
    position: z.string().max(100).nonempty(),
    /**
     * The contact's first name.
     */
    firstName: z.string().max(50).nonempty(),
    /**
     * The contact's last name.
     */
    lastName: z.string().max(50).nonempty(),
    /**
     * Primary email used for contact follow-ups.
     */
    email: z.union([z.email(), z.literal("")]),
    /**
     * The contact's phone number.
     */
    phone: z.string().max(25).optional(),
    /**
     * The institution name for the contact.
     *
     * @deprecated This is a legacy field and should only be used when the institutionID is not available.
     */
    institution: z.string().optional(),
    /**
     * UUIDv4 for the contact's institution; preferred over the legacy name field.
     * Enables consistent lookups and reporting.
     *
     * @since 3.4.0
     */
    institutionID: z.union([z.uuidv4(), z.literal("")]).nullable(),
  })
  .strict();

/**
 * Schema for the Principal Investigator (PI) information.
 */
export const piSchema = z
  .object({
    /**
     * @see contactSchema — shared contact fields inherited.
     */
    ...contactSchema.omit({ phone: true }).shape,
    /**
     * ORCID identifier for the PI (format: 0000-0000-0000-0000 or X checksum).
     * Used for identity verification and publication linkage.
     */
    ORCID: z.union([
      z.string().regex(/^(\d{4}-){3}\d{3}(\d|X)$/, "Please provide a valid ORCID"),
      z.literal(""),
    ]),
    /**
     * Mailing address for official correspondence
     */
    address: z.string().max(200).nonempty(),
  })
  .strict();

/**
 * Schema for the program input information.
 */
export const programInputSchema = z
  .object({
    /**
     * Stable UUIDv4 for the program; used to link submissions to the program.
     * "Not Applicable" and "Other" are also valid options.
     */
    _id: z.uuidv4().or(z.enum(["Not Applicable", "Other"])),
    /**
     * Existing/Custom program name or no value if not applicable.
     */
    name: z.string().max(100).optional(),
    /**
     * Existing/Custom short abbreviation or no value if not applicable.
     *
     * @example "TCGA"
     */
    abbreviation: z.string().max(100).optional(),
    /**
     * Existing/Custom overview to help reviewers understand the program. Or no value if not applicable.
     */
    description: z.string().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (val._id !== "Not Applicable" && !val.name) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: FIELD_IS_REQUIRED,
      });
    }
    if (val._id !== "Not Applicable" && !val.abbreviation) {
      ctx.addIssue({
        code: "custom",
        path: ["abbreviation"],
        message: FIELD_IS_REQUIRED,
      });
    }
    if (val._id !== "Not Applicable" && !val.description) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: FIELD_IS_REQUIRED,
      });
    }
  })
  .strict();

export const repositorySchema = z
  .object({
    /**
     * Name of the external repository receiving data.
     *
     * @example "GEO", "EGA", etc.
     */
    name: z.string().max(50).nonempty(),
    /**
     * Study identifier used by the repository to associate records.
     */
    studyID: z.string().max(50).nonempty(),
    /**
     * Data categories already submitted.
     *
     * @example ["imaging", "proteomics", "genomics"]
     */
    dataTypesSubmitted: z.array(z.enum(repositoryDataTypesOptions.map((option) => option.name))),
    /**
     * Free-text for submitted data types not covered by the list.
     *
     * @example "dataType1 | dataType2 | dataType3"
     */
    otherDataTypesSubmitted: z.string().max(100).optional(),
  })
  .strict();

/**
 * Schema for a publication associated with the study.
 */
export const publicationSchema = z
  .object({
    /**
     * Full publication title associated with the study.
     */
    title: z.string().max(500).nonempty(),
    /**
     * PubMed ID (PMID) to enable automatic linking.
     */
    pubmedID: z.string().max(20).optional(),
    /**
     * Digital Object Identifier to uniquely reference the work.
     */
    DOI: z.string().max(20).optional(),
  })
  .strict();

/**
 * Schema for a planned publication associated with the study.
 */
export const plannedPublicationSchema = z
  .object({
    /**
     * Working or planned title for the forthcoming publication and/or pre-print.
     */
    title: z.string().max(500).nonempty(),
    /**
     * Target date for publication release.
     * Stored as MM/DD/YYYY.
     */
    expectedDate: z.string().refine((val) => dayjs(val, "MM/DD/YYYY", true)?.isValid()),
  })
  .strict();

/**
 * Schema for funding information.
 */
export const fundingSchema = z
  .object({
    /**
     * Funding agency/organization name.
     */
    agency: z.string().nonempty(),
    /**
     * The grant or contract number(s).
     *
     * @example "R01CAXXXX, R01CAYYYY"
     */
    grantNumbers: z.string().max(250).nonempty(),
    /**
     * The NCI Program Officer.
     */
    nciProgramOfficer: z.string().max(50).optional(),
    /**
     * The name of the NCI Genomic Program Administrator
     *
     * @deprecated Use `GPAName` instead.
     * @see studySchema
     */
    nciGPA: z.string().optional(),
  })
  .strict();

/**
 * Schema for the study information.
 */
export const studySchema = z
  .object({
    /**
     * The full study title.
     */
    name: z.string().max(1_000).nonempty(),
    /**
     * The short study title.
     */
    abbreviation: z.string().max(20).optional(),
    /**
     * A short description of the effort that these data have been collected for.
     */
    description: z.string().max(2_500).nonempty(),
    /**
     * List of published works arising from the study.
     *
     * @see publicationSchema
     */
    publications: z.array(publicationSchema),
    /**
     * List of planned publications and/or pre-prints related to this study.
     *
     * @see plannedPublicationSchema
     */
    plannedPublications: z.array(plannedPublicationSchema),
    /**
     * External repositories linked to this study and their submissions.
     *
     * @see repositorySchema
     */
    repositories: z.array(repositorySchema),
    /**
     * Funding sources and grant references for the study.
     *
     * @see fundingSchema
     */
    funding: z.array(fundingSchema),
    /**
     * Indicates whether the study is registered in dbGaP.
     */
    isDbGapRegistered: z.boolean(),
    /**
     * The dbGaP phs accession (PPHS) used when registered.
     *
     * @example "phs002529.v1.p1"
     */
    dbGaPPPHSNumber: z
      .string()
      .max(50)
      .trim()
      .refine((val) => validatePHSNumber(val))
      .optional(),
    /**
     * The name of the Genomic Program Administrator.
     *
     * @example "John Doe"
     */
    GPAName: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.isDbGapRegistered && !val.dbGaPPPHSNumber) {
      ctx.addIssue({
        code: "custom",
        path: ["dbGaPPPHSNumber"],
        message: FIELD_IS_REQUIRED,
      });
    }
  })
  .strict();

/**
 * Schema for file information.
 */
export const fileInfoSchema = z
  .object({
    /**
     * The file type.
     *
     * @example "Raw sequencing data", "Derived sequencing data", "Clinical data"
     */
    type: z.string().nonempty(),
    /**
     * File extension associated with the file type.
     *
     * @example "BAM", "FASTQ", "JSON", "TSV"
     */
    extension: z.string().nonempty(),
    /**
     * Number of files to be submitted for this type.
     *
     * @note Must be a non-negative integer.
     */
    count: z.number().int().nonnegative().nullable(),
    /**
     * Approximate total data volume for this file type.
     *
     * @example "120 GB"
     */
    amount: z.string().nonempty(),
  })
  .strict();

export const questionnaireDataSchema = z
  .object({
    /**
     * All sections presented to the applicant with their progress state.
     *
     * @see sectionSchema
     */
    sections: z.array(sectionSchema),
    /**
     * Principal Investigator responsible for the submission.
     *
     * @see piSchema
     */
    pi: piSchema,
    /**
     * If true, the PI is also the primary contact and no separate contact is required.
     */
    piAsPrimaryContact: z.boolean().optional(),
    /**
     * Designated contact for day-to-day coordination, or empty if PI serves as primary.
     *
     * @see contactSchema
     */
    primaryContact: contactSchema.nullable(),
    /**
     * Additional points of contacts.
     *
     * @see contactSchema
     */
    additionalContacts: z.array(contactSchema),
    /**
     * Program the submission falls under.
     *
     * @see programInputSchema
     */
    program: programInputSchema,
    /**
     * Study metadata and related artifacts.
     *
     * @see studySchema
     */
    study: studySchema,
    /**
     * Types of access required for the data.
     *
     * @example ["Controlled Access", "Open Access"]
     */
    accessTypes: z.array(z.enum(accessTypeOptions.map((option) => option.value))),
    /**
     * Targeted date to submit initial data.
     * Stored as MM/DD/YYYY (coerced from Date).
     * Must be a future date.
     */
    targetedSubmissionDate: z.string().refine((val) => {
      const date = dayjs(val, "MM/DD/YYYY", true)?.startOf("day");
      const dateIsTodayOrAfter =
        date?.isSame(dayjs().startOf("day")) || date?.isAfter(dayjs().startOf("day"));
      return date?.isValid() && dateIsTodayOrAfter;
    }),
    /**
     * Targeted public release date.
     * Stored as MM/DD/YYYY (coerced from Date).
     * Must be a future date.
     */
    targetedReleaseDate: z.string().refine((val) => {
      const date = dayjs(val, "MM/DD/YYYY", true);
      const dateIsTodayOrAfter =
        date?.isSame(dayjs().startOf("day")) || date?.isAfter(dayjs().startOf("day"));
      return date?.isValid() && dateIsTodayOrAfter;
    }),
    /**
     * The submission time constraints.
     *
     * @see timeConstraintSchema
     * @deprecated
     */
    timeConstraints: z.array(timeConstraintSchema),
    /**
     * Cancer types represented in the study.
     */
    cancerTypes: z.array(z.enum(cancerTypeOptions)).optional(),
    /**
     * Free-text when the cancer type is not listed.
     *
     * @note List items should be separated by pipes ("|").
     * @example "Lorem, Ipsum | Dolor sit amet"
     */
    otherCancerTypes: z.string().max(1_000).optional(),
    /**
     * Indicates whether the "Other cancer types" field is enabled.
     */
    otherCancerTypesEnabled: z.boolean().optional(),
    /**
     * Pre-cancer types represented in the study.
     *
     * @note List items should be separated by pipes ("|").
     * @example "Lorem, Ipsum | Dolor sit amet"
     */
    preCancerTypes: z.string().max(500).optional(),
    /**
     * Total enrolled or expected participant count.
     *
     * @note Must be a positive integer.
     */
    numberOfParticipants: z.number().int().positive().max(2_000_000_000),
    /**
     * Species represented in the dataset
     *
     * @example ["Homo sapiens", "Mus musculus"]
     */
    species: z.array(z.string()),
    /**
     * Indicates whether an "Other species" text field is enabled.
     */
    otherSpeciesEnabled: z.boolean().optional(),
    /**
     * Free-text for species not listed when enabled.
     *
     * @note List items should be separated by pipes ("|").
     * @note Must be less than or equal to 500 characters.
     * @example "Lorem, Ipsum | Dolor sit amet"
     */
    otherSpeciesOfSubjects: z.string().max(500).optional(),
    /**
     * Indicates if cell line data are included.
     */
    cellLines: z.boolean().optional(),
    /**
     * Indicates if model systems are included.
     */
    modelSystems: z.boolean().optional(),
    /**
     * Confirms imaging data have been de-identified.
     */
    imagingDataDeIdentified: z.boolean().optional(),
    /**
     * Confirms non-imaging data have been de-identified.
     */
    dataDeIdentified: z.boolean(),
    /**
     * All major types of data included in this submission.
     */
    dataTypes: z
      .array(
        z.enum(
          [
            DataTypes.clinicalTrial,
            DataTypes.genomics,
            DataTypes.imaging,
            DataTypes.proteomics,
          ].map((option) => option.name)
        )
      )
      .optional(),
    /**
     * Free-text when a data type is not listed.
     *
     * @note List items should be separated by pipes ("|").
     * @example "Lorem, Ipsum | Dolor sit amet"
     */
    otherDataTypes: z.string().optional(),
    /**
     * Clinical data subset details.
     *
     * @see clinicalDataSchema
     */
    clinicalData: clinicalDataSchema.optional(),
    /**
     * Summary of files by type.
     *
     * @see fileInfoSchema
     */
    files: z.array(fileInfoSchema),
    /**
     * Optional notes from the submitter to reviewers.
     */
    submitterComment: z.string().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.otherCancerTypesEnabled && !val.otherCancerTypes?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["otherCancerTypes"],
        message: FIELD_IS_REQUIRED,
      });
    }
    if (val.otherSpeciesEnabled && !val.otherSpeciesOfSubjects?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["otherSpeciesOfSubjects"],
        message: FIELD_IS_REQUIRED,
      });
    }
    if (!val.piAsPrimaryContact && val.primaryContact === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["primaryContact"],
        message: "primaryContact is required when piAsPrimaryContact is false",
      });
    }
    if (val.clinicalData && !val.dataTypes?.includes(DataTypes.clinicalTrial.name)) {
      ctx.addIssue({
        code: "custom",
        path: ["clinicalData"],
        message: `clinicalData is only valid when dataTypes includes ${DataTypes.clinicalTrial.name}`,
      });
    }
    if (
      val.dataTypes?.includes(DataTypes.imaging.name) &&
      val.imagingDataDeIdentified === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["imagingDataDeIdentified"],
        message: FIELD_IS_REQUIRED,
      });
    }
  })
  .strict();

export type QuestionnaireData = z.infer<typeof questionnaireDataSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type SectionStatus = z.infer<typeof sectionSchema>["status"];
export type SectionKey = z.infer<typeof sectionSchema>["name"];
export type TimeConstraint = z.infer<typeof timeConstraintSchema>;
export type ClinicalData = z.infer<typeof clinicalDataSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type PI = z.infer<typeof piSchema>;
export type ProgramInput = z.infer<typeof programInputSchema>;
export type Study = z.infer<typeof studySchema>;
export type Repository = z.infer<typeof repositorySchema>;
export type Publication = z.infer<typeof publicationSchema>;
export type PlannedPublication = z.infer<typeof plannedPublicationSchema>;
export type FileInfo = z.infer<typeof fileInfoSchema>;
export type Funding = z.infer<typeof fundingSchema>;
