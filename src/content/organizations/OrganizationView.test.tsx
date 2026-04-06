import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { FC } from "react";
import { axe } from "vitest-axe";

import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { render, waitFor, TestRouter } from "@/test-utils";

import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import {
  GET_ORG,
  GetOrgResp,
  GetOrgInput,
  LIST_ACTIVE_DCPS,
  ListActiveDCPsResp,
} from "../../graphql";

import OrganizationView from "./OrganizationView";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const baseOrg = organizationFactory.build({
  _id: "org-1",
  name: "Test Program",
  abbreviation: "TP",
  description: "A test program",
  status: "Active",
  conciergeID: "",
  studies: [],
});

const orgWithStudies = organizationFactory.build({
  _id: "org-2",
  name: "Program With Studies",
  abbreviation: "PWS",
  description: "A program with studies",
  status: "Active",
  conciergeID: "",
  studies: [approvedStudyFactory.build({ _id: "study-1" })],
});

const getOrgMock: MockedResponse<GetOrgResp, GetOrgInput> = {
  request: {
    query: GET_ORG,
    variables: { orgID: "org-1" },
  },
  result: {
    data: {
      getOrganization: baseOrg,
    },
  },
};

const getOrgWithStudiesMock: MockedResponse<GetOrgResp, GetOrgInput> = {
  request: {
    query: GET_ORG,
    variables: { orgID: "org-2" },
  },
  result: {
    data: {
      getOrganization: orgWithStudies,
    },
  },
};

const listActiveDCPsMock: MockedResponse<ListActiveDCPsResp> = {
  request: {
    query: LIST_ACTIVE_DCPS,
  },
  result: {
    data: {
      listActiveDCPs: [],
    },
  },
};

type TestParentProps = {
  mocks?: MockedResponse[];
  children?: React.ReactNode;
};

const TestParent: FC<TestParentProps> = ({ mocks = [], children }) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <TestRouter>
      <SearchParamsProvider>{children}</SearchParamsProvider>
    </TestRouter>
  </MockedProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<OrganizationView _id="new" />, {
      wrapper: ({ children }) => <TestParent mocks={[listActiveDCPsMock]}>{children}</TestParent>,
    });

    await waitFor(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing for a new program", async () => {
    const { getByText } = render(<OrganizationView _id="new" />, {
      wrapper: ({ children }) => <TestParent mocks={[listActiveDCPsMock]}>{children}</TestParent>,
    });

    expect(getByText("Add Program")).toBeInTheDocument();
  });

  it("should render without crashing for an existing program", async () => {
    const { findByText } = render(<OrganizationView _id="org-1" />, {
      wrapper: ({ children }) => (
        <TestParent mocks={[listActiveDCPsMock, getOrgMock]}>{children}</TestParent>
      ),
    });

    expect(await findByText("Edit Program")).toBeInTheDocument();
  });
});

describe("Implementation Requirements", () => {
  it("should show a snackbar error when marking a program with studies as Inactive", async () => {
    const { findByText, getByRole } = render(<OrganizationView _id="org-2" />, {
      wrapper: ({ children }) => (
        <TestParent mocks={[listActiveDCPsMock, getOrgWithStudiesMock]}>{children}</TestParent>
      ),
    });

    await findByText("Edit Program");

    const statusSelect = getByRole("button", { name: "Active" });
    userEvent.click(statusSelect);

    const inactiveOption = await findByText("Inactive");
    userEvent.click(inactiveOption);

    const saveButton = getByRole("button", { name: "Save" });
    userEvent.click(saveButton);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "This Program has assigned Studies. Please remove or reassign the associated Studies before proceeding.",
        { variant: "error" }
      );
    });
  });

  it("should show the inactive warning dialog when marking a program without studies as Inactive", async () => {
    const { findByText, getByRole, getByText, findByTestId } = render(
      <OrganizationView _id="org-1" />,
      {
        wrapper: ({ children }) => (
          <TestParent mocks={[listActiveDCPsMock, getOrgMock]}>{children}</TestParent>
        ),
      }
    );

    await findByText("Edit Program");

    const statusSelect = getByRole("button", { name: "Active" });
    userEvent.click(statusSelect);

    const inactiveOption = await findByText("Inactive");
    userEvent.click(inactiveOption);

    const saveButton = getByRole("button", { name: "Save" });
    userEvent.click(saveButton);

    const dialog = await findByTestId("delete-dialog");
    expect(dialog).toBeVisible();
    expect(
      getByText(
        "This Program has no assigned Studies. Marking it as Inactive will prevent future use. Do you want to continue?"
      )
    ).toBeInTheDocument();
  });

  it("should close the inactive warning dialog when cancel is clicked", async () => {
    const { findByText, getByRole, findByTestId, queryByTestId } = render(
      <OrganizationView _id="org-1" />,
      {
        wrapper: ({ children }) => (
          <TestParent mocks={[listActiveDCPsMock, getOrgMock]}>{children}</TestParent>
        ),
      }
    );

    await findByText("Edit Program");

    const statusSelect = getByRole("button", { name: "Active" });
    userEvent.click(statusSelect);

    const inactiveOption = await findByText("Inactive");
    userEvent.click(inactiveOption);

    const saveButton = getByRole("button", { name: "Save" });
    userEvent.click(saveButton);

    await findByTestId("delete-dialog");

    const cancelButton = getByRole("button", { name: "Cancel button" });
    userEvent.click(cancelButton);

    await waitFor(() => {
      expect(queryByTestId("delete-dialog")).not.toBeInTheDocument();
    });
  });
});
