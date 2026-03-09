import * as z from "zod";

import {
  fundingSchema,
  plannedPublicationSchema,
  programInputSchema,
  publicationSchema,
  questionnaireDataSchema,
  repositorySchema,
  studySchema,
  studySchemaSuperRefine,
} from "./Application";

/**
 * Zod schema for all fields in Section A of the Submission Request Form
 */
const ASchema = questionnaireDataSchema.pick({
  pi: true,
  piAsPrimaryContact: true,
  primaryContact: true,
  additionalContacts: true,
});

/**
 * Zod schema for all fields in Section B of the Submission Request Form
 */
const BSchema = z
  .object({
    program: programInputSchema,
    study: z
      .object({
        name: studySchema.shape.name,
        abbreviation: studySchema.shape.abbreviation,
        description: studySchema.shape.description,
        funding: z.array(
          fundingSchema.pick({ agency: true, grantNumbers: true, nciProgramOfficer: true })
        ),
        publications: z.array(publicationSchema.pick({ title: true, pubmedID: true, DOI: true })),
        plannedPublications: z.array(
          plannedPublicationSchema.pick({ title: true, expectedDate: true })
        ),
        repositories: z.array(
          repositorySchema.pick({
            name: true,
            studyID: true,
            dataTypesSubmitted: true,
            otherDataTypesSubmitted: true,
          })
        ),
      })
      .strict(),
  })
  .strict();

/**
 * Zod schema for all fields in Section C of the Submission Request Form
 */
const CSchema = z
  .object({
    accessTypes: questionnaireDataSchema.shape.accessTypes,
    cancerTypes: questionnaireDataSchema.shape.cancerTypes,
    study: z
      .object({
        isDbGapRegistered: questionnaireDataSchema.shape.study.shape.isDbGapRegistered,
        dbGaPPPHSNumber: questionnaireDataSchema.shape.study.shape.dbGaPPPHSNumber,
        GPAName: questionnaireDataSchema.shape.study.shape.GPAName,
      })
      .superRefine(studySchemaSuperRefine)
      .strict(),
    otherCancerTypesEnabled: questionnaireDataSchema.shape.otherCancerTypesEnabled,
    otherCancerTypes: questionnaireDataSchema.shape.otherCancerTypes,
    preCancerTypes: questionnaireDataSchema.shape.preCancerTypes,
    species: questionnaireDataSchema.shape.species,
    otherSpeciesEnabled: questionnaireDataSchema.shape.otherSpeciesEnabled,
    otherSpeciesOfSubjects: questionnaireDataSchema.shape.otherSpeciesOfSubjects,
    numberOfParticipants: questionnaireDataSchema.shape.numberOfParticipants,
  })
  .strict();

/**
 * Zod schema for all fields in Section D of the Submission Request Form
 */
const DSchema = z
  .object({
    targetedSubmissionDate: questionnaireDataSchema.shape.targetedSubmissionDate,
    targetedReleaseDate: questionnaireDataSchema.shape.targetedReleaseDate,
    dataTypes: questionnaireDataSchema.shape.dataTypes,
    imagingDataDeIdentified: questionnaireDataSchema.shape.imagingDataDeIdentified,
    otherDataTypes: questionnaireDataSchema.shape.otherDataTypes,
    clinicalData: questionnaireDataSchema.shape.clinicalData,
    files: questionnaireDataSchema.shape.files,
    dataDeIdentified: questionnaireDataSchema.shape.dataDeIdentified,
    cellLines: questionnaireDataSchema.shape.cellLines,
    modelSystems: questionnaireDataSchema.shape.modelSystems,
    submitterComment: questionnaireDataSchema.shape.submitterComment,
  })
  .strict();

export {
  ASchema as SectionASchema,
  BSchema as SectionBSchema,
  CSchema as SectionCSchema,
  DSchema as SectionDSchema,
};
