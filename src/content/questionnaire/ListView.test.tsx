import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import React, { FC, useMemo } from "react";
import { MemoryRouterProps } from "react-router-dom";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import {
  Status as AuthStatus,
  Context as AuthContext,
  ContextState as AuthContextState,
} from "../../components/Contexts/AuthContext";
import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import {
  LIST_APPLICATIONS,
  SAVE_APP,
  ListApplicationsResp,
  ListApplicationsInput,
  SaveAppResp,
  SaveAppInput,
} from "../../graphql";
import { TestRouter, act, render, waitFor } from "../../test-utils";

import ListView from "./ListView";

const mockUsePageTitle = vi.fn();
vi.mock("../../hooks/usePageTitle", async () => ({
  ...(await vi.importActual("../../hooks/usePageTitle")),
  default: (p) => mockUsePageTitle(p),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const defaultMocks: MockedResponse[] = [
  {
    request: {
      query: LIST_APPLICATIONS,
      context: { clientName: "backend" },
    },
    variableMatcher: () => true,
    result: {
      data: {
        listApplications: {
          total: 0,
          applications: [],
        },
      },
    },
  },
];

type ParentProps = {
  mocks?: MockedResponse[];
  initialEntries?: MemoryRouterProps["initialEntries"];
  role?: UserRole;
  permissions?: AuthPermissions[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  mocks = defaultMocks,
  initialEntries = ["/"],
  role = "Submitter",
  permissions = [
    "submission_request:view",
    "submission_request:create",
    "submission_request:submit",
  ],
  children,
}: ParentProps) => {
  const baseAuthCtx: AuthContextState = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        status: AuthStatus.LOADED,
        isLoggedIn: role !== null,
        user: userFactory.build({ _id: "current-user", role, permissions }),
      }),
    [role, permissions]
  );

  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      <TestRouter initialEntries={initialEntries}>
        <AuthContext.Provider value={baseAuthCtx}>
          <SearchParamsProvider>{children}</SearchParamsProvider>
        </AuthContext.Provider>
      </TestRouter>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container, getByText } = render(
      <TestParent role="Submitter" permissions={["submission_request:view"]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Submission Requests")).toBeInTheDocument();
    });

    await act(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

describe("ListView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders without crashing", () => {
    const { getByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    expect(getByText("Submission Requests")).toBeInTheDocument();
  });

  it("sets the page title correctly", () => {
    render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    expect(mockUsePageTitle).toHaveBeenCalledWith("Submission Requests");
  });

  it("shows the 'Start a Submission Request' button for users with the required permissions", () => {
    const { getByText } = render(
      <TestParent
        role="Submitter"
        permissions={["submission_request:view", "submission_request:create"]}
      >
        <ListView />
      </TestParent>
    );
    expect(getByText("Start a Submission Request")).toBeInTheDocument();
  });

  it("hides the 'Start a Submission Request' button for users missing the required permissions", () => {
    const { queryByText } = render(
      <TestParent role="Submitter" permissions={["submission_request:view"]}>
        <ListView />
      </TestParent>
    );
    expect(queryByText("Start a Submission Request")).not.toBeInTheDocument();
  });

  it("creates a new submission request when 'Start a Submission Request' button is clicked", async () => {
    const saveAppMock: MockedResponse<SaveAppResp, SaveAppInput> = {
      request: {
        query: SAVE_APP,
      },
      variableMatcher: () => true,
      result: {
        data: {
          saveApplication: {
            _id: "new-application-id",
          } as SaveAppResp["saveApplication"],
        },
      },
    };

    const { getByText, findByText } = render(
      <TestParent role="Submitter" mocks={[...defaultMocks, saveAppMock]}>
        <ListView />
      </TestParent>
    );

    const button = getByText("Start a Submission Request");
    userEvent.click(button);

    const confirmBtn = await findByText("I Read and Accept");
    userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/submission-request/new-application-id", {
        state: { from: "/submission-requests" },
      });
    });
  });

  it("shows an error when creating a new submission request fails", async () => {
    const saveAppMock: MockedResponse<SaveAppResp, SaveAppInput> = {
      request: {
        query: SAVE_APP,
      },
      variableMatcher: () => true,
      error: new Error("Error creating application"),
    };

    const { getByText, findByText } = render(
      <TestParent role="Submitter" mocks={[...defaultMocks, saveAppMock]}>
        <ListView />
      </TestParent>
    );

    const button = getByText("Start a Submission Request");
    userEvent.click(button);

    const confirmBtn = await findByText("I Read and Accept");
    userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("", {
        state: {
          error: "Unable to create a submission request. Please try again later",
        },
      });
    });
  });

  it("fetches and displays a list of applications", async () => {
    const listApplicationsMock: MockedResponse<ListApplicationsResp, ListApplicationsInput> = {
      request: {
        query: LIST_APPLICATIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listApplications: {
            total: 1,
            applications: [
              {
                _id: "application-id",
                applicant: { applicantName: "applicant-name-really-long", applicantID: "user-id" },
                studyAbbreviation: "study-long-abbr",
                programName: "program-long-name",
                programAbbreviation: "PLN",
                programDescription: "A program description",
                status: "New",
                submittedDate: "2021-01-01T00:00:00Z",
                updatedAt: "2021-01-02T00:00:00Z",
              } as Application,
            ],
            programs: [],
            studies: [],
          },
        },
      },
    };

    const { getByText } = render(
      <TestParent role="Submitter" mocks={[listApplicationsMock]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("applicant-...")).toBeInTheDocument();
      expect(getByText("study-long...")).toBeInTheDocument();
      expect(getByText("program-lo...")).toBeInTheDocument();
      expect(getByText("New")).toBeInTheDocument();
    });
  });

  it("should replace Study value with NA when null", async () => {
    const listApplicationsMock: MockedResponse<ListApplicationsResp, ListApplicationsInput> = {
      request: {
        query: LIST_APPLICATIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listApplications: {
            total: 1,
            applications: [
              {
                _id: "application-id",
                applicant: { applicantName: "John Doe", applicantID: "user-id" },
                studyAbbreviation: null,
                programName: "Program1",
              } as Application,
            ],
            programs: [],
            studies: [],
          },
        },
      },
    };

    const { getByText } = render(
      <TestParent role="Submitter" mocks={[listApplicationsMock]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("John Doe")).toBeInTheDocument();
      expect(getByText("NA")).toBeInTheDocument();
    });
  });

  it("should replace Program value with NA when null", async () => {
    const listApplicationsMock: MockedResponse<ListApplicationsResp, ListApplicationsInput> = {
      request: {
        query: LIST_APPLICATIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listApplications: {
            total: 1,
            applications: [
              {
                _id: "application-id",
                applicant: { applicantName: "John Doe", applicantID: "user-id" },
                studyAbbreviation: "STUDY",
                programName: null,
              } as Application,
            ],
            programs: [],
            studies: [],
          },
        },
      },
    };

    const { getByText } = render(
      <TestParent role="Submitter" mocks={[listApplicationsMock]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("John Doe")).toBeInTheDocument();
      expect(getByText("NA")).toBeInTheDocument();
    });
  });

  it("should display a icon and tooltip if the application has pending conditions", async () => {
    const listApplicationsMock: MockedResponse<ListApplicationsResp, ListApplicationsInput> = {
      request: {
        query: LIST_APPLICATIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listApplications: {
            total: 1,
            applications: [
              {
                _id: "application-id",
                applicant: { applicantName: "John Doe", applicantID: "user-id" },
                status: "Approved",
                studyAbbreviation: "STUDY",
                conditional: true,
                pendingConditions: ["Pending condition #1"],
              } as Application,
            ],
            programs: [],
            studies: [],
          },
        },
      },
    };

    const { getByTestId, getByRole, queryByRole } = render(
      <TestParent role="Submitter" mocks={[listApplicationsMock]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("pending-conditions-icon")).toBeInTheDocument();
    });

    userEvent.hover(getByTestId("pending-conditions-icon"));

    await waitFor(() => {
      expect(getByRole("tooltip")).toBeInTheDocument();
    });

    expect(getByRole("tooltip")).toHaveTextContent("Pending condition #1");

    userEvent.unhover(getByTestId("pending-conditions-icon"));

    await waitFor(() => {
      expect(queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  it("shows an error message when the listApplications query fails", async () => {
    const listApplicationsMock: MockedResponse<ListApplicationsResp, ListApplicationsInput> = {
      request: {
        query: LIST_APPLICATIONS,
      },
      variableMatcher: () => true,
      error: new Error("Error fetching applications"),
    };

    const { getByText } = render(
      <TestParent role="Submitter" mocks={[listApplicationsMock]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("An error occurred while loading the data.")).toBeInTheDocument();
    });
  });

  it("displays the 'Resume' action button for appropriate users and application statuses", async () => {
    const listApplicationsMock: MockedResponse<ListApplicationsResp, ListApplicationsInput> = {
      request: {
        query: LIST_APPLICATIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listApplications: {
            total: 1,
            applications: [
              {
                _id: "application-id",
                applicant: { applicantName: "John Doe", applicantID: "current-user" },
                studyAbbreviation: "Study1",
                programName: "Program1",
                programAbbreviation: "P1",
                programDescription: "A program description",
                status: "New",
                submittedDate: "2021-01-01T00:00:00Z",
                updatedAt: "2021-01-02T00:00:00Z",
              } as Application,
            ],
            programs: [],
            studies: [],
          },
        },
      },
    };

    const { getByText } = render(
      <TestParent role="Submitter" mocks={[listApplicationsMock]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Resume")).toBeInTheDocument();
    });
  });

  it("displays the 'Review' action button for Federal Lead on submitted applications", async () => {
    const listApplicationsMock: MockedResponse<ListApplicationsResp, ListApplicationsInput> = {
      request: {
        query: LIST_APPLICATIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listApplications: {
            total: 1,
            applications: [
              {
                _id: "application-id",
                applicant: { applicantName: "John Doe", applicantID: "other-user-id" },
                studyAbbreviation: "Study1",
                programName: "Program1",
                programAbbreviation: "P1",
                programDescription: "A program description",
                status: "Submitted",
                submittedDate: "2021-01-01T00:00:00Z",
                updatedAt: "2021-01-02T00:00:00Z",
              } as Application,
            ],
            programs: [],
            studies: [],
          },
        },
      },
    };

    const { getByText } = render(
      <TestParent
        role="Federal Lead"
        permissions={[
          "submission_request:view",
          "submission_request:review",
          "submission_request:submit",
        ]}
        mocks={[listApplicationsMock]}
      >
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Review")).toBeInTheDocument();
    });
  });

  it("displays the 'View' action button for other users and application statuses", async () => {
    const listApplicationsMock: MockedResponse<ListApplicationsResp, ListApplicationsInput> = {
      request: {
        query: LIST_APPLICATIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listApplications: {
            total: 1,
            applications: [
              {
                _id: "application-id",
                applicant: { applicantName: "John Doe", applicantID: "other-user-id" },
                studyAbbreviation: "Study1",
                programName: "Program1",
                programAbbreviation: "P1",
                programDescription: "A program description",
                status: "Approved",
                submittedDate: "2021-01-01T00:00:00Z",
                updatedAt: "2021-01-02T00:00:00Z",
                createdAt: "",
                history: [],
                controlledAccess: false,
                openAccess: false,
                ORCID: null,
                PI: null,
                questionnaireData: null,
              } as Application,
            ],
            programs: [],
            studies: [],
          },
        },
      },
    };

    const { getByText } = render(
      <TestParent role={"fake-role" as UserRole} mocks={[listApplicationsMock]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("View")).toBeInTheDocument();
    });
  });

  it("formats dates correctly in the table", async () => {
    const listApplicationsMock: MockedResponse<ListApplicationsResp, ListApplicationsInput> = {
      request: {
        query: LIST_APPLICATIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listApplications: {
            total: 1,
            applications: [
              {
                _id: "application-id",
                applicant: { applicantName: "John Doe", applicantID: "user-id" },
                studyAbbreviation: "Study1",
                programName: "Program1",
                programAbbreviation: "P1",
                programDescription: "A program description",
                status: "New",
                submittedDate: "2021-01-01T12:00:00Z",
                updatedAt: "2021-01-02T15:30:00Z",
                createdAt: "2021-01-02T15:30:00Z",
              } as Application,
            ],
            programs: [],
            studies: [],
          },
        },
      },
    };

    const { getByText } = render(
      <TestParent role="Submitter" mocks={[listApplicationsMock]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("1/1/2021")).toBeInTheDocument();
      expect(getByText("1/2/2021")).toBeInTheDocument();
    });
  });
});
