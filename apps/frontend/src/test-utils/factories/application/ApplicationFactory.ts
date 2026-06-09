import { Factory } from "../Factory";

/**
 * Base application object
 * @note Created to match InitialApplication
 */
export const baseApplication: Application = {
  _id: "",
  applicant: null,
  status: "New",
  createdAt: "",
  updatedAt: "",
  submittedDate: "",
  history: [],
  controlledAccess: false,
  openAccess: false,
  ORCID: "",
  programName: "",
  studyName: "",
  studyAbbreviation: "",
  PI: "",
  questionnaireData: undefined,
  conditional: false,
  pendingConditions: [],
  programAbbreviation: "",
  programDescription: "",
  newInstitutions: [],
  version: "",
  GPAName: "",
  sequenceNumber: 1,
  nextRevisionId: null,
  canBeReopened: false,
};

/**
 * Application factory for creating application instances
 */
export const applicationFactory = new Factory<Application>((overrides) => ({
  ...baseApplication,
  ...overrides,
}));
