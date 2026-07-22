import type { Path } from "react-hook-form";

/**
 * Defines a list of fields that are locked from editing when the application is reopened
 * aka. The `sueqenceNumber` is greater than 1.
 */
export const LOCKED_QUESTIONNAIRE_FIELDS = [
  "pi.firstName",
  "pi.lastName",
  "pi.position",
  "pi.email",
  "pi.ORCID",
  "pi.institution",
  "pi.institutionID",
  "pi.address",
  "program._id",
  "program.name",
  "program.abbreviation",
  "study.name",
  "study.abbreviation",
] as const satisfies readonly Path<QuestionnaireData>[];

export const LOCKED_QUESTIONNAIRE_FIELDSET = new Set<string>(
  LOCKED_QUESTIONNAIRE_FIELDS as readonly string[]
);
