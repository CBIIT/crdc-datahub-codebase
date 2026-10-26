import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import * as utils from "./messagingUtils";

const owner: User = userFactory.build({
  _id: "owner-user",
  role: "Submitter",
  permissions: [],
});

const application: Application = applicationFactory.build({
  _id: "application-123",
  status: "In Review",
  applicant: applicantFactory.build({ applicantID: "owner-user" }),
});

describe("canViewSRFMessages", () => {
  it("should allow the SRF owner to view messages", () => {
    expect(utils.canViewSRFMessages(owner, application)).toBe(true);
  });

  it("should allow a user with submission_request:view permission to view messages", () => {
    const user = userFactory.build({
      _id: "internal-user",
      role: "Federal Lead",
      permissions: ["submission_request:view"],
    });

    expect(utils.canViewSRFMessages(user, application)).toBe(true);
  });

  it("should allow a user with submission_request:review permission to view messages", () => {
    const user = userFactory.build({
      _id: "internal-user",
      role: "Federal Lead",
      permissions: ["submission_request:review"],
    });

    expect(utils.canViewSRFMessages(user, application)).toBe(true);
  });

  it("should prevent a non-owner without permissions from viewing messages", () => {
    const user = userFactory.build({
      _id: "other-user",
      role: "Submitter",
      permissions: ["submission_request:create", "submission_request:submit"],
    });

    expect(utils.canViewSRFMessages(user, application)).toBe(false);
  });
});

describe("canSendSRFMessages", () => {
  it("should allow the SRF owner to send messages", () => {
    expect(utils.canSendSRFMessages(owner, application)).toBe(true);
  });

  it("should allow a user with submission_request:review permission to send messages", () => {
    const user = userFactory.build({
      _id: "internal-user",
      role: "Federal Lead",
      permissions: ["submission_request:review"],
    });

    expect(utils.canSendSRFMessages(user, application)).toBe(true);
  });

  it("should prevent a user with only submission_request:view permission from sending messages", () => {
    const user = userFactory.build({
      _id: "internal-user",
      role: "Federal Lead",
      permissions: ["submission_request:view"],
    });

    expect(utils.canSendSRFMessages(user, application)).toBe(false);
  });

  it("should prevent a non-owner without permissions from sending messages", () => {
    const user = userFactory.build({
      _id: "other-user",
      role: "Submitter",
      permissions: ["submission_request:create", "submission_request:submit"],
    });

    expect(utils.canSendSRFMessages(user, application)).toBe(false);
  });
});

describe("isSRFConversationClosed", () => {
  it.each<ApplicationStatus>(["Approved", "Rejected"])(
    "should be closed when the status is %s and there are no pending conditions",
    (status) => {
      const app = applicationFactory.build({ status, pendingConditions: [] });

      expect(utils.isSRFConversationClosed(app)).toBe(true);
    }
  );

  it.each<ApplicationStatus>(["Approved", "Rejected"])(
    "should remain open when the status is %s and there are pending conditions",
    (status) => {
      const app = applicationFactory.build({
        status,
        pendingConditions: ["Upload the data use agreement"],
      });

      expect(utils.isSRFConversationClosed(app)).toBe(false);
    }
  );

  it.each<ApplicationStatus>([
    "New",
    "In Progress",
    "Submitted",
    "In Review",
    "Inquired",
    "In Revision",
    "Reopened",
    "Canceled",
    "Deleted",
  ])("should remain open when the status is %s", (status) => {
    const app = applicationFactory.build({ status, pendingConditions: [] });

    expect(utils.isSRFConversationClosed(app)).toBe(false);
  });
});
