import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { FC } from "react";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { LIST_SUBMISSIONS, ListSubmissionsInput, ListSubmissionsResp } from "@/graphql";
import { render, waitFor } from "@/test-utils";

import { Status as AuthStatus, useAuthContext } from "../Contexts/AuthContext";
import { Column } from "../GenericTable";

import ExportSubmissionsButton from "./index";

type Submission = ListSubmissionsResp["listSubmissions"]["submissions"][number];

const mockDownloadBlob = vi.fn();
const mockFetchAllData = vi.fn();

vi.mock("@/utils", async () => ({
  ...(await vi.importActual("@/utils")),
  downloadBlob: (...args) => mockDownloadBlob(...args),
  fetchAllData: (...args) => mockFetchAllData(...args),
}));

vi.mock("../Contexts/AuthContext", async () => ({
  ...(await vi.importActual("../Contexts/AuthContext")),
  useAuthContext: vi.fn(),
}));

const mockUseAuthContext = useAuthContext as ReturnType<typeof vi.fn>;

const mockSubmissions = submissionFactory.build(10, (idx) => ({
  _id: `submission-${idx}`,
  name: `Submission ${idx}`,
  submitterName: `Submitter ${idx}`,
  dataCommonsDisplayName: "GDC",
  intention: "New/Update",
  modelVersion: "1.0.0",
  organization: organizationFactory.pick(["_id", "name", "abbreviation"]).build({
    _id: `org-${idx}`,
    name: `Organization ${idx}`,
    abbreviation: `ORG-${idx}`,
  }),
  studyAbbreviation: `STUDY-${idx}`,
  dbGaPID: `phs00${idx}`,
  status: "In Progress",
  conciergeName: `Concierge ${idx}`,
  nodeCount: 100 + idx,
  dataFileSize: { size: 1024 * (idx + 1), formatted: `${idx + 1} KB` },
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
}));

const listSubmissionsMock: MockedResponse<ListSubmissionsResp, ListSubmissionsInput> = {
  request: {
    query: LIST_SUBMISSIONS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listSubmissions: {
        total: 10,
        submissions: mockSubmissions,
        organizations: [],
        submitterNames: [],
        dataCommons: [],
        dataCommonsDisplayNames: [],
      },
    },
  },
};

type MockParentProps = {
  mocks: MockedResponse[];
  children?: React.ReactNode;
};

const MockParent: FC<MockParentProps> = ({ mocks, children }) => (
  <MockedProvider mocks={mocks}>{children}</MockedProvider>
);

const defaultScope = {
  organization: "All",
  status: ["In Progress" as const],
  dataCommons: "All",
  name: "",
  dbGaPID: "",
  submitterName: "All",
  sortDirection: "desc" as const,
  orderBy: "updatedAt",
};

const defaultColumns: Column<Submission>[] = [
  {
    label: "Submission Name",
    renderValue: (a) => a.name,
    field: "name",
    exportValue: (a) => ({ label: "Submission Name", value: a.name }),
  },
  {
    label: "Submitter",
    renderValue: (a) => a.submitterName,
    field: "submitterName",
    exportValue: (a) => ({ label: "Submitter", value: a.submitterName }),
  },
  {
    label: "Data Commons",
    renderValue: (a) => a.dataCommonsDisplayName,
    field: "dataCommonsDisplayName",
    exportValue: (a) => ({ label: "Data Commons", value: a.dataCommonsDisplayName }),
  },
  {
    label: "Type",
    renderValue: (a) => a.intention,
    field: "intention",
    exportValue: (a) => ({ label: "Type", value: a.intention }),
  },
  {
    label: "Model Version",
    renderValue: (a) => a.modelVersion,
    field: "modelVersion",
    exportValue: (a) => ({ label: "Model Version", value: a.modelVersion }),
  },
  {
    label: "Program",
    renderValue: (a) => a.organization?.name ?? "NA",
    fieldKey: "organization.name",
    exportValue: (a) => ({ label: "Program", value: a.organization?.name ?? "" }),
  },
  {
    label: "Study",
    renderValue: (a) => a.studyAbbreviation,
    field: "studyAbbreviation",
    exportValue: (a) => ({ label: "Study", value: a.studyAbbreviation }),
  },
  {
    label: "dbGaP ID",
    renderValue: (a) => a.dbGaPID,
    field: "dbGaPID",
    exportValue: (a) => ({ label: "dbGaP ID", value: a.dbGaPID }),
  },
  {
    label: "Status",
    renderValue: (a) => a.status,
    field: "status",
    exportValue: (a) => ({ label: "Status", value: a.status }),
  },
  {
    label: "Data Concierge",
    renderValue: (a) => a.conciergeName,
    field: "conciergeName",
    exportValue: (a) => ({ label: "Data Concierge", value: a.conciergeName }),
  },
  {
    label: "Record Count",
    renderValue: (a) => a.nodeCount,
    field: "nodeCount",
    exportValue: (a) => ({ label: "Record Count", value: a.nodeCount }),
  },
  {
    label: "Data File Size",
    renderValue: (a) => a.dataFileSize.formatted,
    fieldKey: "dataFileSize.size",
    exportValue: (a) => ({ label: "Data File Size", value: a.dataFileSize.formatted }),
  },
  {
    label: "Created Date",
    renderValue: (a) => a.createdAt,
    field: "createdAt",
    exportValue: (a) => ({ label: "Created Date", value: a.createdAt }),
  },
  {
    label: "Last Updated",
    renderValue: (a) => a.updatedAt,
    field: "updatedAt",
    exportValue: (a) => ({ label: "Last Updated", value: a.updatedAt }),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockDownloadBlob.mockReset();
  mockFetchAllData.mockReset();
  mockFetchAllData.mockResolvedValue(mockSubmissions);

  mockUseAuthContext.mockReturnValue(
    authCtxStateFactory.build({
      user: userFactory.build({
        _id: "test-user",
        role: "Admin",
        permissions: ["data_submission:view"],
      }),
      status: AuthStatus.LOADED,
      isLoggedIn: true,
    })
  );
});

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(
      <ExportSubmissionsButton scope={defaultScope} hasData visibleColumns={defaultColumns} />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations (disabled)", async () => {
    const { container, getByTestId } = render(
      <ExportSubmissionsButton
        scope={defaultScope}
        hasData={false}
        visibleColumns={defaultColumns}
      />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    expect(getByTestId("export-data-submissions-button")).toBeDisabled();

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { getByTestId } = render(
      <ExportSubmissionsButton scope={defaultScope} hasData visibleColumns={defaultColumns} />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    expect(getByTestId("export-data-submissions-button")).toBeInTheDocument();
  });

  it("should be disabled when hasData is false", () => {
    const { getByTestId } = render(
      <ExportSubmissionsButton
        scope={defaultScope}
        hasData={false}
        visibleColumns={defaultColumns}
      />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    expect(getByTestId("export-data-submissions-button")).toBeDisabled();
  });

  it("should be enabled when hasData is true", () => {
    const { getByTestId } = render(
      <ExportSubmissionsButton scope={defaultScope} hasData visibleColumns={defaultColumns} />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    expect(getByTestId("export-data-submissions-button")).toBeEnabled();
  });

  it("should invoke fetchAllData with correct parameters", async () => {
    const { getByTestId } = render(
      <ExportSubmissionsButton scope={defaultScope} hasData visibleColumns={defaultColumns} />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    const exportButton = getByTestId("export-data-submissions-button");

    userEvent.click(exportButton);

    await waitFor(() => {
      expect(mockFetchAllData).toHaveBeenCalledTimes(1);
    });

    const [, scope] = mockFetchAllData.mock.calls[0];
    expect(scope).toEqual(defaultScope);
  });
});

describe("Implementation Requirements", () => {
  it("should have a tooltip with correct text when enabled", async () => {
    const { getByTestId, findByRole } = render(
      <ExportSubmissionsButton scope={defaultScope} hasData visibleColumns={defaultColumns} />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    userEvent.hover(getByTestId("export-data-submissions-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Export the current list of Data Submissions to CSV.");

    userEvent.unhover(getByTestId("export-data-submissions-button"));

    await waitFor(() => {
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  it("should have a tooltip with correct text when disabled", async () => {
    const { getByTestId, findByRole } = render(
      <ExportSubmissionsButton
        scope={defaultScope}
        hasData={false}
        visibleColumns={defaultColumns}
      />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    userEvent.hover(getByTestId("export-data-submissions-tooltip"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toHaveTextContent("No results to export.");

    userEvent.unhover(getByTestId("export-data-submissions-tooltip"));

    await waitFor(() => {
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  it("should be disabled while downloading", async () => {
    mockFetchAllData.mockImplementation(() => new Promise(() => {}));

    const { getByTestId } = render(
      <ExportSubmissionsButton scope={defaultScope} hasData visibleColumns={defaultColumns} />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    const button = getByTestId("export-data-submissions-button");

    expect(button).toBeEnabled();

    userEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });

  it("should download the CSV with the correct filename format", async () => {
    const { getByTestId } = render(
      <ExportSubmissionsButton scope={defaultScope} hasData visibleColumns={defaultColumns} />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    userEvent.click(getByTestId("export-data-submissions-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/^crdc-data-submissions-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/),
        "text/csv;charset=utf-8;"
      );
    });
  });

  it("should format CSV data correctly", async () => {
    const { getByTestId } = render(
      <ExportSubmissionsButton scope={defaultScope} hasData visibleColumns={defaultColumns} />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    userEvent.click(getByTestId("export-data-submissions-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalled();
    });

    const csvContent = mockDownloadBlob.mock.calls[0][0];

    expect(csvContent).toContain("Submission Name");
    expect(csvContent).toContain("Submitter");
    expect(csvContent).toContain("Data Commons");
    expect(csvContent).toContain("Program");
    expect(csvContent).toContain("Study");
    expect(csvContent).toContain("Status");
    expect(csvContent).toContain("Record Count");
    expect(csvContent).toContain("Data File Size");
    expect(csvContent).toContain("Submission 0");
    expect(csvContent).toContain("Submitter 0");
  });

  it("should not be visible for users without data_submission view permission", () => {
    mockUseAuthContext.mockReturnValue({
      user: userFactory.build({
        _id: "test-user",
        role: "Submitter",
        permissions: [],
      }),
      status: AuthStatus.LOADED,
      isLoggedIn: true,
    });

    const { queryByTestId } = render(
      <ExportSubmissionsButton scope={defaultScope} hasData visibleColumns={defaultColumns} />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    expect(queryByTestId("export-data-submissions-button")).not.toBeInTheDocument();
  });

  it("should only export columns provided in the columns prop", async () => {
    const visibleColumns: Column<Submission>[] = [
      {
        label: "Submission Name",
        renderValue: (a) => a.name,
        field: "name",
        exportValue: (a) => ({ label: "Submission Name", value: a.name }),
      },
      {
        label: "Status",
        renderValue: (a) => a.status,
        field: "status",
        exportValue: (a) => ({ label: "Status", value: a.status }),
      },
    ];

    const { getByTestId } = render(
      <ExportSubmissionsButton scope={defaultScope} hasData visibleColumns={visibleColumns} />,
      {
        wrapper: ({ children }) => (
          <MockParent mocks={[listSubmissionsMock]}>{children}</MockParent>
        ),
      }
    );

    userEvent.click(getByTestId("export-data-submissions-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalled();
    });

    const csvContent = mockDownloadBlob.mock.calls[0][0];

    expect(csvContent).toContain("Submission Name");
    expect(csvContent).toContain("Status");

    expect(csvContent).not.toContain("Submitter");
    expect(csvContent).not.toContain("Data Commons");
    expect(csvContent).not.toContain("Program");
  });
});
