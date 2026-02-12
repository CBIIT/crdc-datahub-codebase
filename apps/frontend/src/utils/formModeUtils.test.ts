import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import * as utils from "./formModeUtils";

describe("getFormMode tests based on provided requirements", () => {
  // submission created by baseUser and part of the same org
  const baseSubmission: Application = applicationFactory.build({
    _id: "submission-123",
    questionnaireData: questionnaireDataFactory.build(),
    status: "New",
    applicant: applicantFactory.build({
      applicantID: "current-user",
      applicantName: "John",
      applicantEmail: "johndoe@example.com",
    }),
    createdAt: "2023-05-01T09:23:30Z",
    updatedAt: "2023-05-02T09:23:30Z",
  });

  // User Tests
  describe("getFormMode > User tests", () => {
    const user: User = userFactory.build({
      _id: "current-user",
      firstName: "John",
      email: "johndoe@example.com",
      role: "Submitter",
      permissions: ["submission_request:create", "submission_request:submit"],
    });

    it("should allow User to edit when form status is New", () => {
      expect(utils.getFormMode(user, baseSubmission)).toBe(utils.FormModes.EDIT);
    });

    it("should set View Only for User when form is Submitted, In Review, Approved, or Rejected", () => {
      const statuses: ApplicationStatus[] = ["Submitted", "In Review", "Approved", "Rejected"];

      statuses.forEach((status) => {
        expect(utils.getFormMode(user, { ...baseSubmission, status })).toBe(
          utils.FormModes.VIEW_ONLY
        );
      });
    });

    it("should allow User to edit when form status is New, In Progress or Inquired", () => {
      const statuses: ApplicationStatus[] = ["New", "In Progress", "Inquired"];

      statuses.forEach((status) => {
        expect(utils.getFormMode(user, { ...baseSubmission, status })).toBe(utils.FormModes.EDIT);
      });
    });

    it("should be Unauthorized for User when User does not own the Submission", () => {
      const submission: Application = {
        ...baseSubmission,
        status: "In Progress",
        applicant: {
          ...baseSubmission.applicant,
          applicantID: "user-456-another-user",
        },
      };

      expect(utils.getFormMode(user, submission)).toBe(utils.FormModes.UNAUTHORIZED);
    });
  });

  // Submitter Tests
  describe("getFormMode > Submitter tests", () => {
    const user: User = userFactory.build({
      _id: "current-user",
      firstName: "John",
      email: "johndoe@example.com",
      role: "Submitter",
      permissions: ["submission_request:create", "submission_request:submit"],
    });

    it("should allow Submitter to edit when form status is New", () => {
      expect(utils.getFormMode(user, baseSubmission)).toBe(utils.FormModes.EDIT);
    });

    it("should set View Only for Submitter when form is Submitted, In Review, Approved, or Rejected", () => {
      const statuses: ApplicationStatus[] = ["Submitted", "In Review", "Approved", "Rejected"];

      statuses.forEach((status) => {
        expect(utils.getFormMode(user, { ...baseSubmission, status })).toBe(
          utils.FormModes.VIEW_ONLY
        );
      });
    });

    it("should allow Submitter to edit when form status is New, In Progress, or Inquired", () => {
      const statuses: ApplicationStatus[] = ["New", "In Progress", "Inquired"];

      statuses.forEach((status) => {
        expect(utils.getFormMode(user, { ...baseSubmission, status })).toBe(utils.FormModes.EDIT);
      });
    });
  });

  // Federal Lead Tests
  describe("getFormMode > Fed Lead tests", () => {
    const user: User = userFactory.build({
      _id: "current-user",
      firstName: "John",
      email: "johndoe@example.com",
      role: "Federal Lead",
      permissions: [
        "submission_request:view",
        "submission_request:submit",
        "submission_request:review",
      ],
    });

    it("should set Review mode for Fed Lead when status is 'In Review'", () => {
      expect(utils.getFormMode(user, { ...baseSubmission, status: "In Review" })).toBe(
        utils.FormModes.REVIEW
      );
    });

    it("should set View Only mode for Fed Lead for all other statuses", () => {
      const statuses: ApplicationStatus[] = [
        "New",
        "Approved",
        "In Progress",
        "Rejected",
        "Inquired",
        "Submitted",
      ];

      statuses.forEach((status) => {
        expect(utils.getFormMode(user, { ...baseSubmission, status })).toBe(
          utils.FormModes.VIEW_ONLY
        );
      });
    });

    it("should be View Only mode for any Submission when Fed Lead does not own the Submission", () => {
      const submission: Application = {
        ...baseSubmission,
        status: "In Progress",
        applicant: {
          ...baseSubmission.applicant,
          applicantID: "user-456-another-user",
        },
      };

      expect(utils.getFormMode(user, submission)).toBe(utils.FormModes.VIEW_ONLY);
    });
  });

  // Admin Tests
  describe("getFormMode > Admin tests", () => {
    const user: User = userFactory.build({
      _id: "current-user",
      firstName: "John",
      email: "johndoe@example.com",
      role: "Admin",
      permissions: ["submission_request:view"],
    });

    it("should always set View Only for Admin", () => {
      const statuses: ApplicationStatus[] = [
        "New",
        "Submitted",
        "In Review",
        "Approved",
        "In Progress",
        "Rejected",
        "Inquired",
      ];

      statuses.forEach((status) => {
        expect(utils.getFormMode(user, { ...baseSubmission, status })).toBe(
          utils.FormModes.VIEW_ONLY
        );
      });
    });

    it("should be View Only mode for any Submission when Admin does not own the Submission", () => {
      const submission: Application = {
        ...baseSubmission,
        status: "In Progress",
        applicant: {
          ...baseSubmission.applicant,
          applicantID: "user-456-another-user",
        },
      };

      expect(utils.getFormMode(user, submission)).toBe(utils.FormModes.VIEW_ONLY);
    });
  });

  // Other role Tests
  describe("getFormMode > Other roles tests", () => {
    it("should always set View Only for all other roles with the required view permissions", () => {
      const statuses: ApplicationStatus[] = [
        "New",
        "In Progress",
        "Submitted",
        "In Review",
        "Approved",
        "Rejected",
        "Inquired",
      ];

      const user: User = userFactory.build({
        _id: "current-user",
        firstName: "John",
        email: "johndoe@example.com",
        role: "Data Commons Personnel",
        permissions: ["submission_request:view"],
      });
      statuses.forEach((status) => {
        expect(utils.getFormMode(user, { ...baseSubmission, status })).toBe(
          utils.FormModes.VIEW_ONLY
        );
      });
    });
  });

  // New Rejected status tests
  describe("getFormMode > New Rejected status test", () => {
    it("rejected is a final state, no role should be able to do anything past rejected", () => {
      const roles: UserRole[] = [
        "Data Commons Personnel",
        "Admin",
        "Federal Lead",
        "Submitter",
        "User",
      ];
      const status: ApplicationStatus = "Rejected";

      roles.forEach((role) => {
        const user: User = userFactory.build({
          _id: "current-user",
          firstName: "John",
          email: "johndoe@example.com",
          role,
          permissions: [
            "submission_request:create",
            "submission_request:view",
            "submission_request:submit",
            "submission_request:review",
          ],
        });
        expect(utils.getFormMode(user, { ...baseSubmission, status })).toBe(
          utils.FormModes.VIEW_ONLY
        );
      });
    });
  });

  // New Inquired status tests
  describe("getFormMode > New Inquired status test", () => {
    it("inquired should be read only for Fed Lead but not for the submission request owner", () => {
      const submission: Application = {
        ...baseSubmission,
        status: "Inquired",
        applicant: {
          ...baseSubmission.applicant,
          applicantID: "user-456-another-user",
        },
      };
      const fedLead: User = userFactory.build({
        _id: "current-user",
        firstName: "John",
        email: "johndoe@example.com",
        role: "Federal Lead",
        permissions: [
          "submission_request:view",
          "submission_request:submit",
          "submission_request:review",
        ],
      });
      const submitterOwner: User = userFactory.build({
        role: "Submitter",
        permissions: ["submission_request:create", "submission_request:submit"],
        _id: "user-456-another-user",
      });

      expect(utils.getFormMode(fedLead, submission)).toBe(utils.FormModes.VIEW_ONLY);
      expect(utils.getFormMode(submitterOwner, submission)).toBe(utils.FormModes.EDIT);
    });
  });

  // Edge case Tests
  describe("getFormMode > Edge Case Tests", () => {
    describe("getFormMode > Edge Case Tests > Invalid data tests", () => {
      it("should set Unauthorized when a null User is provided", () => {
        expect(utils.getFormMode(null, baseSubmission)).toBe(utils.FormModes.UNAUTHORIZED);
      });

      it("should set Unauthorized when a null data Submission is provided", () => {
        const user: User = userFactory.build({ role: "User" });

        expect(utils.getFormMode(user, null)).toBe(utils.FormModes.UNAUTHORIZED);
      });

      it("should set Unauthorized when a null data Submission and User is provided", () => {
        expect(utils.getFormMode(null, null)).toBe(utils.FormModes.UNAUTHORIZED);
      });

      it("should set Unauthorized form if user does not have the required permissions and is not submission owner", () => {
        const user: User = userFactory.build({ role: undefined, permissions: [] });
        const submission: Application = {
          ...baseSubmission,
          applicant: { ...baseSubmission.applicant, applicantID: "some-other-user" },
        };

        expect(utils.getFormMode(user, submission)).toBe(utils.FormModes.UNAUTHORIZED);
      });

      it("should set 'View Only' if form status is unknown or not defined", () => {
        const user: User = userFactory.build({
          role: "User",
          permissions: ["submission_request:view"],
        });
        const submission: Application = {
          ...baseSubmission,
          status: undefined,
        };

        expect(utils.getFormMode(user, submission)).toBe(utils.FormModes.VIEW_ONLY);
      });
    });
  });
});
