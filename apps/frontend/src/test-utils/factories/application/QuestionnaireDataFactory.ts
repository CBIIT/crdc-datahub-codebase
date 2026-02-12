import { organizationFactory } from "../auth/OrganizationFactory";
import { Factory } from "../Factory";

import { clinicalDataFactory } from "./ClinicalDataFactory";
import { contactFactory } from "./ContactFactory";
import { fileInfoFactory } from "./FileInfoFactory";
import { fundingFactory } from "./FundingFactory";
import { piFactory } from "./PIFactory";
import { studyFactory } from "./StudyFactory";

/**
 * Base questionnaire object
 * @note Created to match InitialQuestionnaire
 */
export const baseQuestionnaireData: QuestionnaireData = {
  sections: [],
  pi: piFactory.build(),
  piAsPrimaryContact: false,
  primaryContact: contactFactory.build(),
  additionalContacts: [],
  program: organizationFactory.pick(["_id", "name", "abbreviation", "description"]).build(),
  study: studyFactory.build({
    funding: fundingFactory.build(1),
  }),
  accessTypes: [],
  targetedSubmissionDate: "",
  targetedReleaseDate: "",
  timeConstraints: [],
  cancerTypes: [],
  otherCancerTypes: "",
  otherCancerTypesEnabled: false,
  preCancerTypes: "",
  numberOfParticipants: null,
  species: [],
  otherSpeciesEnabled: false,
  otherSpeciesOfSubjects: "",
  cellLines: false,
  modelSystems: false,
  imagingDataDeIdentified: null,
  dataDeIdentified: null,
  dataTypes: [],
  otherDataTypes: "",
  clinicalData: clinicalDataFactory.build(),
  files: fileInfoFactory.build(1, { count: null }),
  submitterComment: "",
};

/**
 * Questionnaire factory for creating questionnaire instances
 */
export const questionnaireDataFactory = new Factory<QuestionnaireData>((overrides) => ({
  ...baseQuestionnaireData,
  ...overrides,
}));
