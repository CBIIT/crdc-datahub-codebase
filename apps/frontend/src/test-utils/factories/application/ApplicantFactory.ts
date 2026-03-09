import { Factory } from "../Factory";

/**
 * Base applicant object
 */
export const baseApplicant: Applicant = {
  applicantID: "",
  applicantName: "",
  applicantEmail: "",
};

/**
 * Applicant factory for creating applicant instances
 */
export const applicantFactory = new Factory<Applicant>((overrides) => ({
  ...baseApplicant,
  ...overrides,
}));
