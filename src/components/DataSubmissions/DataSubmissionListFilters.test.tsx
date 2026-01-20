import userEvent from "@testing-library/user-event";
import React, { FC, useMemo } from "react";
import { MemoryRouter, MemoryRouterProps } from "react-router-dom";
import { axe } from "vitest-axe";

import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import { ListSubmissionsResp } from "../../graphql";
import { render, waitFor, within } from "../../test-utils";
import {
  Context as AuthContext,
  ContextState as AuthContextState,
  Status as AuthContextStatus,
} from "../Contexts/AuthContext";
import { SearchParamsProvider } from "../Contexts/SearchParamsContext";
import { Column } from "../GenericTable";

import DataSubmissionListFilters from "./DataSubmissionListFilters";

vi.mock("../Contexts/OrganizationListContext", () => ({
  useOrganizationListContext: vi.fn(),
}));

type ParentProps = {
  initialEntries?: MemoryRouterProps["initialEntries"];
  userRole?: UserRole;
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  initialEntries = ["/"],
  userRole = "User",
  children,
}: ParentProps) => {
  const authContextValue = useMemo<AuthContextState>(
    () => ({
      status: AuthContextStatus.LOADED,
      isLoggedIn: true,
      user: userFactory.build({
        _id: "user1",
        role: userRole,
        permissions: ["data_submission:create"],
      }),
    }),
    [userRole]
  );

  return (
    <MemoryRouter initialEntries={initialEntries}>
      <AuthContext.Provider value={authContextValue}>
        <SearchParamsProvider>{children}</SearchParamsProvider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

describe("DataSubmissionListFilters Component", () => {
  const columns: Column<ListSubmissionsResp["listSubmissions"]["submissions"][0]>[] = [
    {
      field: "name",
      label: "Name",
      renderValue: (row) => row.name,
    },
    {
      field: "status",
      label: "Status",
      renderValue: (row) => row.status,
    },
  ];

  const submitterNames = ["Submitter1", "Submitter2"];
  const dataCommons = ["DataCommon1", "DataCommon2"];
  const organizations: Organization[] = organizationFactory.build(2, (index) => ({
    _id: `Org${index + 1}`,
    name: `Organization ${index + 1}`,
  }));
  const columnVisibilityModel = { name: true, status: true };

  const mockOnChange = vi.fn();
  const mockOnColumnVisibilityModelChange = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders without crashing", async () => {
    const { getByTestId } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("data-submission-list-filters")).toBeInTheDocument();
    });
  });

  it("has no accessibility violations", async () => {
    const { container, getByTestId } = render(
      <TestParent userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("organization-select")).toBeInTheDocument();
      expect(getByTestId("status-select")).toBeInTheDocument();
      expect(getByTestId("data-commons-select")).toBeInTheDocument();
      expect(getByTestId("submission-name-input")).toBeInTheDocument();
      expect(getByTestId("dbGaPID-input")).toBeInTheDocument();
      expect(getByTestId("submitter-name-select")).toBeInTheDocument();
      expect(getByTestId("reset-filters-button")).toBeInTheDocument();
      expect(getByTestId("column-visibility-button")).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders all input fields correctly", async () => {
    const { getByTestId } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("organization-select")).toBeInTheDocument();
    });

    expect(getByTestId("status-select")).toBeInTheDocument();
    expect(getByTestId("data-commons-select")).toBeInTheDocument();
    expect(getByTestId("submission-name-input")).toBeInTheDocument();
    expect(getByTestId("dbGaPID-input")).toBeInTheDocument();
    expect(getByTestId("submitter-name-select")).toBeInTheDocument();
    expect(getByTestId("reset-filters-button")).toBeInTheDocument();
    expect(getByTestId("column-visibility-button")).toBeInTheDocument();
  });

  it("allows users to select an organization when user is Admin", async () => {
    const { getByTestId, getByRole } = render(
      <TestParent userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    const organizationSelect = within(getByTestId("organization-select")).getByRole("button");

    userEvent.click(organizationSelect);

    const muiSelectList = within(getByRole("listbox", { hidden: true }));

    await waitFor(() => {
      expect(muiSelectList.getByTestId("organization-option-All")).toBeInTheDocument();
      expect(muiSelectList.getByTestId("organization-option-Org1")).toBeInTheDocument();
      expect(muiSelectList.getByTestId("organization-option-Org2")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("organization-option-Org2"));

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          organization: "Org2",
        })
      );
    });
  });

  it("allows non-admin users to select an organization", async () => {
    const { getByTestId } = render(
      <TestParent userRole="Submitter">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("organization-select")).toBeInTheDocument();
    });

    const organizationSelectInput = getByTestId("organization-select");

    const button = within(organizationSelectInput).getByRole("button");
    expect(button).not.toHaveClass("Mui-readOnly");
  });

  it("resets all filters and clears URL searchParams when reset button is clicked", async () => {
    const { getByTestId, getByRole } = render(
      <TestParent userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    const organizationSelect = within(getByTestId("organization-select")).getByRole("button");

    userEvent.click(organizationSelect);

    const orgSelectList = within(getByRole("listbox", { hidden: true }));

    await waitFor(() => {
      expect(orgSelectList.getByTestId("organization-option-All")).toBeInTheDocument();
      expect(orgSelectList.getByTestId("organization-option-Org1")).toBeInTheDocument();
      expect(orgSelectList.getByTestId("organization-option-Org2")).toBeInTheDocument();
    });

    userEvent.click(orgSelectList.getByTestId("organization-option-Org2"));

    const dataCommonsSelect = within(getByTestId("data-commons-select")).getByRole("button");

    userEvent.click(dataCommonsSelect);

    const dataCommonsSelectList = within(dataCommonsSelect.parentElement).getByRole("listbox", {
      hidden: true,
    });

    await waitFor(() => {
      expect(
        within(dataCommonsSelectList).getByTestId("data-commons-option-All")
      ).toBeInTheDocument();
      expect(
        within(dataCommonsSelectList).getByTestId("data-commons-option-DataCommon1")
      ).toBeInTheDocument();
      expect(
        within(dataCommonsSelectList).getByTestId("data-commons-option-DataCommon2")
      ).toBeInTheDocument();
    });

    userEvent.click(within(dataCommonsSelectList).getByTestId("data-commons-option-DataCommon1"));

    userEvent.type(getByTestId("submission-name-input"), "Test Submission");
    userEvent.type(getByTestId("dbGaPID-input"), "12345");

    const submitterNameSelect = within(getByTestId("submitter-name-select")).getByRole("button");

    userEvent.click(submitterNameSelect);

    const submitterNameList = within(submitterNameSelect.parentElement).getByRole("listbox", {
      hidden: true,
    });

    await waitFor(() => {
      expect(
        within(submitterNameList).getByTestId("submitter-name-option-All")
      ).toBeInTheDocument();
      expect(
        within(submitterNameList).getByTestId("submitter-name-option-Submitter1")
      ).toBeInTheDocument();
      expect(
        within(submitterNameList).getByTestId("submitter-name-option-Submitter2")
      ).toBeInTheDocument();
    });

    userEvent.click(within(submitterNameList).getByTestId("submitter-name-option-Submitter1"));

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          organization: "Org2",
          status: expect.arrayContaining(["New", "Submitted"]),
          name: "Test Submission",
          dbGaPID: "12345",
          submitterName: "Submitter1",
          dataCommons: "DataCommon1",
        })
      );
    });

    userEvent.click(getByTestId("reset-filters-button"));

    await waitFor(() => {
      expect(getByTestId("organization-select-input")).toHaveValue("All");
      expect(getByTestId("status-select-input")).toHaveValue(
        ["New", "In Progress", "Submitted", "Withdrawn", "Released", "Rejected"].join(",")
      );
      expect(getByTestId("data-commons-select-input")).toHaveValue("All");
      expect(getByTestId("submission-name-input")).toHaveValue("");
      expect(getByTestId("dbGaPID-input")).toHaveValue("");
      expect(getByTestId("submitter-name-select-input")).toHaveValue("All");
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: "All",
        status: ["New", "In Progress", "Submitted", "Withdrawn", "Released", "Rejected"],
        dataCommons: "All",
        name: "",
        dbGaPID: "",
        submitterName: "All",
      })
    );
  });

  it("debounces onChange after entering 3 characters in 'name' input", async () => {
    const { getByTestId } = render(
      <TestParent userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    userEvent.type(getByTestId("submission-name-input"), "Tes");

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Tes",
        })
      );
    });

    userEvent.clear(getByTestId("submission-name-input"));
  });

  it("does not call additional onChange before entering 3 characters in 'name' input", async () => {
    const { getByTestId } = render(
      <TestParent userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    // Initial call
    expect(mockOnChange).toHaveBeenCalledTimes(1);

    userEvent.type(getByTestId("submission-name-input"), "T");

    await waitFor(
      () => {
        expect(mockOnChange).not.toHaveBeenCalledWith(
          expect.objectContaining({
            name: "T",
          })
        );
      },
      { timeout: 600 }
    );

    // Only initial call was made
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    userEvent.clear(getByTestId("submission-name-input"));
  });

  it("debounces onChange after entering 3 characters in 'dbGaPID' input", async () => {
    const { getByTestId } = render(
      <TestParent userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    // Type 3 characters
    userEvent.type(getByTestId("dbGaPID-input"), "123");

    // Wait for debounce
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dbGaPID: "123",
        })
      );
    });

    userEvent.clear(getByTestId("dbGaPID-input"));
  });

  it("does not call onChange before entering 3 characters in 'dbGaPID' input", async () => {
    const { getByTestId } = render(
      <TestParent userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    // Initial call
    expect(mockOnChange).toHaveBeenCalledTimes(1);

    userEvent.type(getByTestId("dbGaPID-input"), "12");

    await waitFor(
      () => {
        expect(mockOnChange).not.toHaveBeenCalledWith(
          expect.objectContaining({
            dbGaPID: "12",
          })
        );
      },
      { timeout: 600 }
    );

    // Only initial call was made
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    userEvent.clear(getByTestId("dbGaPID-input"));
  });

  it("calls onChange immediately when clearing 'name' input", async () => {
    const { getByTestId } = render(
      <TestParent userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    userEvent.type(getByTestId("submission-name-input"), "Tes");

    // Wait for debounce
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Tes",
        })
      );
    });

    userEvent.clear(getByTestId("submission-name-input"));

    // onChange should be called immediately
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "",
        })
      );
    });
  });

  it("calls onChange immediately when clearing 'dbGaPID' input", async () => {
    const { getByTestId } = render(
      <TestParent userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("dbGaPID-input")).toBeInTheDocument();
    });

    userEvent.type(getByTestId("dbGaPID-input"), "123");

    // Wait for debounce
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dbGaPID: "123",
        })
      );
    });

    userEvent.clear(getByTestId("dbGaPID-input"));

    // onChange should be called immediately
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dbGaPID: "",
        })
      );
    });
  });

  it("debounces onChange correctly for multiple fields", async () => {
    const { getByTestId } = render(
      <TestParent userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submission-name-input")).toBeInTheDocument();
      expect(getByTestId("dbGaPID-input")).toBeInTheDocument();
    });

    userEvent.type(getByTestId("submission-name-input"), "Test");
    userEvent.type(getByTestId("dbGaPID-input"), "4567");

    // Wait for debounce
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test",
          dbGaPID: "4567",
        })
      );
    });

    userEvent.clear(getByTestId("submission-name-input"));
    userEvent.clear(getByTestId("dbGaPID-input"));
  });

  it("initializes form fields based on searchParams", async () => {
    const initialEntries = [
      "/?program=Org1&status=Submitted&dataCommons=DataCommon1&name=Test&dbGaPID=123&submitterName=Submitter1",
    ];

    const mockOnChange = vi.fn();
    const mockOnColumnVisibilityModelChange = vi.fn();

    const { getByTestId } = render(
      <TestParent initialEntries={initialEntries} userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("organization-select-input")).toHaveValue("Org1");
      expect(getByTestId("status-select-input")).toHaveValue("Submitted");
      expect(getByTestId("data-commons-select-input")).toHaveValue("DataCommon1");
      expect(getByTestId("submission-name-input")).toHaveValue("Test");
      expect(getByTestId("dbGaPID-input")).toHaveValue("123");
      expect(getByTestId("submitter-name-select-input")).toHaveValue("Submitter1");
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: "Org1",
        status: ["Submitted"],
        dataCommons: "DataCommon1",
        name: "Test",
        dbGaPID: "123",
        submitterName: "Submitter1",
      })
    );

    userEvent.clear(getByTestId("dbGaPID-input"));
    userEvent.clear(getByTestId("submission-name-input"));
  });

  it("initializes study field based on searchParams and ignores invalid options", async () => {
    const initialEntries = ["/?status=Deleted&status=RandomFakeStatus"];

    const mockOnChange = vi.fn();
    const mockOnColumnVisibilityModelChange = vi.fn();

    const { getByTestId } = render(
      <TestParent initialEntries={initialEntries} userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("status-select-input")).toHaveValue("Deleted");
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ["Deleted"],
      })
    );
  });

  it("initializes form fields to default when searchParams are empty", async () => {
    const initialEntries = ["/"];

    const mockOnChange = vi.fn();
    const mockOnColumnVisibilityModelChange = vi.fn();

    const { getByTestId } = render(
      <TestParent initialEntries={initialEntries} userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("organization-select-input")).toHaveValue("All");
      expect(getByTestId("status-select-input")).toHaveValue(
        ["New", "In Progress", "Submitted", "Withdrawn", "Released", "Rejected"].join(",")
      );
      expect(getByTestId("data-commons-select-input")).toHaveValue("All");
      expect(getByTestId("submission-name-input")).toHaveValue("");
      expect(getByTestId("dbGaPID-input")).toHaveValue("");
      expect(getByTestId("submitter-name-select-input")).toHaveValue("All");
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: "All",
        status: ["New", "In Progress", "Submitted", "Withdrawn", "Released", "Rejected"],
        dataCommons: "All",
        name: "",
        dbGaPID: "",
        submitterName: "All",
      })
    );
  });

  it("calls onChange with getValues when all filters are not touched on initial render", async () => {
    const initialEntries = ["/"];

    const mockOnChange = vi.fn();
    const mockOnColumnVisibilityModelChange = vi.fn();

    render(
      <TestParent initialEntries={initialEntries} userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          organization: "All",
          status: ["New", "In Progress", "Submitted", "Withdrawn", "Released", "Rejected"],
          dataCommons: "All",
          name: "",
          dbGaPID: "",
          submitterName: "All",
        })
      );
    });
  });

  it("sets dataCommons select to 'All' when dataCommons prop is empty", async () => {
    const initialEntries = ["/"];
    const mockOnChange = vi.fn();
    const mockOnColumnVisibilityModelChange = vi.fn();

    const { getByTestId, findByRole } = render(
      <TestParent initialEntries={initialEntries} userRole="Admin">
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={[]} // Empty dataCommons
          dataCommonsDisplayNames={[]}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    userEvent.clear(getByTestId("dbGaPID-input"));
    userEvent.clear(getByTestId("submission-name-input"));

    await waitFor(() => {
      expect(getByTestId("data-commons-select-input")).toHaveValue("All");
      expect(getByTestId("data-commons-select")).toBeInTheDocument();
      expect(within(getByTestId("data-commons-select")).getByRole("button")).toBeInTheDocument();
    });

    const button = within(getByTestId("data-commons-select")).getByRole("button");
    userEvent.click(button);

    const dataCommonsList = await findByRole("listbox", { hidden: true });
    await waitFor(async () => {
      expect(within(dataCommonsList).getByTestId("data-commons-option-All")).toBeInTheDocument();
      expect(
        within(dataCommonsList).queryByTestId("data-commons-option-DataCommon1")
      ).not.toBeInTheDocument();
      expect(
        within(dataCommonsList).queryByTestId("data-commons-option-DataCommon2")
      ).not.toBeInTheDocument();
    });

    userEvent.click(button);
  });

  it("sets dataCommons select to field.value when dataCommons prop is non-empty", async () => {
    const mockOnChange = vi.fn();
    const mockOnColumnVisibilityModelChange = vi.fn();

    const { getByTestId, getByRole } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={["DataCommon1", "DataCommon2"]} // Non-empty dataCommons
          dataCommonsDisplayNames={["DataCommon1", "DataCommon2"]}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("data-commons-select-input")).toHaveValue("All");
    });

    const dataCommonsSelect = within(getByTestId("data-commons-select")).getByRole("button");
    userEvent.click(dataCommonsSelect);

    const dataCommonsList = within(getByRole("listbox", { hidden: true }));

    await waitFor(() => {
      expect(dataCommonsList.getByTestId("data-commons-option-DataCommon1")).toBeInTheDocument();
      expect(dataCommonsList.getByTestId("data-commons-option-DataCommon2")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("data-commons-option-DataCommon1"));

    await waitFor(() => {
      expect(getByTestId("data-commons-select-input")).toHaveValue("DataCommon1");
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCommons: "DataCommon1",
        })
      );
    });
  });

  it("sets submitterNames select to 'All' when submitterNames prop is empty", async () => {
    const mockOnChange = vi.fn();
    const mockOnColumnVisibilityModelChange = vi.fn();

    const { getByTestId, getByRole } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={[]} // Empty submitterNames
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submitter-name-select-input")).toHaveValue("All");
    });

    const submitterNameSelect = within(getByTestId("submitter-name-select")).getByRole("button");
    userEvent.click(submitterNameSelect);

    const submitterNameList = within(getByRole("listbox", { hidden: true }));

    await waitFor(() => {
      expect(submitterNameList.getByTestId("submitter-name-option-All")).toBeInTheDocument();
      expect(
        submitterNameList.queryByTestId("submitter-name-option-Submitter1")
      ).not.toBeInTheDocument();
      expect(
        submitterNameList.queryByTestId("submitter-name-option-Submitter2")
      ).not.toBeInTheDocument();
    });
  });

  it("sets submitterNames select to field.value when submitterNames prop is non-empty", async () => {
    const mockOnChange = vi.fn();
    const mockOnColumnVisibilityModelChange = vi.fn();

    const { getByTestId, getByRole } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={["Submitter1", "Submitter2"]} // Non-empty submitterNames
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submitter-name-select-input")).toHaveValue("All");
    });

    const submitterNameSelect = within(getByTestId("submitter-name-select")).getByRole("button");
    userEvent.click(submitterNameSelect);

    const submitterNameList = within(getByRole("listbox", { hidden: true }));

    await waitFor(() => {
      expect(submitterNameList.getByTestId("submitter-name-option-Submitter1")).toBeInTheDocument();
      expect(submitterNameList.getByTestId("submitter-name-option-Submitter2")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("submitter-name-option-Submitter1"));

    await waitFor(() => {
      expect(getByTestId("submitter-name-select-input")).toHaveValue("Submitter1");
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          submitterName: "Submitter1",
        })
      );
    });
  });

  it("sets organization select to 'All' when organizations prop is empty", async () => {
    const mockOnChange = vi.fn();
    const mockOnColumnVisibilityModelChange = vi.fn();

    const { getByTestId, getByRole } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={[]}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("organization-select-input")).toHaveValue("All");
    });

    const organizationSelect = within(getByTestId("organization-select")).getByRole("button");
    userEvent.click(organizationSelect);

    const organizationList = within(getByRole("listbox", { hidden: true }));

    await waitFor(() => {
      expect(organizationList.getByTestId("organization-option-All")).toBeInTheDocument();
      expect(organizationList.queryByTestId("organization-option-Org1")).not.toBeInTheDocument();
      expect(organizationList.queryByTestId("organization-option-Org2")).not.toBeInTheDocument();
    });
  });

  it("sets organization select to field.value when organizations prop is non-empty", async () => {
    const mockOnChange = vi.fn();
    const mockOnColumnVisibilityModelChange = vi.fn();

    const { getByTestId, getByRole } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("organization-select-input")).toHaveValue("All");
    });

    const organizationSelect = within(getByTestId("organization-select")).getByRole("button");
    userEvent.click(organizationSelect);

    const organizationList = within(getByRole("listbox", { hidden: true }));

    await waitFor(() => {
      expect(organizationList.getByTestId("organization-option-Org1")).toBeInTheDocument();
      expect(organizationList.getByTestId("organization-option-Org2")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("organization-option-Org1"));

    await waitFor(() => {
      expect(getByTestId("organization-select-input")).toHaveValue("Org1");
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          organization: "Org1",
        })
      );
    });
  });

  it("should use the dataCommonsDisplayName visually for the dataCommons select", async () => {
    const mockOnChange = vi.fn();
    const mockOnColumnVisibilityModelChange = vi.fn();

    const dataCommons = ["DataCommon1", "DataCommon2"];
    const dataCommonsDisplayNames = ["Display Name 1", "Display Name 2"];

    const { getByTestId, getByText, getByRole } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommonsDisplayNames}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("data-commons-select-input")).toHaveValue("All");
    });

    const dataCommonsSelect = within(getByTestId("data-commons-select")).getByRole("button");
    userEvent.click(dataCommonsSelect);

    const dataCommonsList = within(getByRole("listbox", { hidden: true }));

    await waitFor(() => {
      expect(dataCommonsList.getByText("Display Name 1")).toBeInTheDocument();
      expect(dataCommonsList.getByText("Display Name 2")).toBeInTheDocument();
    });

    userEvent.click(getByText("Display Name 1"));

    await waitFor(() => {
      expect(getByTestId("data-commons-select-input")).toHaveValue("DataCommon1");
    });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCommons: "DataCommon1",
        })
      );
    });
  });

  it("displays clear button when statuses are selected", () => {
    const { getByTestId } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    expect(getByTestId("status-clear-button")).toBeInTheDocument();
  });

  it("hides clear button when no statuses are selected", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    const statusSelect = within(getByTestId("status-select")).getByRole("button", {
      name: /statuses selected/i,
    });
    userEvent.click(statusSelect);

    userEvent.click(getByTestId("status-option-New"));
    userEvent.click(getByTestId("status-option-In Progress"));
    userEvent.click(getByTestId("status-option-Submitted"));
    userEvent.click(getByTestId("status-option-Withdrawn"));
    userEvent.click(getByTestId("status-option-Released"));
    userEvent.click(getByTestId("status-option-Rejected"));

    await waitFor(() => {
      expect(queryByTestId("status-clear-button")).not.toBeInTheDocument();
    });
  });

  it("clears all selected statuses when clicked", async () => {
    const { getByTestId } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    const clearButton = getByTestId("status-clear-button");
    userEvent.click(clearButton);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          status: [],
        })
      );
    });
  });

  it("is clickable when dropdown is open", async () => {
    const { getByTestId } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    const statusSelect = within(getByTestId("status-select")).getByRole("button", {
      name: /statuses selected/i,
    });

    userEvent.click(statusSelect);

    await waitFor(() => {
      const statusOptions = within(getByTestId("status-select")).getByRole("listbox", {
        hidden: true,
      });
      expect(statusOptions).toBeInTheDocument();
    });

    const clearButton = getByTestId("status-clear-button");
    expect(clearButton).toBeInTheDocument();
    expect(() => userEvent.click(clearButton)).not.toThrow();
  });

  it("keeps dropdown open after clear button is clicked", async () => {
    const { getByTestId } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    const statusSelect = within(getByTestId("status-select")).getByRole("button", {
      name: /statuses selected/i,
    });

    userEvent.click(statusSelect);

    await waitFor(() => {
      const statusOptions = within(getByTestId("status-select")).getByRole("listbox", {
        hidden: true,
      });
      expect(statusOptions).toBeInTheDocument();
    });

    const clearButton = getByTestId("status-clear-button");
    userEvent.click(clearButton);

    await waitFor(() => {
      const statusOptions = within(getByTestId("status-select")).getByRole("listbox", {
        hidden: true,
      });
      expect(statusOptions).toBeInTheDocument();
    });
  });

  it("has proper z-index to appear above backdrop", () => {
    const { getByTestId } = render(
      <TestParent>
        <DataSubmissionListFilters
          columns={columns}
          organizations={organizations}
          submitterNames={submitterNames}
          dataCommons={dataCommons}
          dataCommonsDisplayNames={dataCommons}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={mockOnColumnVisibilityModelChange}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    const clearButton = getByTestId("status-clear-button");
    const styles = window.getComputedStyle(clearButton);

    expect(parseInt(styles.zIndex, 10)).toBeGreaterThan(9999);
  });
});
