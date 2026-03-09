import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MemoryRouterProps } from "react-router-dom";
import { axe } from "vitest-axe";

import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import {
  GET_INSTITUTION,
  CREATE_INSTITUTION,
  UPDATE_INSTITUTION,
  GetInstitutionResp,
  GetInstitutionInput,
  CreateInstitutionResp,
  CreateInstitutionInput,
  UpdateInstitutionResp,
  UpdateInstitutionInput,
} from "../../graphql";
import { TestRouter, act, render, waitFor, within } from "../../test-utils";

import InstitutionView from "./InstitutionView";

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

const getInstitutionMock: MockedResponse<GetInstitutionResp, GetInstitutionInput> = {
  request: {
    query: GET_INSTITUTION,
    variables: { _id: "institution-1" },
  },
  result: {
    data: {
      getInstitution: {
        _id: "inst-1",
        name: "Test Institution",
        status: "Active",
      },
    },
  },
};

const getInstitutionLoadingMock: MockedResponse<GetInstitutionResp, GetInstitutionInput> = {
  request: {
    query: GET_INSTITUTION,
    variables: { _id: "institution-1" },
  },
  result: {
    data: {
      getInstitution: {
        _id: "inst-1",
        name: "Test Institution",
        status: "Active",
      },
    },
  },
  delay: 1000,
};

const createInstitutionMock: MockedResponse<CreateInstitutionResp, CreateInstitutionInput> = {
  request: {
    query: CREATE_INSTITUTION,
    variables: { name: "New Institution", status: "Active" },
  },
  result: {
    data: {
      createInstitution: {
        _id: "new-id",
      },
    },
  },
};

const updateInstitutionMock: MockedResponse<UpdateInstitutionResp, UpdateInstitutionInput> = {
  request: {
    query: UPDATE_INSTITUTION,
    variables: { _id: "institution-1", name: "Updated Institution", status: "Inactive" },
  },
  result: {
    data: {
      updateInstitution: {
        _id: "institution-1",
        name: "Updated Institution",
        status: "Inactive",
      },
    },
  },
};

const createInstitutionErrorMock: MockedResponse<CreateInstitutionResp, CreateInstitutionInput> = {
  request: {
    query: CREATE_INSTITUTION,
    variables: { name: "New Institution", status: "Active" },
  },
  error: new Error("There was a problem while creating a new Institution."),
};

const updateInstitutionErrorMock: MockedResponse<UpdateInstitutionResp, UpdateInstitutionInput> = {
  request: {
    query: UPDATE_INSTITUTION,
    variables: { _id: "institution-1", name: "Updated Institution", status: "Inactive" },
  },
  error: new Error("There was a problem while updating the Institution."),
};

type ParentProps = {
  mocks?: MockedResponse[];
  initialEntries?: MemoryRouterProps["initialEntries"];
  children: React.ReactNode;
};

const TestParent: React.FC<ParentProps> = ({ mocks = [], initialEntries = ["/"], children }) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <TestRouter initialEntries={initialEntries}>
      <SearchParamsProvider>{children}</SearchParamsProvider>
    </TestRouter>
  </MockedProvider>
);

describe("Accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container } = render(
      <TestParent>
        <InstitutionView _id="new" />
      </TestParent>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("InstitutionView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { getByTestId } = render(
      <TestParent>
        <InstitutionView _id="new" />
      </TestParent>
    );

    expect(getByTestId("institution-form")).toBeInTheDocument();
    expect(getByTestId("institutionName-input")).toBeInTheDocument();
    expect(getByTestId("save-button")).toBeInTheDocument();
    expect(getByTestId("cancel-button")).toBeInTheDocument();
  });

  it("should set the page title to 'Add Institution' when _id is 'new'", async () => {
    render(
      <TestParent>
        <InstitutionView _id="new" />
      </TestParent>
    );

    await waitFor(() => {
      expect(mockUsePageTitle).toHaveBeenCalledWith("Add Institution");
    });
  });

  it("should set the page title to 'Edit Institution institution-1' when editing", async () => {
    render(
      <TestParent mocks={[getInstitutionMock]}>
        <InstitutionView _id="institution-1" />
      </TestParent>
    );

    await waitFor(() => {
      expect(mockUsePageTitle).toHaveBeenCalledWith("Edit Institution institution-1");
    });
  });

  it("creates a new institution successfully", async () => {
    const { getByTestId } = render(
      <TestParent mocks={[createInstitutionMock]}>
        <InstitutionView _id="new" />
      </TestParent>
    );

    const nameInput = getByTestId("institutionName-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.type(nameInput, "New Institution");

    expect(mockNavigate).not.toHaveBeenCalled();
    userEvent.click(saveButton);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Institution added successfully.", {
        variant: "success",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/institutions");
  });

  it("updates an existing institution successfully", async () => {
    const { getByTestId } = render(
      <TestParent mocks={[getInstitutionMock, updateInstitutionMock]}>
        <InstitutionView _id="institution-1" />
      </TestParent>
    );

    await waitFor(() => {
      expect((getByTestId("institutionName-input") as HTMLInputElement).value).toBe(
        "Test Institution"
      );
    });

    const nameInput = getByTestId("institutionName-input") as HTMLInputElement;
    userEvent.clear(nameInput);
    userEvent.type(nameInput, "Updated Institution");

    const statusSelect = within(getByTestId("status-select")).getByRole("button");
    userEvent.click(statusSelect);
    const listbox = within(getByTestId("status-select")).getByRole("listbox", { hidden: true });
    userEvent.click(within(listbox).getByText("Inactive"));

    expect(mockNavigate).not.toHaveBeenCalled();
    userEvent.click(getByTestId("save-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Institution updated successfully.", {
        variant: "success",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/institutions");
  });

  it("navigates back to manage institutions page when cancel button is clicked", () => {
    const { getByTestId } = render(
      <TestParent>
        <InstitutionView _id="new" />
      </TestParent>
    );

    expect(mockNavigate).not.toHaveBeenCalled();

    const cancelButton = getByTestId("cancel-button");
    userEvent.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith("/institutions");
  });

  it("handles API errors gracefully when creating a new institution", async () => {
    const { getByTestId } = render(
      <TestParent mocks={[createInstitutionErrorMock]}>
        <InstitutionView _id="new" />
      </TestParent>
    );

    const nameInput = getByTestId("institutionName-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.type(nameInput, "New Institution");

    expect(mockNavigate).not.toHaveBeenCalled();

    // eslint-disable-next-line testing-library/no-unnecessary-act -- RHF is throwing an error without act
    await act(async () => {
      userEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "There was a problem while creating a new Institution.",
        {
          variant: "error",
        }
      );
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("handles API errors gracefully when updating an existing institution", async () => {
    const { getByTestId } = render(
      <TestParent mocks={[getInstitutionMock, updateInstitutionErrorMock]}>
        <InstitutionView _id="institution-1" />
      </TestParent>
    );

    await waitFor(() => {
      expect((getByTestId("institutionName-input") as HTMLInputElement).value).toBe(
        "Test Institution"
      );
    });

    const nameInput = getByTestId("institutionName-input") as HTMLInputElement;
    userEvent.clear(nameInput);
    userEvent.type(nameInput, "Updated Institution");

    const statusSelect = within(getByTestId("status-select")).getByRole("button");
    userEvent.click(statusSelect);
    const listbox = within(getByTestId("status-select")).getByRole("listbox", { hidden: true });
    userEvent.click(within(listbox).getByText("Inactive"));

    expect(mockNavigate).not.toHaveBeenCalled();

    // eslint-disable-next-line testing-library/no-unnecessary-act -- RHF is throwing an error without act
    await act(async () => {
      userEvent.click(getByTestId("save-button"));
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "There was a problem while updating the Institution.",
        { variant: "error" }
      );
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should show a loading spinner while retrieving the institution", async () => {
    const { getByTestId } = render(
      <TestParent mocks={[getInstitutionLoadingMock]}>
        <InstitutionView _id="institution-1" />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("institution-view-suspense-loader")).toBeInTheDocument();
    });
  });
});
