import { userFactory } from "../auth/UserFactory";
import { Factory } from "../Factory";

/**
 * Base approved study object
 */
export const baseApprovedStudy: ApprovedStudy = {
  _id: "",
  originalOrg: "",
  studyName: "",
  studyAbbreviation: "",
  dbGaPID: "",
  controlledAccess: false,
  openAccess: false,
  PI: "",
  ORCID: "",
  program: null,
  primaryContact: userFactory.build(),
  useProgramPC: false,
  pendingModelChange: false,
  isPendingGPA: false,
  GPAName: "",
  createdAt: "",
};

/**
 * Approved study factory for creating approved study instances
 */
export const approvedStudyFactory = new Factory<ApprovedStudy>((overrides) => ({
  ...baseApprovedStudy,
  ...overrides,
}));
