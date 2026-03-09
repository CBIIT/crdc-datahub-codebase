import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { Context as AuthContext } from "@/components/Contexts/AuthContext";
import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { LIST_APPLICATIONS, ListApplicationsInput, ListApplicationsResp } from "@/graphql";
import { render, fireEvent, waitFor } from "@/test-utils";

import ExportApplicationsButton from "./index";

type ParentProps = {
  mocks?: MockedResponse[];
  permissions?: AuthPermissions[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  mocks = [],
  permissions = ["submission_request:view"],
  children,
}: ParentProps) => {
  const mockAuthState = useMemo(
    () =>
      authCtxStateFactory.build({
        isLoggedIn: true,
        user: userFactory.build({
          permissions,
        }),
      }),
    []
  );

  return (
    <MockedProvider mocks={mocks} showWarnings>
      <AuthContext.Provider value={mockAuthState}>{children}</AuthContext.Provider>
    </MockedProvider>
  );
};

const mockDownloadBlob = vi.fn();
vi.mock("../../utils", async () => ({
  ...(await vi.importActual("../../utils")),
  downloadBlob: (...args) => mockDownloadBlob(...args),
}));

describe("Accessibility", () => {
  it("should not have accessibility violations", async () => {
    const { container, getByTestId } = render(
      <TestParent>
        <ExportApplicationsButton scope={null} />
      </TestParent>
    );

    expect(getByTestId("export-applications-button")).toBeEnabled();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have accessibility violations (disabled)", async () => {
    const { container, getByTestId } = render(
      <TestParent>
        <ExportApplicationsButton disabled scope={null} />
      </TestParent>
    );

    expect(getByTestId("export-applications-button")).toBeDisabled();

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should handle network errors when fetching the dataset", async () => {
    const mocks: MockedResponse<ListApplicationsResp, ListApplicationsInput>[] = [
      {
        request: {
          query: LIST_APPLICATIONS,
        },
        variableMatcher: () => true,
        error: new Error("Simulated network error"),
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportApplicationsButton scope={null} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-applications-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! An error occurred while exporting the Submission Requests.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should handle GraphQL errors when fetching the dataset", async () => {
    const mocks: MockedResponse<ListApplicationsResp, ListApplicationsInput>[] = [
      {
        request: {
          query: LIST_APPLICATIONS,
        },
        variableMatcher: () => true,
        result: {
          errors: [new GraphQLError("Simulated GraphQL error")],
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportApplicationsButton scope={null} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-applications-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! An error occurred while exporting the Submission Requests.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should gracefully notify the user when no data was returned", async () => {
    const mocks: MockedResponse<ListApplicationsResp, ListApplicationsInput>[] = [
      {
        request: {
          query: LIST_APPLICATIONS,
        },
        variableMatcher: () => true,
        result: {
          data: {
            listApplications: {
              applications: [],
              programs: [],
              studies: [],
              total: 0,
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportApplicationsButton scope={null} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-applications-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! No data was returned for the selected filters.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should forward the current filter scope to the API request", async () => {
    const mockMatcher = vi.fn().mockReturnValue(true);

    const mocks: MockedResponse<ListApplicationsResp, ListApplicationsInput>[] = [
      {
        request: {
          query: LIST_APPLICATIONS,
        },
        variableMatcher: mockMatcher,
        result: {
          data: {
            listApplications: null,
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportApplicationsButton
          scope={{
            orderBy: "createdAt",
            programName: "a program",
            sortDirection: "asc",
            statuses: ["Approved"],
            studyName: "study xyz",
            submitterName: "mock submitter",
          }}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-applications-button"));

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: "createdAt",
          programName: "a program",
          sortDirection: "asc",
          statuses: ["Approved"],
          studyName: "study xyz",
          submitterName: "mock submitter",
        })
      );
    });
  });
});

describe("Implementation Requirements", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should have a tooltip present on the button", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent>
        <ExportApplicationsButton scope={null} />
      </TestParent>
    );

    userEvent.hover(getByTestId("export-applications-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Export the current list of Submission Requests to CSV.");
  });

  it("should have a descriptive tooltip present on the disabled button", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent>
        <ExportApplicationsButton scope={null} disabled />
      </TestParent>
    );

    userEvent.hover(getByTestId("export-applications-button").parentElement, null, {
      skipPointerEventsCheck: true,
    });

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(
      "No results to export. You either don't have access to any Submission Requests, or no results match your filters."
    );
  });

  it("should include a timestamp in the filename when exporting", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2024-06-15T12:34:56Z"));

    const mocks: MockedResponse<ListApplicationsResp, ListApplicationsInput>[] = [
      {
        request: {
          query: LIST_APPLICATIONS,
        },
        variableMatcher: () => true,
        result: {
          data: {
            listApplications: {
              applications: applicationFactory.build(2),
              programs: [],
              studies: [],
              total: 2,
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportApplicationsButton scope={null} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-applications-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.any(String),
        "crdc-submission-requests-2024-06-15-12-34-56.csv",
        expect.any(String)
      );
    });

    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("should include pending conditions in the export file", async () => {
    const mocks: MockedResponse<ListApplicationsResp, ListApplicationsInput>[] = [
      {
        request: {
          query: LIST_APPLICATIONS,
        },
        variableMatcher: () => true,
        result: {
          data: {
            listApplications: {
              applications: [
                applicationFactory.build({
                  applicant: applicantFactory.build({ applicantName: "John Doe" }),
                  pendingConditions: [
                    "mock-pending-cond1",
                    "mock-pending-cond2",
                    "mock-pending-cond3",
                  ],
                }),
                applicationFactory.build({
                  applicant: applicantFactory.build({ applicantName: "Jane Smith" }),
                  pendingConditions: [],
                }),
              ],
              programs: [],
              studies: [],
              total: 2,
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportApplicationsButton scope={null} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-applications-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalled();
    });

    const csvContent = mockDownloadBlob.mock.calls[0][0];
    expect(csvContent).toContain("- mock-pending-cond1");
    expect(csvContent).toContain("- mock-pending-cond2");
    expect(csvContent).toContain("- mock-pending-cond3");
  });

  it("should not render the button for users without the correct permissions", async () => {
    const { queryByTestId } = render(
      <TestParent permissions={[]}>
        <ExportApplicationsButton scope={null} />
      </TestParent>
    );

    expect(queryByTestId("export-applications-button")).not.toBeInTheDocument();
  });
});
