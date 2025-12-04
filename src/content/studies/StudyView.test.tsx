import { ApolloError } from "@apollo/client";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import React, { FC } from "react";
import { MemoryRouter, MemoryRouterProps } from "react-router-dom";
import { axe } from "vitest-axe";

import { OrganizationProvider } from "@/components/Contexts/OrganizationListContext";
import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";

import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import {
  GET_APPROVED_STUDY,
  UPDATE_APPROVED_STUDY,
  CREATE_APPROVED_STUDY,
  GetApprovedStudyResp,
  GetApprovedStudyInput,
  LIST_ACTIVE_DCPS,
  ListActiveDCPsResp,
  CreateApprovedStudyResp,
  CreateApprovedStudyInput,
  UpdateApprovedStudyResp,
  UpdateApprovedStudyInput,
  ListOrgsResp,
  ListOrgsInput,
  LIST_ORGS,
} from "../../graphql";
import { act, render, waitFor, within } from "../../test-utils";

import StudyView from "./StudyView";

const mockUsePageTitle = vi.fn();
vi.mock("../../hooks/usePageTitle", async () => ({
  ...(await vi.importActual("../../hooks/usePageTitle")),
  default: (...p) => mockUsePageTitle(...p),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const listActiveDCPsMock: MockedResponse<ListActiveDCPsResp> = {
  request: {
    query: LIST_ACTIVE_DCPS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listActiveDCPs: [
        {
          userID: "dcp-1",
          firstName: "John",
          lastName: "Doe",
          createdAt: "",
          updateAt: "",
        },
        {
          userID: "dcp-2",
          firstName: "James",
          lastName: "Smith",
          createdAt: "",
          updateAt: "",
        },
      ],
    },
  },
};

const listProgramsMock: MockedResponse<ListOrgsResp, ListOrgsInput> = {
  request: {
    query: LIST_ORGS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listPrograms: {
        total: 3,
        programs: [
          organizationFactory.build({ _id: "NA", name: "NA", readOnly: true }),
          ...organizationFactory.build(3, (idx) => ({
            _id: `program-${idx + 1}`,
            name: `PROGRAM-${idx}`,
          })),
        ],
      },
    },
  },
};

type ParentProps = {
  mocks?: MockedResponse[];
  initialEntries?: MemoryRouterProps["initialEntries"];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  mocks = [listActiveDCPsMock, listProgramsMock],
  initialEntries = ["/"],
  children,
}: ParentProps) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <OrganizationProvider preload>
      <MemoryRouter initialEntries={initialEntries}>
        <SearchParamsProvider>{children}</SearchParamsProvider>
      </MemoryRouter>
    </OrganizationProvider>
  </MockedProvider>
);

describe("StudyView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders without crashing", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    expect(getByTestId("studyName-input")).toBeInTheDocument();
    expect(getByTestId("studyAbbreviation-input")).toBeInTheDocument();
    expect(getByTestId("PI-input")).toBeInTheDocument();
    expect(getByTestId("dbGaPID-input")).toBeInTheDocument();
    expect(getByTestId("ORCID-input")).toBeInTheDocument();
    expect(getByTestId("openAccess-checkbox")).toBeInTheDocument();
    expect(getByTestId("controlledAccess-checkbox")).toBeInTheDocument();
    expect(getByTestId("save-button")).toBeInTheDocument();
    expect(getByTestId("cancel-button")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    await act(async () => {
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  it("should set the page title 'Add Study'", async () => {
    const { queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockUsePageTitle).toHaveBeenCalledWith("Add Study");
    });
  });

  it("should set the page title as 'Edit Study' with the ID displaying", async () => {
    const getApprovedStudyMock: MockedResponse<GetApprovedStudyResp, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
        variables: { _id: "test-id", partial: false },
      },
      result: {
        data: {
          getApprovedStudy: approvedStudyFactory.build({ _id: "test-id" }),
        },
      },
    };

    const { queryByTestId } = render(
      <TestParent mocks={[listActiveDCPsMock, listProgramsMock, getApprovedStudyMock]}>
        <StudyView _id="test-id" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockUsePageTitle).toHaveBeenCalledWith("Edit Study test-id");
    });
  });

  it("should show a loading spinner while retrieving approved study is loading", async () => {
    const getApprovedStudyMock: MockedResponse<GetApprovedStudyResp, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
        variables: { _id: "test-id", partial: false },
      },
      result: {
        data: {
          getApprovedStudy: approvedStudyFactory.build({ _id: "test-id" }),
        },
      },
      delay: 1000,
    };

    const { getByTestId } = render(
      <TestParent mocks={[listActiveDCPsMock, listProgramsMock, getApprovedStudyMock]}>
        <StudyView _id="test-id" />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("study-view-suspense-loader")).toBeInTheDocument();
    });
  });

  it("renders all input fields correctly", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    expect(getByTestId("studyName-input")).toBeInTheDocument();
    expect(getByTestId("studyAbbreviation-input")).toBeInTheDocument();
    expect(getByTestId("PI-input")).toBeInTheDocument();
    expect(getByTestId("dbGaPID-input")).toBeInTheDocument();
    expect(getByTestId("ORCID-input")).toBeInTheDocument();
    expect(getByTestId("openAccess-checkbox")).toBeInTheDocument();
    expect(getByTestId("controlledAccess-checkbox")).toBeInTheDocument();
  });

  it("allows users to input text into the fields", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;
    const studyAbbreviationInput = getByTestId("studyAbbreviation-input") as HTMLInputElement;
    const PIInput = getByTestId("PI-input") as HTMLInputElement;
    const dbGaPIDInput = getByTestId("dbGaPID-input") as HTMLInputElement;
    const ORCIDInput = getByTestId("ORCID-input") as HTMLInputElement;

    userEvent.type(studyNameInput, "Test Study Name");
    expect(studyNameInput.value).toBe("Test Study Name");

    userEvent.type(studyAbbreviationInput, "TSN");
    expect(studyAbbreviationInput.value).toBe("TSN");

    userEvent.type(PIInput, "John Doe");
    expect(PIInput.value).toBe("John Doe");

    userEvent.type(dbGaPIDInput, "phs123456");
    expect(dbGaPIDInput.value).toBe("phs123456");

    userEvent.type(ORCIDInput, "0000-0001-2345-6789");
    expect(ORCIDInput.value).toBe("0000-0001-2345-6789");
  });

  it("validates required fields and shows error if access type is not selected", async () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;
    const PIInput = getByTestId("PI-input") as HTMLInputElement;
    const ORCIDInput = getByTestId("ORCID-input") as HTMLInputElement;
    const programAutocomplete = getByTestId("program-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.type(studyNameInput, "Test Study Name");
    userEvent.type(PIInput, "John Doe");
    userEvent.type(ORCIDInput, "0000-0001-2345-6789");
    userEvent.type(programAutocomplete, "Not Appl");

    await waitFor(() => {
      expect(getByText("Not Applicable")).toBeInTheDocument();
    });

    userEvent.click(getByText("Not Applicable"));

    userEvent.click(saveButton);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Invalid Access Type. Please select at least one Access Type.",
        { variant: "error" }
      );
    });
  });

  it("validates ORCID format", async () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;
    const PIInput = getByTestId("PI-input") as HTMLInputElement;
    const ORCIDInput = getByTestId("ORCID-input") as HTMLInputElement;
    const openAccessCheckbox = getByTestId("openAccess-checkbox");
    const programAutocomplete = getByTestId("program-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.type(studyNameInput, "Test Study Name");
    userEvent.type(PIInput, "John Doe");
    userEvent.type(ORCIDInput, "0");
    userEvent.click(openAccessCheckbox);
    userEvent.type(programAutocomplete, "Not Appl");

    await waitFor(() => {
      expect(getByText("Not Applicable")).toBeInTheDocument();
    });

    userEvent.click(getByText("Not Applicable"));

    userEvent.click(saveButton);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Invalid ORCID format.", {
        variant: "error",
      });
    });
  });

  it("validates dbGaPID format and displays error at the top", async () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;
    const PIInput = getByTestId("PI-input") as HTMLInputElement;
    const dbGaPIDInput = getByTestId("dbGaPID-input") as HTMLInputElement;
    const GPANameInput = getByTestId("GPAName-input") as HTMLInputElement;
    const controlledAccessCheckbox = getByTestId("controlledAccess-checkbox");
    const programAutocomplete = getByTestId("program-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.type(studyNameInput, "Test Study Name");
    userEvent.type(PIInput, "John Doe");
    userEvent.click(controlledAccessCheckbox);
    userEvent.type(GPANameInput, "1234");
    userEvent.type(dbGaPIDInput, "phs12345");
    userEvent.type(programAutocomplete, "Not Appl");

    await waitFor(() => {
      expect(getByText("Not Applicable")).toBeInTheDocument();
    });

    userEvent.click(getByText("Not Applicable"));

    userEvent.click(saveButton);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Invalid dbGaPID format.", {
        variant: "error",
      });
    });
  });

  it("creates a new study successfully", async () => {
    const createApprovedStudyMock: MockedResponse<
      CreateApprovedStudyResp,
      CreateApprovedStudyInput
    > = {
      request: {
        query: CREATE_APPROVED_STUDY,
        variables: {
          PI: "John Doe",
          dbGaPID: "phs123456",
          ORCID: "0000-0001-2345-6789",
          programID: "NA",
          openAccess: true,
          controlledAccess: false,
          name: "Test Study Name",
          acronym: "TSN",
          primaryContactID: "dcp-1",
          useProgramPC: false,
          pendingModelChange: false,
          GPAName: "Test GPA Name",
          isPendingGPA: false,
        },
      },
      result: {
        data: {
          createApprovedStudy: {
            _id: "new-study-id",
          },
        },
      },
    };

    const { getByTestId, queryByTestId, getByText } = render(
      <TestParent mocks={[listActiveDCPsMock, listProgramsMock, createApprovedStudyMock]}>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;
    const studyAbbreviationInput = getByTestId("studyAbbreviation-input") as HTMLInputElement;
    const PIInput = getByTestId("PI-input") as HTMLInputElement;
    const dbGaPIDInput = getByTestId("dbGaPID-input") as HTMLInputElement;
    const GPANameInput = getByTestId("GPAName-input") as HTMLInputElement;
    const ORCIDInput = getByTestId("ORCID-input") as HTMLInputElement;
    const openAccessCheckbox = getByTestId("openAccess-checkbox");
    const sameAsProgramPrimaryContactCheckbox = getByTestId("sameAsProgramPrimaryContact-checkbox");
    const primaryContactIDSelect = within(getByTestId("primaryContactID-select")).getByRole(
      "button"
    );
    const programAutocomplete = getByTestId("program-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.type(programAutocomplete, "Not Appl");
    await waitFor(() => {
      expect(getByText("Not Applicable")).toBeInTheDocument();
    });

    userEvent.click(getByText("Not Applicable"));

    userEvent.type(studyNameInput, "Test Study Name");
    userEvent.type(studyAbbreviationInput, "TSN");
    userEvent.type(PIInput, "John Doe");
    userEvent.type(dbGaPIDInput, "phs123456");
    userEvent.type(GPANameInput, "Test GPA Name");
    userEvent.type(ORCIDInput, "0000-0001-2345-6789");
    userEvent.click(openAccessCheckbox);
    userEvent.click(sameAsProgramPrimaryContactCheckbox);
    userEvent.click(primaryContactIDSelect);

    let muiSelectOptions;
    await waitFor(() => {
      muiSelectOptions = within(getByTestId("primaryContactID-select")).getAllByRole("option", {
        hidden: true,
      });
      expect(muiSelectOptions[0]).toHaveTextContent("<Not Set>");
      expect(muiSelectOptions[1]).toHaveTextContent("John Doe");
      expect(muiSelectOptions[2]).toHaveTextContent("James Smith");
    });

    userEvent.click(muiSelectOptions[1]);

    expect(getByTestId("primaryContactID-select")).toHaveTextContent("John Doe");

    userEvent.click(saveButton);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("This study has been successfully added.", {
        variant: "default",
      });
    });
  });

  it("updates an existing study successfully", async () => {
    const studyId = "existing-study-id";
    const getApprovedStudyMock: MockedResponse<GetApprovedStudyResp, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
        variables: { _id: studyId, partial: false },
      },
      result: {
        data: {
          getApprovedStudy: approvedStudyFactory.build({
            _id: studyId,
            studyName: "Existing Study",
            studyAbbreviation: "ES",
            PI: "Jane Smith",
            dbGaPID: "phs654321",
            ORCID: "0000-0002-3456-7890",
            openAccess: false,
            controlledAccess: true,
            program: organizationFactory.build({
              _id: "NA",
              conciergeID: null,
              conciergeName: null,
            }),
            primaryContact: null,
            useProgramPC: true,
            createdAt: "",
            pendingModelChange: false,
            GPAName: "GPA Name",
          }),
        },
      },
    };

    const updateApprovedStudyMock: MockedResponse<
      UpdateApprovedStudyResp,
      UpdateApprovedStudyInput
    > = {
      request: {
        query: UPDATE_APPROVED_STUDY,
        variables: {
          studyID: studyId,
          PI: "Jane Smith",
          dbGaPID: "phs654321",
          ORCID: "0000-0002-3456-7890",
          programID: "NA",
          openAccess: false,
          controlledAccess: true,
          name: "Updated Study Name",
          acronym: "ES",
          primaryContactID: undefined,
          useProgramPC: true,
          pendingModelChange: false,
          GPAName: "GPA Name",
          isPendingGPA: false,
        },
      },
      result: {
        data: {
          updateApprovedStudy: {
            _id: studyId,
          },
        },
      },
    };

    const { getByTestId, queryByTestId } = render(
      <TestParent
        mocks={[
          listActiveDCPsMock,
          listProgramsMock,
          getApprovedStudyMock,
          updateApprovedStudyMock,
        ]}
      >
        <StudyView _id={studyId} />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getByTestId("studyName-input")).toHaveValue("Existing Study");
    });

    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.clear(studyNameInput);
    userEvent.type(studyNameInput, "Updated Study Name");

    userEvent.click(saveButton);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("All changes have been saved.", {
        variant: "default",
      });
    });
  });

  it("handles API errors gracefully when creating a new study", async () => {
    const createApprovedStudyMock: MockedResponse<
      CreateApprovedStudyResp,
      CreateApprovedStudyInput
    > = {
      request: {
        query: CREATE_APPROVED_STUDY,
        variables: {
          PI: "John Doe",
          dbGaPID: "",
          ORCID: "0000-0001-2345-6789",
          programID: "NA",
          openAccess: true,
          controlledAccess: false,
          name: "Test Study Name",
          acronym: "TSN",
          primaryContactID: "dcp-1",
          useProgramPC: false,
          pendingModelChange: false,
          GPAName: "",
          isPendingGPA: false,
        },
      },
      error: new Error("Unable to create approved study."),
    };

    const { getByTestId, getByText, queryByTestId } = render(
      <TestParent mocks={[listActiveDCPsMock, listProgramsMock, createApprovedStudyMock]}>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;
    const studyAbbreviationInput = getByTestId("studyAbbreviation-input") as HTMLInputElement;
    const PIInput = getByTestId("PI-input") as HTMLInputElement;
    const ORCIDInput = getByTestId("ORCID-input") as HTMLInputElement;
    const openAccessCheckbox = getByTestId("openAccess-checkbox");
    const sameAsProgramPrimaryContactCheckbox = getByTestId("sameAsProgramPrimaryContact-checkbox");
    const primaryContactIDSelect = within(getByTestId("primaryContactID-select")).getByRole(
      "button"
    );
    const programAutocomplete = getByTestId("program-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.type(programAutocomplete, "Not Appl");

    await waitFor(() => {
      expect(getByText("Not Applicable")).toBeInTheDocument();
    });
    userEvent.click(getByText("Not Applicable"));

    userEvent.type(studyNameInput, "Test Study Name");
    userEvent.type(studyAbbreviationInput, "TSN");
    userEvent.type(PIInput, "John Doe");
    userEvent.type(ORCIDInput, "0000-0001-2345-6789");
    userEvent.click(openAccessCheckbox);
    userEvent.click(sameAsProgramPrimaryContactCheckbox);
    userEvent.click(primaryContactIDSelect);

    let muiSelectOptions;
    await waitFor(() => {
      muiSelectOptions = within(getByTestId("primaryContactID-select")).getAllByRole("option", {
        hidden: true,
      });
      expect(muiSelectOptions[0]).toHaveTextContent("<Not Set>");
      expect(muiSelectOptions[1]).toHaveTextContent("John Doe");
      expect(muiSelectOptions[2]).toHaveTextContent("James Smith");
    });

    userEvent.click(muiSelectOptions[1]);

    expect(getByTestId("primaryContactID-select")).toHaveTextContent("John Doe");

    userEvent.click(saveButton);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to create approved study.", {
        variant: "error",
      });
    });
  });

  it("handles API errors gracefully when updating an existing study", async () => {
    const studyId = "existing-study-id";
    const getApprovedStudyMock: MockedResponse<GetApprovedStudyResp, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
        variables: { _id: studyId, partial: false },
      },
      result: {
        data: {
          getApprovedStudy: approvedStudyFactory.build({
            _id: studyId,
            studyName: "Existing Study",
            studyAbbreviation: "USN",
            PI: "Jane Smith",
            dbGaPID: "phs654321",
            ORCID: "0000-0002-3456-7890",
            openAccess: false,
            controlledAccess: true,
            program: organizationFactory.build({ _id: "NA" }),
            primaryContact: null,
            useProgramPC: true,
            createdAt: "",
            pendingModelChange: false,
            GPAName: "Test GPA Name",
          }),
        },
      },
    };

    const updateApprovedStudyMock: MockedResponse<
      UpdateApprovedStudyResp,
      UpdateApprovedStudyInput
    > = {
      request: {
        query: UPDATE_APPROVED_STUDY,
        variables: {
          studyID: studyId,
          PI: "Jane Smith",
          dbGaPID: "phs654321",
          ORCID: "0000-0002-3456-7890",
          programID: "NA",
          openAccess: false,
          controlledAccess: true,
          name: "Updated Study Name",
          acronym: "USN",
          primaryContactID: undefined,
          useProgramPC: true,
          pendingModelChange: false,
          GPAName: "Test GPA Name",
          isPendingGPA: false,
        },
      },
      error: new Error("Unable to save changes"),
    };

    const { getByTestId, queryByTestId } = render(
      <TestParent
        mocks={[
          listActiveDCPsMock,
          listProgramsMock,
          getApprovedStudyMock,
          updateApprovedStudyMock,
        ]}
      >
        <StudyView _id={studyId} />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getByTestId("studyName-input")).toHaveValue("Existing Study");
    });

    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;
    const studyAbbreviationInput = getByTestId("studyAbbreviation-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.clear(studyNameInput);
    userEvent.type(studyNameInput, "Updated Study Name");

    userEvent.clear(studyAbbreviationInput);
    userEvent.type(studyAbbreviationInput, "USN");

    userEvent.click(saveButton);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to save changes", {
        variant: "error",
      });
    });
  });

  it("disables checkboxes and sets readOnly prop when saving is true", async () => {
    const createApprovedStudyMock: MockedResponse<
      CreateApprovedStudyResp,
      CreateApprovedStudyInput
    > = {
      request: {
        query: CREATE_APPROVED_STUDY,
        variables: {
          PI: "John Doe",
          dbGaPID: "",
          ORCID: "0000-0001-2345-6789",
          programID: "NA",
          openAccess: true,
          controlledAccess: false,
          name: "Test Study Name",
          acronym: "",
          primaryContactID: "dcp-1",
          useProgramPC: false,
          pendingModelChange: false,
          GPAName: "",
          isPendingGPA: false,
        },
      },
      result: {
        data: {
          createApprovedStudy: {
            _id: "new-study-id",
          },
        },
      },
      delay: 1000,
    };

    const { getByTestId, queryByTestId, getByText } = render(
      <TestParent mocks={[listActiveDCPsMock, listProgramsMock, createApprovedStudyMock]}>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;
    const PIInput = getByTestId("PI-input") as HTMLInputElement;
    const ORCIDInput = getByTestId("ORCID-input") as HTMLInputElement;
    const sameAsProgramPrimaryContactCheckbox = getByTestId("sameAsProgramPrimaryContact-checkbox");
    const primaryContactIDSelect = within(getByTestId("primaryContactID-select")).getByRole(
      "button"
    );
    const programAutocomplete = getByTestId("program-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.type(programAutocomplete, "Not Appl");

    await waitFor(() => {
      expect(getByText("Not Applicable")).toBeInTheDocument();
    });
    userEvent.click(getByText("Not Applicable"));

    userEvent.type(studyNameInput, "Test Study Name");
    userEvent.type(PIInput, "John Doe");
    userEvent.type(ORCIDInput, "0000-0001-2345-6789");
    userEvent.click(sameAsProgramPrimaryContactCheckbox);
    userEvent.click(primaryContactIDSelect);

    let muiSelectOptions;
    await waitFor(() => {
      muiSelectOptions = within(getByTestId("primaryContactID-select")).getAllByRole("option", {
        hidden: true,
      });
      expect(muiSelectOptions[0]).toHaveTextContent("<Not Set>");
      expect(muiSelectOptions[1]).toHaveTextContent("John Doe");
      expect(muiSelectOptions[2]).toHaveTextContent("James Smith");
    });

    userEvent.click(muiSelectOptions[1]);

    expect(getByTestId("primaryContactID-select")).toHaveTextContent("John Doe");

    const openAccessCheckbox = getByTestId("openAccess-checkbox") as HTMLInputElement;
    userEvent.click(openAccessCheckbox);

    userEvent.click(saveButton);

    await waitFor(() => {
      expect(openAccessCheckbox).toBeDisabled();
      const controlledAccessCheckbox = getByTestId("controlledAccess-checkbox") as HTMLInputElement;
      expect(controlledAccessCheckbox).toBeDisabled();
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("This study has been successfully added.", {
        variant: "default",
      });
    });
  });

  it("navigates to manage studies page with error when GET_APPROVED_STUDY query fails", async () => {
    const studyId = "non-existent-study-id";

    const getApprovedStudyMock: MockedResponse<GetApprovedStudyResp, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
        variables: { _id: studyId, partial: false },
      },
      error: new ApolloError({ errorMessage: null }),
    };

    const { queryByTestId } = render(
      <TestParent mocks={[listActiveDCPsMock, listProgramsMock, getApprovedStudyMock]}>
        <StudyView _id={studyId} />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/studies", {
        state: { error: "Unable to fetch study." },
      });
    });
  });

  it("does not set form values for fields that are null", async () => {
    const studyId = "study-with-null-fields";
    const getApprovedStudyMock: MockedResponse<GetApprovedStudyResp, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
        variables: { _id: studyId, partial: false },
      },
      result: {
        data: {
          getApprovedStudy: approvedStudyFactory.build({
            _id: studyId,
            studyName: "Study With Null Fields",
            studyAbbreviation: null,
            dbGaPID: "phs123456",
            controlledAccess: false,
            openAccess: true,
            PI: null,
            ORCID: "0000-0001-2345-6789",
            program: organizationFactory.build({ _id: "NA" }),
            createdAt: "",
            useProgramPC: false,
            primaryContact: null,
            pendingModelChange: false,
          }),
        },
      },
    };

    const { getByTestId, queryByTestId } = render(
      <TestParent mocks={[listActiveDCPsMock, listProgramsMock, getApprovedStudyMock]}>
        <StudyView _id={studyId} />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getByTestId("studyName-input")).toHaveValue("Study With Null Fields");
      expect(getByTestId("studyAbbreviation-input")).toHaveValue("");
      expect(getByTestId("PI-input")).toHaveValue("");
      expect(getByTestId("dbGaPID-input")).toHaveValue("phs123456");
    });
  });

  it("navigates back to manage studies page when cancel button is clicked", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const cancelButton = getByTestId("cancel-button");
    userEvent.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith("/studies");
  });

  it("sets error message when createApprovedStudy mutation fails", async () => {
    const createApprovedStudyMock: MockedResponse<
      CreateApprovedStudyResp,
      CreateApprovedStudyInput
    > = {
      request: {
        query: CREATE_APPROVED_STUDY,
        variables: {
          PI: "John Doe",
          dbGaPID: "",
          ORCID: "0000-0001-2345-6789",
          programID: "NA",
          openAccess: true,
          controlledAccess: false,
          name: "Test Study Name",
          acronym: "",
          primaryContactID: "dcp-1",
          useProgramPC: false,
          pendingModelChange: false,
          GPAName: "",
          isPendingGPA: false,
        },
      },
      error: new ApolloError({ errorMessage: null }),
    };

    const { getByTestId, queryByTestId, getByText } = render(
      <TestParent mocks={[listActiveDCPsMock, listProgramsMock, createApprovedStudyMock]}>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;
    const PIInput = getByTestId("PI-input") as HTMLInputElement;
    const ORCIDInput = getByTestId("ORCID-input") as HTMLInputElement;
    const openAccessCheckbox = getByTestId("openAccess-checkbox") as HTMLInputElement;
    const sameAsProgramPrimaryContactCheckbox = getByTestId("sameAsProgramPrimaryContact-checkbox");
    const primaryContactIDSelect = within(getByTestId("primaryContactID-select")).getByRole(
      "button"
    );
    const programAutocomplete = getByTestId("program-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.type(programAutocomplete, "Not Appl");

    await waitFor(() => {
      expect(getByText("Not Applicable")).toBeInTheDocument();
    });
    userEvent.click(getByText("Not Applicable"));

    userEvent.type(studyNameInput, "Test Study Name");
    userEvent.type(PIInput, "John Doe");
    userEvent.type(ORCIDInput, "0000-0001-2345-6789");
    userEvent.click(sameAsProgramPrimaryContactCheckbox);
    userEvent.click(openAccessCheckbox);
    userEvent.click(primaryContactIDSelect);

    let muiSelectOptions;
    await waitFor(() => {
      muiSelectOptions = within(getByTestId("primaryContactID-select")).getAllByRole("option", {
        hidden: true,
      });
      expect(muiSelectOptions[0]).toHaveTextContent("<Not Set>");
      expect(muiSelectOptions[1]).toHaveTextContent("John Doe");
      expect(muiSelectOptions[2]).toHaveTextContent("James Smith");
    });

    userEvent.click(muiSelectOptions[1]);

    expect(getByTestId("primaryContactID-select")).toHaveTextContent("John Doe");

    userEvent.click(saveButton);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to create approved study.", {
        variant: "error",
      });
    });
  });

  it("sets error message when updateApprovedStudy mutation fails", async () => {
    const studyId = "existing-study-id";
    const getApprovedStudyMock: MockedResponse<GetApprovedStudyResp, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
        variables: { _id: studyId, partial: false },
      },
      result: {
        data: {
          getApprovedStudy: approvedStudyFactory.build({
            _id: studyId,
            studyName: "Existing Study",
            studyAbbreviation: "ES",
            PI: "Jane Smith",
            dbGaPID: "phs654321",
            ORCID: "0000-0002-3456-7890",
            openAccess: false,
            controlledAccess: true,
            program: organizationFactory.build({ _id: "NA" }),
            primaryContact: null,
            useProgramPC: true,
            createdAt: "",
            pendingModelChange: false,
            GPAName: "Test GPA Name",
          }),
        },
      },
    };

    const updateApprovedStudyMock: MockedResponse<
      UpdateApprovedStudyResp,
      UpdateApprovedStudyInput
    > = {
      request: {
        query: UPDATE_APPROVED_STUDY,
        variables: {
          studyID: studyId,
          PI: "Jane Smith",
          dbGaPID: "phs654321",
          ORCID: "0000-0002-3456-7890",
          programID: "NA",
          openAccess: false,
          controlledAccess: true,
          name: "Updated Study Name",
          acronym: "ES",
          primaryContactID: undefined,
          useProgramPC: true,
          pendingModelChange: false,
          GPAName: "Test GPA Name",
          isPendingGPA: false,
        },
      },
      error: new ApolloError({ errorMessage: null }),
    };

    const { getByTestId, queryByTestId } = render(
      <TestParent
        mocks={[
          listActiveDCPsMock,
          listProgramsMock,
          getApprovedStudyMock,
          updateApprovedStudyMock,
        ]}
      >
        <StudyView _id={studyId} />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getByTestId("studyName-input")).toHaveValue("Existing Study");
    });

    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;
    const saveButton = getByTestId("save-button");

    userEvent.clear(studyNameInput);
    userEvent.type(studyNameInput, "Updated Study Name");

    userEvent.click(saveButton);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to save changes", {
        variant: "error",
      });
    });
  });

  it("renders the pendingModelChange checkbox", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    expect(getByTestId("pendingConditions-checkbox")).toBeInTheDocument();
  });

  it("allows toggling the pendingModelChange checkbox", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const checkbox = getByTestId("pendingConditions-checkbox") as HTMLInputElement;

    expect(checkbox.checked).toBe(false);

    userEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    userEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it("saves the pendingModelChange value when creating a study", async () => {
    const createApprovedStudyMock: MockedResponse<
      CreateApprovedStudyResp,
      CreateApprovedStudyInput
    > = {
      request: {
        query: CREATE_APPROVED_STUDY,
        variables: {
          PI: "John Doe",
          dbGaPID: "",
          ORCID: "0000-0001-2345-6789",
          programID: "NA",
          openAccess: true,
          controlledAccess: false,
          name: "Test Study Name",
          acronym: "",
          primaryContactID: "dcp-1",
          useProgramPC: false,
          pendingModelChange: true,
          GPAName: "",
          isPendingGPA: false,
        },
      },
      result: {
        data: {
          createApprovedStudy: {
            _id: "new-study-id",
          },
        },
      },
    };

    const { getByTestId, queryByTestId, getByText } = render(
      <TestParent mocks={[listActiveDCPsMock, listProgramsMock, createApprovedStudyMock]}>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const primaryContactIDSelect = within(getByTestId("primaryContactID-select")).getByRole(
      "button"
    );
    const programAutocomplete = getByTestId("program-input") as HTMLInputElement;

    userEvent.type(programAutocomplete, "Not Appl");

    await waitFor(() => {
      expect(getByText("Not Applicable")).toBeInTheDocument();
    });
    userEvent.click(getByText("Not Applicable"));

    userEvent.type(getByTestId("studyName-input"), "Test Study Name");
    userEvent.type(getByTestId("PI-input"), "John Doe");
    userEvent.type(getByTestId("ORCID-input"), "0000-0001-2345-6789");
    userEvent.click(getByTestId("openAccess-checkbox"));
    userEvent.click(getByTestId("sameAsProgramPrimaryContact-checkbox"));
    userEvent.click(getByTestId("pendingConditions-checkbox"));
    userEvent.click(primaryContactIDSelect);

    let muiSelectOptions;
    await waitFor(() => {
      muiSelectOptions = within(getByTestId("primaryContactID-select")).getAllByRole("option", {
        hidden: true,
      });

      expect(muiSelectOptions[1]).toHaveTextContent("John Doe");
    });
    userEvent.click(muiSelectOptions[1]);
    userEvent.click(getByTestId("save-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("This study has been successfully added.", {
        variant: "default",
      });
    });
  });

  it("updates the pendingModelChange value when updating an existing study", async () => {
    const studyId = "existing-study-id";
    const getApprovedStudyMock: MockedResponse<GetApprovedStudyResp, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
        variables: { _id: studyId, partial: false },
      },
      result: {
        data: {
          getApprovedStudy: approvedStudyFactory.build({
            _id: studyId,
            studyName: "Existing Study",
            studyAbbreviation: "ES",
            PI: "Jane Smith",
            dbGaPID: "phs654321",
            ORCID: "0000-0002-3456-7890",
            openAccess: false,
            controlledAccess: true,
            program: organizationFactory.build({ _id: "NA" }),
            primaryContact: null,
            useProgramPC: true,
            createdAt: "",
            pendingModelChange: false,
            GPAName: "Test GPA Name",
          }),
        },
      },
    };

    const updateApprovedStudyMock: MockedResponse<
      UpdateApprovedStudyResp,
      UpdateApprovedStudyInput
    > = {
      request: {
        query: UPDATE_APPROVED_STUDY,
        variables: {
          studyID: studyId,
          PI: "Jane Smith",
          dbGaPID: "phs654321",
          ORCID: "0000-0002-3456-7890",
          programID: "NA",
          openAccess: false,
          controlledAccess: true,
          name: "Existing Study",
          acronym: "ES",
          primaryContactID: undefined,
          useProgramPC: true,
          pendingModelChange: true,
          GPAName: "Test GPA Name",
          isPendingGPA: false,
        },
      },
      result: {
        data: {
          updateApprovedStudy: {
            _id: studyId,
          },
        },
      },
    };

    const { getByTestId, queryByTestId } = render(
      <TestParent
        mocks={[
          listActiveDCPsMock,
          listProgramsMock,
          getApprovedStudyMock,
          updateApprovedStudyMock,
        ]}
      >
        <StudyView _id={studyId} />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getByTestId("studyName-input")).toHaveValue("Existing Study");
    });

    const pendingCheckbox = getByTestId("pendingConditions-checkbox") as HTMLInputElement;
    expect(pendingCheckbox.checked).toBe(false);
    userEvent.click(pendingCheckbox);
    expect(pendingCheckbox.checked).toBe(true);

    userEvent.click(getByTestId("save-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("All changes have been saved.", {
        variant: "default",
      });
    });
  });
});

describe("Implementation Requirements", () => {
  it("should check 'Pending on dbGaPID' when controlledAccess is true and dbGaPID is empty", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const controlledAccessCheckbox = getByTestId("controlledAccess-checkbox") as HTMLInputElement;
    userEvent.click(controlledAccessCheckbox);

    const dbGaPIDInput = getByTestId("dbGaPID-input") as HTMLInputElement;
    expect(dbGaPIDInput.value).toBe("");

    const pendingDbGaPIDCheckbox = getByTestId(
      "pendingConditions-dbGaPID-checkbox"
    ) as HTMLInputElement;
    expect(pendingDbGaPIDCheckbox.checked).toBe(true);
    expect(pendingDbGaPIDCheckbox).toBeDisabled();
  });

  it("should uncheck 'Pending on dbGaPID' when controlledAccess is false", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const controlledAccessCheckbox = getByTestId("controlledAccess-checkbox") as HTMLInputElement;
    userEvent.click(controlledAccessCheckbox);
    expect(controlledAccessCheckbox.checked).toBe(true);

    const pendingDbGaPIDCheckbox = getByTestId(
      "pendingConditions-dbGaPID-checkbox"
    ) as HTMLInputElement;
    expect(pendingDbGaPIDCheckbox.checked).toBe(true);
    expect(pendingDbGaPIDCheckbox).toBeDisabled();

    userEvent.click(controlledAccessCheckbox);
    expect(controlledAccessCheckbox.checked).toBe(false);

    expect(pendingDbGaPIDCheckbox.checked).toBe(false);
    expect(pendingDbGaPIDCheckbox).toBeDisabled();
  });

  it("should uncheck 'Pending on dbGaPID' when dbGaPID is filled and controlledAccess is true", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const controlledAccessCheckbox = getByTestId("controlledAccess-checkbox") as HTMLInputElement;
    userEvent.click(controlledAccessCheckbox);

    const pendingDbGaPIDCheckbox = getByTestId(
      "pendingConditions-dbGaPID-checkbox"
    ) as HTMLInputElement;
    expect(pendingDbGaPIDCheckbox.checked).toBe(true);
    expect(pendingDbGaPIDCheckbox).toBeDisabled();

    const dbGaPIDInput = getByTestId("dbGaPID-input") as HTMLInputElement;
    userEvent.type(dbGaPIDInput, "phs123456");

    expect(pendingDbGaPIDCheckbox.checked).toBe(false);
    expect(pendingDbGaPIDCheckbox).toBeDisabled();
  });

  it("should check 'Pending on Genomic Program Administrator (GPA)' when controlledAccess is true and GPA is empty", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const controlledAccessCheckbox = getByTestId("controlledAccess-checkbox") as HTMLInputElement;
    userEvent.click(controlledAccessCheckbox);

    const gpaInput = getByTestId("GPAName-input") as HTMLInputElement;
    expect(gpaInput.value).toBe("");

    const pendingGpaCheckbox = getByTestId("pendingConditions-gpa-checkbox") as HTMLInputElement;
    expect(pendingGpaCheckbox.checked).toBe(true);
    expect(pendingGpaCheckbox).toBeDisabled();
  });

  it("should uncheck 'Pending on Genomic Program Administrator (GPA)' when controlledAccess is false", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const controlledAccessCheckbox = getByTestId("controlledAccess-checkbox") as HTMLInputElement;
    userEvent.click(controlledAccessCheckbox);
    expect(controlledAccessCheckbox.checked).toBe(true);

    const pendingGpaCheckbox = getByTestId("pendingConditions-gpa-checkbox") as HTMLInputElement;
    expect(pendingGpaCheckbox.checked).toBe(true);
    expect(pendingGpaCheckbox).toBeDisabled();

    userEvent.click(controlledAccessCheckbox);
    expect(controlledAccessCheckbox.checked).toBe(false);

    expect(pendingGpaCheckbox.checked).toBe(false);
    expect(pendingGpaCheckbox).toBeDisabled();
  });

  it("should uncheck 'Pending on Genomic Program Administrator (GPA)' when GPA is filled and controlledAccess is true", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(async () => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const controlledAccessCheckbox = getByTestId("controlledAccess-checkbox") as HTMLInputElement;
    userEvent.click(controlledAccessCheckbox);

    const pendingGpaCheckbox = getByTestId("pendingConditions-gpa-checkbox") as HTMLInputElement;
    expect(pendingGpaCheckbox.checked).toBe(true);
    expect(pendingGpaCheckbox).toBeDisabled();

    const gpaInput = getByTestId("GPAName-input") as HTMLInputElement;
    userEvent.type(gpaInput, "Jane Doe");

    expect(pendingGpaCheckbox.checked).toBe(false);
    expect(pendingGpaCheckbox).toBeDisabled();
  });

  it("should not allow a study name larger than 1000 characters", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(() => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const programAutocomplete = getByTestId("program-input") as HTMLInputElement;
    const openAccessCheckbox = getByTestId("openAccess-checkbox") as HTMLInputElement;
    const studyNameInput = getByTestId("studyName-input") as HTMLInputElement;

    userEvent.click(openAccessCheckbox);
    userEvent.paste(programAutocomplete, "Not Applicable");
    userEvent.paste(studyNameInput, "x".repeat(2000));

    // Input only keeps first 1000 chars
    expect(studyNameInput.value.length).toBe(1000);
    expect(studyNameInput).toHaveValue("x".repeat(1000));
  });

  it("should default to 'Not Applicable' instead of empty program field", async () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <StudyView _id="new" />
      </TestParent>
    );

    await waitFor(() => {
      expect(queryByTestId("study-view-suspense-loader")).not.toBeInTheDocument();
    });

    const programAutocomplete = getByTestId("program-input") as HTMLInputElement;

    await waitFor(() => {
      expect(programAutocomplete.value).toBe("Not Applicable");
    });
  });
});
