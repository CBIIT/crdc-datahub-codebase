import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { Context as AuthContext } from "@/components/Contexts/AuthContext";
import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import {
  LIST_APPROVED_STUDIES,
  ListApprovedStudiesInput,
  ListApprovedStudiesResp,
} from "@/graphql";
import { render, fireEvent, waitFor } from "@/test-utils";

import ExportStudiesButton from "./index";

type ParentProps = {
  mocks?: MockedResponse[];
  permissions?: AuthPermissions[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  mocks = [],
  permissions = ["study:manage"],
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
vi.mock("@/utils", async () => ({
  ...(await vi.importActual("@/utils")),
  downloadBlob: (...args) => mockDownloadBlob(...args),
}));

describe("Accessibility", () => {
  it("should not have accessibility violations", async () => {
    const { container, getByTestId } = render(
      <TestParent>
        <ExportStudiesButton scope={null} />
      </TestParent>
    );

    expect(getByTestId("export-studies-button")).toBeEnabled();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have accessibility violations (disabled)", async () => {
    const { container, getByTestId } = render(
      <TestParent>
        <ExportStudiesButton disabled scope={null} />
      </TestParent>
    );

    expect(getByTestId("export-studies-button")).toBeDisabled();

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should handle network errors when fetching the dataset", async () => {
    const mocks: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput>[] = [
      {
        request: {
          query: LIST_APPROVED_STUDIES,
        },
        variableMatcher: () => true,
        error: new Error("Simulated network error"),
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportStudiesButton scope={null} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-studies-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! An error occurred while exporting the Studies.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should handle GraphQL errors when fetching the dataset", async () => {
    const mocks: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput>[] = [
      {
        request: {
          query: LIST_APPROVED_STUDIES,
        },
        variableMatcher: () => true,
        result: {
          errors: [new GraphQLError("Simulated GraphQL error")],
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportStudiesButton scope={null} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-studies-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! An error occurred while exporting the Studies.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should gracefully notify the user when no data was returned", async () => {
    const mocks: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput>[] = [
      {
        request: {
          query: LIST_APPROVED_STUDIES,
        },
        variableMatcher: () => true,
        result: {
          data: {
            listApprovedStudies: {
              studies: [],
              total: 0,
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportStudiesButton scope={null} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-studies-button"));

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

    const mocks: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput>[] = [
      {
        request: {
          query: LIST_APPROVED_STUDIES,
        },
        variableMatcher: mockMatcher,
        result: {
          data: {
            listApprovedStudies: null,
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportStudiesButton
          scope={{
            orderBy: "createdAt",
            sortDirection: "asc",
            dbGaPID: "phs001234",
            controlledAccess: "Controlled",
            study: "mock study",
            programID: "mock-program-id",
            statuses: ["Active"],
          }}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-studies-button"));

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: "createdAt",
          sortDirection: "asc",
          dbGaPID: "phs001234",
          controlledAccess: "Controlled",
          study: "mock study",
          programID: "mock-program-id",
          statuses: ["Active"],
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
        <ExportStudiesButton scope={null} />
      </TestParent>
    );

    userEvent.hover(getByTestId("export-studies-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Export the current list of Studies to CSV.");
  });

  it("should have a descriptive tooltip present on the disabled button", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent>
        <ExportStudiesButton scope={null} disabled />
      </TestParent>
    );

    userEvent.hover(getByTestId("export-studies-button").parentElement, null, {
      skipPointerEventsCheck: true,
    });

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("No results to export. No studies match your filters.");
  });

  it("should include a timestamp in the filename when exporting", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2024-06-15T12:34:56Z"));

    const mocks: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput>[] = [
      {
        request: {
          query: LIST_APPROVED_STUDIES,
        },
        variableMatcher: () => true,
        result: {
          data: {
            listApprovedStudies: {
              studies: approvedStudyFactory.build(2),
              total: 2,
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportStudiesButton scope={null} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-studies-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.any(String),
        "crdc-manage-studies-2024-06-15-12-34-56.csv",
        expect.any(String)
      );
    });

    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("should export all of the required columns", async () => {
    const mocks: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput>[] = [
      {
        request: {
          query: LIST_APPROVED_STUDIES,
        },
        variableMatcher: () => true,
        result: {
          data: {
            listApprovedStudies: {
              studies: [
                approvedStudyFactory.build({
                  studyName: "mock study name",
                  studyAbbreviation: "MSN",
                  dbGaPID: "phs009999",
                  controlledAccess: true,
                  openAccess: true,
                  PI: "Doe, John",
                  ORCID: "0000-0001-2345-6789",
                  program: organizationFactory.build({
                    name: "mock program",
                  }),
                  primaryContact: userFactory.build({
                    firstName: "Jane",
                    lastName: "Smith",
                  }),
                  status: "Active",
                  createdAt: "2024-06-15T12:34:56Z",
                }),
              ],
              total: 1,
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportStudiesButton scope={null} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-studies-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalled();
    });

    const csvContent: string = mockDownloadBlob.mock.calls[0][0];
    const [headers, row] = csvContent.split("\r\n");

    expect(headers).toBe(
      '"Name","Acronym","dbGaPID","Access Type","Principal Investigator","ORCID","Program","Data Concierge","Status","Created Date"'
    );
    expect(row).toContain('"mock study name"');
    expect(row).toContain('"MSN"');
    expect(row).toContain('"phs009999"');
    expect(row).toContain('"Doe, John"');
    expect(row).toContain('"0000-0001-2345-6789"');
    expect(row).toContain('"mock program"');
    expect(row).toContain('"Jane Smith"');
    expect(row).toContain('"Active"');
  });

  it("should not render the button for users without the correct permissions", async () => {
    const { queryByTestId } = render(
      <TestParent permissions={[]}>
        <ExportStudiesButton scope={null} />
      </TestParent>
    );

    expect(queryByTestId("export-studies-button")).not.toBeInTheDocument();
  });
});
