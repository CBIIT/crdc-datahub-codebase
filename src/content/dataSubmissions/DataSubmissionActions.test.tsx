import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { useMemo } from "react";
import { Mock } from "vitest";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { render } from "@/test-utils";

import {
  Context as AuthContext,
  ContextState as AuthContextState,
} from "../../components/Contexts/AuthContext";
import { SubmissionContext, SubmissionCtxState } from "../../components/Contexts/SubmissionContext";
import { shouldDisableRelease } from "../../utils";

import DataSubmissionActions from "./DataSubmissionActions";

const shouldDisableReleaseMock = shouldDisableRelease as Mock;

vi.mock("../../utils", async () => {
  const actual = await vi.importActual<typeof import("../../utils")>("../../utils");
  return {
    ...actual,
    shouldEnableSubmit: vi.fn(),
    shouldDisableRelease: vi.fn(),
  };
});

type TestParentProps = {
  submission?: Partial<Submission>;
  user?: Partial<User>;
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const TestParent: React.FC<TestParentProps> = ({
  mocks = [],
  submission = {},
  user = { permissions: ["data_submission:view", "data_submission:create"] },
  children,
}) => {
  const submissionCtxValue = useMemo<SubmissionCtxState>(
    () =>
      submissionCtxStateFactory.build({
        data: {
          getSubmission: submissionFactory.build({ submitterID: "current-user", ...submission }),
          submissionStats: {
            stats: [],
          },
          getSubmissionAttributes: null,
        },
      }),
    [submission]
  );

  const authCtxValue = useMemo<AuthContextState>(
    () => authCtxStateFactory.build({ user: userFactory.build({ _id: "current-user", ...user }) }),
    [user]
  );

  return (
    <MockedProvider mocks={mocks} showWarnings>
      <AuthContext.Provider value={authCtxValue}>
        <SubmissionContext.Provider value={submissionCtxValue}>
          {children}
        </SubmissionContext.Provider>
      </AuthContext.Provider>
    </MockedProvider>
  );
};

describe("Implementation Requirements - Release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { disable: false, requireAlert: false, result: "enable" },
    { disable: false, requireAlert: true, result: "enable" },
    { disable: true, requireAlert: false, result: "disable" },
    { disable: true, requireAlert: true, result: "disable" },
  ])(
    "should $result Release button when shouldDisableRelease returns { disable: $disable, requireAlert: $requireAlert }",
    ({ disable, requireAlert, result }) => {
      shouldDisableReleaseMock.mockReturnValue({ disable, requireAlert });

      const { getByRole } = render(
        <TestParent
          user={{
            _id: "other-user",
            role: "Admin",
            permissions: ["data_submission:view", "data_submission:review"],
          }}
          submission={{
            _id: "submission-id",
            status: "Submitted",
            metadataValidationStatus: "Passed",
            fileValidationStatus: "Passed",
            crossSubmissionStatus: "Error",
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              Submitted: ["submitted-id"],
              Released: [],
            }),
          }}
        >
          <DataSubmissionActions onAction={vi.fn()} />
        </TestParent>
      );

      const releaseBtn = getByRole("button", { name: /release/i });

      if (result === "enable") {
        expect(releaseBtn).toBeEnabled();
        return;
      }

      expect(releaseBtn).toBeDisabled();
    }
  );

  it("should show data commons within Release button label", () => {
    shouldDisableReleaseMock.mockReturnValue({ disable: false, requireAlert: false });

    const { getByRole } = render(
      <TestParent
        user={{
          _id: "other-user",
          role: "Admin",
          permissions: ["data_submission:view", "data_submission:review"],
        }}
        submission={{
          _id: "submission-id",
          status: "Submitted",
          metadataValidationStatus: "Passed",
          fileValidationStatus: "Passed",
          crossSubmissionStatus: "Error",
          dataCommonsDisplayName: "DC-1",
          otherSubmissions: JSON.stringify({
            "In Progress": [],
            Submitted: ["submitted-id"],
            Released: [],
          }),
        }}
      >
        <DataSubmissionActions onAction={vi.fn()} />
      </TestParent>
    );

    const releaseBtn = getByRole("button", {
      name: "Release to DC-1",
    });
    expect(releaseBtn).toBeInTheDocument();
    expect(releaseBtn).toHaveTextContent("Release to DC-1");
  });
});

describe("Implementation Requirements - Withdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show a tooltip on the enabled Withdraw button", async () => {
    const { getByRole, findByRole } = render(
      <TestParent
        user={{
          _id: "submission-owner",
          role: "Submitter",
          permissions: ["data_submission:view", "data_submission:create"],
        }}
        submission={{
          _id: "submission-id",
          status: "Submitted",
          submitterID: "submission-owner",
        }}
      >
        <DataSubmissionActions onAction={vi.fn()} />
      </TestParent>
    );

    const withdrawBtn = getByRole("button", { name: /withdraw/i });
    expect(withdrawBtn).toBeEnabled();

    userEvent.hover(withdrawBtn);
    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(
      "Withdraw will reverse the submission and control will return to the Submitter."
    );
  });
});
