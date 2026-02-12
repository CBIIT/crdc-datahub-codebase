type Application = {
  // Application Details
  _id: string;
  status: ApplicationStatus;
  createdAt: string; // YYYY-MM-DDTHH:MM:SSZ format
  updatedAt: string; // YYYY-MM-DDTHH:MM:SSZ format
  submittedDate: string; // YYYY-MM-DDTHH:MM:SSZ format
  history: HistoryEvent[];
  ORCID: string;
  // Applicant Details
  applicant: Applicant;
  PI: string; // Principal Investigator's full name "<first name> <last name>"
  controlledAccess: boolean;
  openAccess: boolean;
  // Sort Fields
  studyAbbreviation: Study["abbreviation"];
  // FE Questionnaire Data
  questionnaireData: QuestionnaireData;
  /**
   * A indicator to show if the application is conditionally approved.
   */
  conditional: boolean;
  /**
   * A list of conditions that need to be met before the application can be approved.
   */
  pendingConditions: string[];
  /**
   * The name for the application program
   */
  programName: string;
  /**
   * The abbreviation for the application program
   */
  programAbbreviation: string;
  /**
   * The description for the application program
   */
  programDescription: string;
  /**
   * The new institutions present in the form
   */
  newInstitutions: Array<{ id: string; name: string }>;
  /**
   * The name of the Genomic Program Administrator
   */
  GPAName: string;
  /**
   * The current form version
   */
  version: string;
};

type ApplicationStatus =
  | "New"
  | "In Progress"
  | "Submitted"
  | "In Review"
  | "Approved"
  | "Rejected"
  | "Inquired"
  | "Canceled"
  | "Deleted";

type HistoryEvent = HistoryBase<ApplicationStatus>;

type Applicant = {
  applicantID: string;
  applicantName: string;
  applicantEmail: string;
};

type QuestionnaireData = import("@/schemas/Application").QuestionnaireData;
type Section = import("@/schemas/Application").Section;
type SectionKey = import("@/schemas/Application").SectionKey;
type SectionStatus = import("@/schemas/Application").SectionStatus;
type TimeConstraint = import("@/schemas/Application").TimeConstraint;
type ClinicalData = import("@/schemas/Application").ClinicalData;
type Contact = import("@/schemas/Application").Contact;
type PI = import("@/schemas/Application").PI;
type ProgramInput = import("@/schemas/Application").ProgramInput;
type Study = import("@/schemas/Application").Study;
type Repository = import("@/schemas/Application").Repository;
type Publication = import("@/schemas/Application").Publication;
type PlannedPublication = import("@/schemas/Application").PlannedPublication;
type FileInfo = import("@/schemas/Application").FileInfo;
type Funding = import("@/schemas/Application").Funding;
