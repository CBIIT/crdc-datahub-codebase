import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { hasPermission } from "./AuthPermissions";

describe("Basic Permissions", () => {
  it.each<UserRole>([
    "Admin",
    "Data Commons Personnel",
    "Federal Lead",
    "Submitter",
    "User",
    "Invalid-role" as UserRole,
  ])(
    "should allow a user to view the dashboard if they have permission, regardless of '%s' role",
    (role) => {
      const user = userFactory.build({ _id: "user-1", role, permissions: ["dashboard:view"] });
      expect(hasPermission(user, "dashboard", "view")).toBe(true);
    }
  );

  it.each<UserRole>([
    "Admin",
    "Data Commons Personnel",
    "Federal Lead",
    "Submitter",
    "User",
    "Invalid-role" as UserRole,
  ])(
    "should deny a user to view the dashboard if they do not have permission, regardless of '%s' role",
    (role) => {
      const user = userFactory.build({ _id: "user-1", role, permissions: [] });
      expect(hasPermission(user, "dashboard", "view")).toBe(false);
    }
  );

  it("should check only the permission key if the onlyKey param is set to true", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Submitter",
      permissions: ["dashboard:view"],
    });
    expect(hasPermission(user, "dashboard", "view", null, true)).toBe(true);
    expect(hasPermission(user, "access", "request", null, true)).toBe(false);
  });
});

describe("Edge Cases", () => {
  it("should deny permission if the user role is invalid", () => {
    const user = userFactory.build({ _id: "user-1", role: "InvalidRole" as UserRole });
    expect(hasPermission(user, "dashboard", "view")).toBe(false);
  });

  it("should deny permission if the user role is null or undefined", () => {
    const user = userFactory.build({ _id: "user-1", role: undefined });
    expect(hasPermission(user, "dashboard", "view")).toBe(false);
  });

  it("should deny permission if the action is invalid", () => {
    const user = userFactory.build({ _id: "user-1", role: "Admin" });
    expect(hasPermission(user, "dashboard", "invalid_action" as never)).toBe(false);
  });

  it("should deny permission if the resource is invalid", () => {
    const user = userFactory.build({ _id: "user-1", role: "Admin" });
    expect(hasPermission(user, "invalid_resource" as never, "view" as never)).toBe(false);
  });
});

describe("submission_request:submit Permission", () => {
  const validStatuses: ApplicationStatus[] = ["In Progress", "Inquired"];
  const invalidStatuses: ApplicationStatus[] = [
    "Approved",
    "In Review",
    "New",
    "Rejected",
    "Submitted",
  ];

  it.each(validStatuses)(
    "should allow a user with 'submission_request:submit' permission key if the status is '%s'",
    (status) => {
      const user = userFactory.build({
        _id: "user-1",
        role: "Admin",
        permissions: ["submission_request:submit"],
      });
      const application: Application = applicationFactory.build({ status });

      expect(hasPermission(user, "submission_request", "submit", application)).toBe(true);
    }
  );

  it.each(invalidStatuses)("should deny submission if the application status is '%s'", (status) => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Submitter",
      permissions: ["submission_request:submit"],
    });
    const application: Application = applicationFactory.build({ status });

    expect(hasPermission(user, "submission_request", "submit", application)).toBe(false);
  });

  it("should return false if application is missing or undefined", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Submitter",
      permissions: ["submission_request:submit"],
    });

    expect(hasPermission(user, "submission_request", "submit", undefined)).toBe(false);
    expect(hasPermission(user, "submission_request", "submit", null)).toBe(false);
  });

  it.each<UserRole>(["User", "Submitter"])(
    "should allow a user with role '%s' to submit with 'submission_request:submit' permission key if they are the form owner",
    (role) => {
      const user = userFactory.build({
        _id: "user-1",
        role,
        permissions: ["submission_request:submit"],
      });
      const application: Application = applicationFactory.build({
        status: "In Progress",
        applicant: applicantFactory.build({ applicantID: "user-1" }),
      });

      expect(hasPermission(user, "submission_request", "submit", application)).toBe(true);
    }
  );

  it.each<UserRole>(["User", "Submitter"])(
    "should deny a user with role '%s' to submit with 'submission_request:submit' permission key if they are not the form owner",
    (role) => {
      const user = userFactory.build({
        _id: "user-1",
        role,
        permissions: ["submission_request:submit"],
      });
      const application: Application = applicationFactory.build({
        status: "In Progress",
        applicant: applicantFactory.build({ applicantID: "some-other-user" }),
      });

      expect(hasPermission(user, "submission_request", "submit", application)).toBe(false);
    }
  );

  it.each<UserRole>(["Admin", "Data Commons Personnel", "Federal Lead"])(
    "should allow a user with role '%s' to submit with 'submission_request:submit' permission key, regardless of form owner",
    (role) => {
      const user = userFactory.build({
        _id: "user-1",
        role,
        permissions: ["submission_request:submit"],
      });
      const application: Application = applicationFactory.build({
        status: "In Progress",
        applicant: applicantFactory.build({ applicantID: "some-other-user" }),
      });

      expect(hasPermission(user, "submission_request", "submit", application)).toBe(true);
    }
  );

  it("should deny submission if the user is not the owner AND lacks the 'submission_request:submit' permission key", () => {
    const user = userFactory.build({ _id: "user-1", role: "Admin", permissions: [] });
    const application: Application = applicationFactory.build({ status: "In Progress" });

    expect(hasPermission(user, "submission_request", "submit", application)).toBe(false);
  });
});

describe("submission_request:review Permission", () => {
  it.each<UserRole>(["Admin", "Data Commons Personnel", "Federal Lead", "Submitter"])(
    "should allow role %s with no conditions except the permission key",
    (role) => {
      const user = userFactory.build({
        _id: "user-1",
        role,
        permissions: ["submission_request:review"],
      });
      expect(hasPermission(user, "submission_request", "review", applicationFactory.build())).toBe(
        true
      );
    }
  );
});

describe("submission_request:cancel Permission", () => {
  it.each<[UserRole, ApplicationStatus]>([
    ["User", "New"],
    ["User", "In Progress"],
    ["User", "Inquired"],
    ["Submitter", "New"],
    ["Submitter", "In Progress"],
    ["Submitter", "Inquired"],
  ])(
    "should allow '%s' to cancel in the '%s' status if they have the permission",
    (role, status) => {
      const user = userFactory.build({
        _id: "user-1",
        role,
        permissions: ["submission_request:cancel"],
      });
      const application1: Application = applicationFactory.build({
        applicant: applicantFactory.build({ applicantID: user._id }),
        status,
      });
      expect(hasPermission(user, "submission_request", "cancel", application1)).toBe(true);
    }
  );

  it.each<UserRole>(["User", "Submitter"])(
    "should allow '%s' to restore from the 'Canceled' or 'Deleted' status",
    (role) => {
      const user = userFactory.build({
        _id: "user-1",
        role,
        permissions: ["submission_request:cancel"],
      });
      const application: Application = applicationFactory.build({
        applicant: applicantFactory.build({ applicantID: user._id }),
        status: "Canceled",
      });
      expect(hasPermission(user, "submission_request", "cancel", application)).toBe(true);

      const application2: Application = applicationFactory.build({
        applicant: applicantFactory.build({ applicantID: user._id }),
        status: "Deleted",
      });
      expect(hasPermission(user, "submission_request", "cancel", application2)).toBe(true);
    }
  );

  it.each<ApplicationStatus>([
    "New",
    "In Progress",
    "Inquired",
    "Submitted",
    "In Review",
    "Canceled",
    "Deleted",
  ])(
    "should allow all external roles to cancel/restore in the '%s' status if they have the permission",
    (status) => {
      const ExternalRoles: UserRole[] = ["Federal Lead", "Data Commons Personnel", "Admin"];

      ExternalRoles.forEach((role) => {
        const user = userFactory.build({
          _id: "user-1",
          role,
          permissions: ["submission_request:cancel"],
        });
        const application: Application = applicationFactory.build({ status });

        expect(hasPermission(user, "submission_request", "cancel", application)).toBe(true);
      });
    }
  );

  it.each<ApplicationStatus>(["Approved", "Rejected"])(
    "should not allow any role to cancel in the '%s' status",
    (status) => {
      const allRoles: UserRole[] = [
        "Admin",
        "Data Commons Personnel",
        "Federal Lead",
        "Submitter",
        "User",
      ];

      allRoles.forEach((role) => {
        const user = userFactory.build({
          _id: "user-1",
          role,
          permissions: ["submission_request:cancel"],
        });
        const application: Application = applicationFactory.build({
          // NOTE - As a baseline, just make the owner the current user
          applicant: applicantFactory.build({ applicantID: user._id }),
          status,
        });

        expect(hasPermission(user, "submission_request", "cancel", application)).toBe(false);
      });
    }
  );

  it.each<ApplicationStatus>(["Submitted", "In Review", "Rejected", "Approved"])(
    "should NOT allow User/Submitter to cancel in the '%s' status",
    (status) => {
      // User
      const user = userFactory.build({
        _id: "user-1",
        role: "User",
        permissions: ["submission_request:cancel"],
      });
      const application1: Application = applicationFactory.build({
        applicant: applicantFactory.build({ applicantID: user._id }),
        status,
      });
      expect(hasPermission(user, "submission_request", "cancel", application1)).toBe(false);

      // Submitter
      const submitter = userFactory.build({
        _id: "user-1",
        role: "Submitter",
        permissions: ["submission_request:cancel"],
      });
      const application2: Application = applicationFactory.build({
        applicant: applicantFactory.build({ applicantID: submitter._id }),
        status,
      });
      expect(hasPermission(submitter, "submission_request", "cancel", application2)).toBe(false);
    }
  );

  it.each<UserRole>(["User", "Submitter"])(
    "should NOT allow %s to cancel an application if they do not own it",
    (role) => {
      const user = userFactory.build({
        _id: "user-1",
        role,
        permissions: ["submission_request:cancel"],
      });
      const application1: Application = applicationFactory.build({
        status: "In Progress",
        applicant: applicantFactory.build({ applicantID: "other-user" }),
      });
      expect(hasPermission(user, "submission_request", "cancel", application1)).toBe(false);
    }
  );

  it.each<UserRole>(["Admin", "Data Commons Personnel", "Federal Lead", "Submitter", "User"])(
    "should not allow %s to cancel an application without the permission key",
    (role) => {
      const user = userFactory.build({ _id: "user-1", role, permissions: [] });
      const application: Application = applicationFactory.build({ status: "In Progress" });
      expect(hasPermission(user, "submission_request", "cancel", application)).toBe(false);
    }
  );

  it("should not allow an unknown role to cancel another person's application", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "UnknownRole" as UserRole,
      permissions: ["submission_request:cancel"],
    });
    const application: Application = applicationFactory.build({
      applicant: applicantFactory.build({ applicantID: "not-the-owner" }), // They are NOT the owner
      status: "In Progress", // Anyone can cancel in this status
    });
    expect(hasPermission(user, "submission_request", "cancel", application)).toBe(false);
  });

  it("should not allow an unknown role to cancel in a constrained status", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "UnknownRole" as UserRole,
      permissions: ["submission_request:cancel"],
    });
    const application: Application = applicationFactory.build({
      applicant: applicantFactory.build({ applicantID: user._id }), // They ARE the owner
      status: "Submitted", // Low level users cannot cancel in this status
    });
    expect(hasPermission(user, "submission_request", "cancel", application)).toBe(false);
  });

  it("should not allow a user to cancel an application in an unknown status", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Submitter",
      permissions: ["submission_request:cancel"],
    });
    const application: Application = applicationFactory.build({
      applicant: applicantFactory.build({ applicantID: user._id }), // They ARE the owner
      status: "UnknownStatus" as ApplicationStatus,
    });
    expect(hasPermission(user, "submission_request", "cancel", application)).toBe(false);
  });
});

describe("data_submission:create Permission", () => {
  const createSubmission = submissionFactory.build({
    _id: "submission-1",
    studyID: "study-1",
    dataCommons: "commons-1",
    submitterID: "owner-123",
  });

  it("should allow a collaborator (no permission key needed)", () => {
    const user = userFactory.build({ _id: "user-1", role: "User", permissions: [] });
    const submission: Submission = {
      ...createSubmission,
      collaborators: [
        {
          collaboratorID: user._id,
          collaboratorName: "",
          permission: null,
        },
      ],
    };
    expect(hasPermission(user, "data_submission", "create", submission)).toBe(true);
  });

  it("should allow a submitter who is the submission owner WITH 'data_submission:create' key", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Submitter",
      permissions: ["data_submission:create"],
    });
    user._id = "owner-123";
    expect(hasPermission(user, "data_submission", "create", createSubmission)).toBe(true);
  });

  it("should allow a 'Federal Lead' who is the submission owner WITH 'data_submission:create' key", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Federal Lead",
      permissions: ["data_submission:create"],
    });
    user._id = "owner-123";
    expect(hasPermission(user, "data_submission", "create", createSubmission)).toBe(true);
  });

  it("should allow a 'Data Commons Personnel' who is the submission owner WITH 'data_submission:create' key", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Data Commons Personnel",
      permissions: ["data_submission:create"],
    });
    user._id = "owner-123";
    expect(hasPermission(user, "data_submission", "create", createSubmission)).toBe(true);
  });

  it("should allow 'Admin' who is the submission owner WITH 'data_submission:create' key", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Admin",
      permissions: ["data_submission:create"],
    });
    user._id = "owner-123";
    expect(hasPermission(user, "data_submission", "create", createSubmission)).toBe(true);
  });

  it("should deny if user doesn't meet any condition", () => {
    const user = userFactory.build({ _id: "user-1", role: "User", permissions: [] });
    expect(hasPermission(user, "data_submission", "create", createSubmission)).toBe(false);
  });

  it("should return false if submission is missing or undefined", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Admin",
      permissions: ["data_submission:create"],
    });
    expect(hasPermission(user, "data_submission", "create", undefined)).toBe(false);
    expect(hasPermission(user, "data_submission", "create", null)).toBe(false);
  });
});

describe("data_submission:review Permission", () => {
  const reviewSubmission = submissionFactory.build({
    _id: "submission-3",
    studyID: "study-3",
    dataCommons: "commons-3",
  });

  it("should allow a 'Federal Lead' with 'data_submission:review' key if they have the matching study", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Federal Lead",
      permissions: ["data_submission:review"],
    });
    user.studies = [{ _id: "study-3" }];
    expect(hasPermission(user, "data_submission", "review", reviewSubmission)).toBe(true);
  });

  it("should allow a 'Federal Lead' with 'data_submission:review' key if they have the 'All' study", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Federal Lead",
      permissions: ["data_submission:review"],
    });
    user.studies = [{ _id: "All" }];
    expect(hasPermission(user, "data_submission", "review", reviewSubmission)).toBe(true);
  });

  it("should allow 'Data Commons Personnel' with 'data_submission:review' key if they have the matching dataCommons", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Data Commons Personnel",
      permissions: ["data_submission:review"],
    });
    user.dataCommons = ["commons-3"];
    expect(hasPermission(user, "data_submission", "review", reviewSubmission)).toBe(true);
  });

  it("should allow 'Admin' with 'data_submission:review' key", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Admin",
      permissions: ["data_submission:review"],
    });
    expect(hasPermission(user, "data_submission", "review", reviewSubmission)).toBe(true);
  });

  it("should deny if user doesn't meet any condition", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Submitter",
      permissions: ["data_submission:review"],
    });
    expect(hasPermission(user, "data_submission", "review", reviewSubmission)).toBe(false);
  });

  it("should return false if submission is missing or undefined", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Admin",
      permissions: ["data_submission:review"],
    });
    expect(hasPermission(user, "data_submission", "review", undefined)).toBe(false);
    expect(hasPermission(user, "data_submission", "review", null)).toBe(false);
  });
});

describe("data_submission:admin_submit Permission", () => {
  const adminSubmitSubmission = submissionFactory.build({
    _id: "submission-4",
    studyID: "study-4",
    dataCommons: "commons-4",
  });

  it("should allow a 'Federal Lead' with 'data_submission:admin_submit' key if they have the matching study", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Federal Lead",
      permissions: ["data_submission:admin_submit"],
    });
    user.studies = [{ _id: "study-4" }];
    expect(hasPermission(user, "data_submission", "admin_submit", adminSubmitSubmission)).toBe(
      true
    );
  });

  it("should allow a 'Federal Lead' with 'data_submission:admin_submit' key if they have the 'All' study", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Federal Lead",
      permissions: ["data_submission:admin_submit"],
    });
    user.studies = [{ _id: "All" }];
    expect(hasPermission(user, "data_submission", "admin_submit", adminSubmitSubmission)).toBe(
      true
    );
  });

  it("should allow 'Data Commons Personnel' with 'data_submission:admin_submit' key if they have the matching dataCommons", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Data Commons Personnel",
      permissions: ["data_submission:admin_submit"],
    });
    user.dataCommons = ["commons-4"];
    expect(hasPermission(user, "data_submission", "admin_submit", adminSubmitSubmission)).toBe(
      true
    );
  });

  it("should allow 'Admin' with 'data_submission:admin_submit' key", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Admin",
      permissions: ["data_submission:admin_submit"],
    });
    expect(hasPermission(user, "data_submission", "admin_submit", adminSubmitSubmission)).toBe(
      true
    );
  });

  it("should deny if user doesn't meet any condition", () => {
    const user = userFactory.build({ _id: "user-1", role: "User", permissions: [] });
    expect(hasPermission(user, "data_submission", "admin_submit", adminSubmitSubmission)).toBe(
      false
    );
  });

  it("should return false if submission is missing or undefined", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Admin",
      permissions: ["data_submission:admin_submit"],
    });
    expect(hasPermission(user, "data_submission", "admin_submit", undefined)).toBe(false);
    expect(hasPermission(user, "data_submission", "admin_submit", null)).toBe(false);
  });
});

describe("data_submission:confirm Permission", () => {
  const confirmSubmission = submissionFactory.build({
    _id: "submission-5",
    studyID: "study-5",
    dataCommons: "commons-5",
  });

  it("should allow a 'Federal Lead' with 'data_submission:confirm' key if they have the matching study", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Federal Lead",
      permissions: ["data_submission:confirm"],
    });
    user.studies = [{ _id: "study-5" }];
    expect(hasPermission(user, "data_submission", "confirm", confirmSubmission)).toBe(true);
  });

  it("should allow a 'Federal Lead' with 'data_submission:confirm' key if they have the 'All' study", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Federal Lead",
      permissions: ["data_submission:confirm"],
    });
    user.studies = [{ _id: "All" }];
    expect(hasPermission(user, "data_submission", "confirm", confirmSubmission)).toBe(true);
  });

  it("should allow 'Data Commons Personnel' with 'data_submission:confirm' key if they have the matching dataCommons", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Data Commons Personnel",
      permissions: ["data_submission:confirm"],
    });
    user.dataCommons = ["commons-5"];
    expect(hasPermission(user, "data_submission", "confirm", confirmSubmission)).toBe(true);
  });

  it("should allow 'Admin' with 'data_submission:confirm' key", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Admin",
      permissions: ["data_submission:confirm"],
    });
    expect(hasPermission(user, "data_submission", "confirm", confirmSubmission)).toBe(true);
  });

  it("should deny if user doesn't meet any condition", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Submitter",
      permissions: ["data_submission:confirm"],
    });
    expect(hasPermission(user, "data_submission", "confirm", confirmSubmission)).toBe(false);
  });

  it("should return false if submission is missing or undefined", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Admin",
      permissions: ["data_submission:confirm"],
    });
    expect(hasPermission(user, "data_submission", "confirm", undefined)).toBe(false);
    expect(hasPermission(user, "data_submission", "confirm", null)).toBe(false);
  });
});

describe("data_submission:cancel Permission", () => {
  const createSubmission = submissionFactory.build({
    _id: "submission-1",
    submitterID: "owner-123",
    studyID: "study-1",
    dataCommons: "commons-1",
  });

  it("should allow a collaborator (no permission key needed)", () => {
    const user = userFactory.build({ _id: "user-1", role: "User", permissions: [] });
    const submission: Submission = {
      ...createSubmission,
      collaborators: [
        { collaboratorID: user._id, collaboratorName: "Test Collaborator", permission: null },
      ],
    };
    expect(hasPermission(user, "data_submission", "cancel", submission)).toBe(true);
  });

  it("should allow a 'Federal Lead' with 'data_submission:cancel' key if they have the matching study", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Federal Lead",
      permissions: ["data_submission:cancel"],
    });
    user.studies = [{ _id: "study-1" }];
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(true);
  });

  it("should allow a 'Federal Lead' with 'data_submission:cancel' key if they have the 'All' study", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Federal Lead",
      permissions: ["data_submission:cancel"],
    });
    user.studies = [{ _id: "All" }];
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(true);
  });

  it("should deny a 'Federal Lead' with 'data_submission:cancel' key if they do not have a matching study", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Federal Lead",
      permissions: ["data_submission:cancel"],
    });
    user.studies = [{ _id: "study-2" }];
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(false);
  });

  it("should deny a 'Federal Lead' without the 'data_submission:cancel' key even if they have a matching study", () => {
    const user = userFactory.build({ _id: "user-1", role: "Federal Lead", permissions: [] });
    user.studies = [{ _id: "study-1" }];
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(false);
  });

  it("should allow 'Data Commons Personnel' with 'data_submission:cancel' key if they have the matching dataCommons", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Data Commons Personnel",
      permissions: ["data_submission:cancel"],
    });
    user.dataCommons = ["commons-1"];
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(true);
  });

  it("should deny 'Data Commons Personnel' with 'data_submission:cancel' key if they do not have a matching dataCommons", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Data Commons Personnel",
      permissions: ["data_submission:cancel"],
    });
    user.dataCommons = ["commons-2"];
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(false);
  });

  it("should deny 'Data Commons Personnel' without the 'data_submission:cancel' key even if they have matching dataCommons", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Data Commons Personnel",
      permissions: [],
    });
    user.dataCommons = ["commons-1"];
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(false);
  });

  it("should allow 'Admin' with 'data_submission:cancel' key", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Admin",
      permissions: ["data_submission:cancel"],
    });
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(true);
  });

  it("should deny 'Admin' without the 'data_submission:cancel' key", () => {
    const user = userFactory.build({ _id: "user-1", role: "Admin", permissions: [] });
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(false);
  });

  it("should allow a 'Submitter' with 'data_submission:cancel' key if they are the submission owner", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Submitter",
      permissions: ["data_submission:cancel"],
    });
    user._id = "owner-123";
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(true);
  });

  it("should deny a 'Submitter' with 'data_submission:cancel' key if they are not the submission owner", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Submitter",
      permissions: ["data_submission:cancel"],
    });
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(false);
  });

  it("should deny a 'Submitter' without the 'data_submission:cancel' key even if they are the submission owner", () => {
    const user = userFactory.build({ _id: "user-1", role: "Submitter", permissions: [] });
    user._id = "owner-123";
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(false);
  });

  it("should deny permission for 'User' role even if they have the permission key", () => {
    const user = userFactory.build({
      _id: "user-1",
      role: "User",
      permissions: ["data_submission:cancel"],
    });
    expect(hasPermission(user, "data_submission", "cancel", createSubmission)).toBe(false);
  });

  it.each([undefined, null])("should return false if submission is %p", (submissionData) => {
    const user = userFactory.build({
      _id: "user-1",
      role: "Admin",
      permissions: ["data_submission:cancel"],
    });
    expect(hasPermission(user, "data_submission", "cancel", submissionData)).toBe(false);
  });
});
