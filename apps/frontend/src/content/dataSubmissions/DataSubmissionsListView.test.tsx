import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { fireEvent, within } from "@testing-library/react";
import { SnackbarProvider } from "notistack";
import { FC, useMemo } from "react";
import { MemoryRouterProps } from "react-router-dom";
import { axe } from "vitest-axe";

import {
  Context as AuthContext,
  ContextState as AuthContextState,
  Status as AuthStatus,
} from "@/components/Contexts/AuthContext";
import { SearchParamsProvider } from "@/components/Contexts/SearchParamsContext";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { LIST_SUBMISSIONS, ListSubmissionsInput, ListSubmissionsResp } from "@/graphql";
import { TestRouter, act, render, waitFor } from "@/test-utils";

import ListingView from "./DataSubmissionsListView";

type Submission = ListSubmissionsResp["listSubmissions"]["submissions"][number];

const mockDownloadBlob = vi.fn();
const mockFetchAllData = vi.fn();

vi.mock("@/utils", async () => ({
  ...(await vi.importActual("@/utils")),
  downloadBlob: (...args) => mockDownloadBlob(...args),
  fetchAllData: (...args) => mockFetchAllData(...args),
}));

const baseSubmission: Submission = {
  ...submissionFactory.build({
    _id: "sub-123",
    name: "Submission Alpha",
    status: "In Progress",
    archived: false,
    submitterName: "Jane Submitter",
    dataCommonsDisplayName: "CDS",
    intention: "New/Update",
    modelVersion: "1.0",
    conciergeName: "Alex Concierge",
    nodeCount: 10,
    organization: { _id: "org-1", name: "Program 1", abbreviation: "P1" },
    study: { studyName: "Study Name", studyAbbreviation: "STUDY", dbGaPID: "phs001" },
  }),
  submissionRequestID: "app-123",
  canViewSubmissionRequest: true,
};

const getListSubmissionsMock = (
  submissions: Submission[]
): MockedResponse<ListSubmissionsResp, ListSubmissionsInput> => ({
  request: {
    query: LIST_SUBMISSIONS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listSubmissions: {
        submissions,
        organizations: [{ _id: "org-1", name: "Program 1" }],
        submitterNames: ["Jane Submitter"],
        dataCommons: ["CDS"],
        dataCommonsDisplayNames: ["Cancer Data Service"],
        total: submissions.length,
      },
    },
  },
});

type ParentProps = {
  mocks?: MockedResponse[];
  initialEntries?: MemoryRouterProps["initialEntries"];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  mocks = [getListSubmissionsMock([baseSubmission])],
  initialEntries = ["/data-submissions"],
  children,
}: ParentProps) => {
  const authState = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        status: AuthStatus.LOADED,
        isLoggedIn: true,
        user: userFactory.build({
          _id: "current-user",
          role: "Submitter",
          permissions: ["data_submission:view"],
        }),
      }),
    []
  );

  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      <TestRouter initialEntries={initialEntries}>
        <SnackbarProvider>
          <AuthContext.Provider value={authState}>
            <SearchParamsProvider>{children}</SearchParamsProvider>
          </AuthContext.Provider>
        </SnackbarProvider>
      </TestRouter>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadBlob.mockReset();
    mockFetchAllData.mockReset();
    mockFetchAllData.mockResolvedValue([baseSubmission]);
  });

  it("should have no accessibility violations with results", async () => {
    const { container, findByTestId } = render(
      <TestParent>
        <ListingView />
      </TestParent>
    );

    expect(await findByTestId("submission-name-cell-sub-123")).toBeInTheDocument();

    await act(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  it("should have no accessibility violations when empty", async () => {
    const { container, findByText } = render(
      <TestParent mocks={[getListSubmissionsMock([])]}>
        <ListingView />
      </TestParent>
    );

    expect(
      await findByText(
        "You either do not have the appropriate permissions to view data submissions, or there are no data submissions associated with your account."
      )
    ).toBeInTheDocument();

    await act(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadBlob.mockReset();
    mockFetchAllData.mockReset();
    mockFetchAllData.mockResolvedValue([baseSubmission]);
  });

  it("should render banner and table without crashing", async () => {
    const { findByTestId, getByText } = render(
      <TestParent>
        <ListingView />
      </TestParent>
    );

    expect(await findByTestId("submission-name-cell-sub-123")).toBeInTheDocument();

    expect(getByText("Data Submissions")).toBeInTheDocument();
  });

  it("should render all column headers and submission data values", async () => {
    const { findByTestId, getAllByText, getByText } = render(
      <TestParent>
        <ListingView />
      </TestParent>
    );

    await findByTestId("submission-name-cell-sub-123");

    expect(getAllByText("Submission Name").length).toBeGreaterThan(0);
    expect(getAllByText("Submitter").length).toBeGreaterThan(0);
    expect(getAllByText("Data Commons").length).toBeGreaterThan(0);
    expect(getAllByText("Type").length).toBeGreaterThan(0);
    expect(getAllByText("Program").length).toBeGreaterThan(0);
    expect(getAllByText("Study").length).toBeGreaterThan(0);
    expect(getAllByText("Status").length).toBeGreaterThan(0);

    expect(getByText("CDS")).toBeInTheDocument();
    expect(getByText("New/Update")).toBeInTheDocument();
    expect(getByText("Program 1")).toBeInTheDocument();
    expect(getByText("STUDY")).toBeInTheDocument();
    expect(getByText("In Progress")).toBeInTheDocument();
  });

  it("should export all expected columns and values", async () => {
    const { findByTestId, getAllByTestId } = render(
      <TestParent>
        <ListingView />
      </TestParent>
    );

    await findByTestId("submission-name-cell-sub-123");

    const [exportButton] = getAllByTestId("export-data-submissions-button");

    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalled();
    });

    const csvContent: string = mockDownloadBlob.mock.calls[0][0];
    const headerRow = csvContent.split("\n")[0];
    const headers = headerRow.split(",").map((h) => h.replace(/"/g, "").trim());

    expect(headers).toEqual([
      "Data Submission ID",
      "Submission Name",
      "Submitter",
      "Data Commons",
      "Type",
      "Model Version",
      "Program",
      "Study",
      "dbGaP ID",
      "Status",
      "Data Concierge",
      "Record Count",
      "Created Date",
      "Last Updated",
    ]);

    expect(csvContent).toContain("sub-123");
    expect(csvContent).toContain("Submission Alpha");
    expect(csvContent).toContain("Jane Submitter");
    expect(csvContent).toContain("CDS");
    expect(csvContent).toContain("New/Update");
    expect(csvContent).toContain("1.0");
    expect(csvContent).toContain("Program 1");
    expect(csvContent).toContain("STUDY");
    expect(csvContent).toContain("phs001");
    expect(csvContent).toContain("In Progress");
    expect(csvContent).toContain("Alex Concierge");
    expect(csvContent).toContain("10");
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadBlob.mockReset();
    mockFetchAllData.mockReset();
    mockFetchAllData.mockResolvedValue([baseSubmission]);
  });

  it("should render submission name cell with link and copy action for active submission", async () => {
    const { findByTestId } = render(
      <TestParent>
        <ListingView />
      </TestParent>
    );

    const nameCell = await findByTestId("submission-name-cell-sub-123");
    expect(within(nameCell).getByRole("link", { name: "Submission Alpha" })).toHaveAttribute(
      "href",
      "/data-submission/sub-123/upload-activity"
    );
    expect(
      within(nameCell).getByRole("button", {
        name: "Copy Data Submission ID to the clipboard",
      })
    ).toBeInTheDocument();
  });

  it("should show submission name tooltip content when hovering active submission name", async () => {
    const { findByTestId, findByRole } = render(
      <TestParent>
        <ListingView />
      </TestParent>
    );

    const nameCell = await findByTestId("submission-name-cell-sub-123");
    const link = within(nameCell).getByRole("link", { name: "Submission Alpha" });

    fireEvent.mouseOver(link);

    const tooltip = await findByRole("tooltip");
    expect(within(tooltip).getByText("Submission Name:")).toBeInTheDocument();
    expect(within(tooltip).getByText("Submission Alpha")).toBeInTheDocument();
    expect(within(tooltip).getByText("Data Submission ID:")).toBeInTheDocument();
    expect(within(tooltip).getByText("sub-123")).toBeInTheDocument();
  });

  it("should render non-link submission name for deleted submission", async () => {
    const deletedSubmission = {
      ...baseSubmission,
      _id: "sub-999",
      name: "Deleted Submission",
      status: "Deleted",
      archived: false,
    } as Submission;

    const { findByTestId } = render(
      <TestParent mocks={[getListSubmissionsMock([deletedSubmission])]}>
        <ListingView />
      </TestParent>
    );

    const nameCell = await findByTestId("submission-name-cell-sub-999");

    expect(
      within(nameCell).queryByRole("link", { name: "Deleted Submission" })
    ).not.toBeInTheDocument();
    expect(
      within(nameCell).getByRole("button", {
        name: "Copy Data Submission ID to the clipboard",
      })
    ).toBeInTheDocument();
  });

  it("should show submission name tooltip content when hovering disabled submission name", async () => {
    const deletedSubmission = {
      ...baseSubmission,
      _id: "sub-999",
      name: "Deleted",
      status: "Deleted",
      archived: false,
    } as Submission;

    const { findByTestId, findByRole } = render(
      <TestParent mocks={[getListSubmissionsMock([deletedSubmission])]}>
        <ListingView />
      </TestParent>
    );

    const nameCell = await findByTestId("submission-name-cell-sub-999");
    const disabledName = within(nameCell).getByText("Deleted");

    fireEvent.mouseOver(disabledName);

    const tooltip = await findByRole("tooltip");
    expect(within(tooltip).getByText("Submission Name:")).toBeInTheDocument();
    expect(within(tooltip).getByText("Deleted")).toBeInTheDocument();
    expect(within(tooltip).getByText("Data Submission ID:")).toBeInTheDocument();
    expect(within(tooltip).getByText("sub-999")).toBeInTheDocument();
  });
});
