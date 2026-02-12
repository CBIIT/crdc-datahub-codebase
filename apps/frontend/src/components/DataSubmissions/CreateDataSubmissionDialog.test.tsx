import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC } from "react";

import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import {
  CREATE_SUBMISSION,
  CreateSubmissionResp,
  GetMyUserResp,
  LIST_APPROVED_STUDIES,
  ListApprovedStudiesInput,
  ListApprovedStudiesResp,
} from "../../graphql";
import { TestRouter, render, waitFor, within } from "../../test-utils";
import { Context as AuthCtx, ContextState as AuthCtxState } from "../Contexts/AuthContext";

import CreateDataSubmissionDialog from "./CreateDataSubmissionDialog";

const partialStudyProperties = [
  "_id",
  "studyName",
  "studyAbbreviation",
  "dbGaPID",
  "controlledAccess",
  "pendingModelChange",
  "isPendingGPA",
] satisfies (keyof ApprovedStudy)[];

const baseStudies: GetMyUserResp["getMyUser"]["studies"] = [
  approvedStudyFactory.pick(partialStudyProperties).build({
    _id: "study1",
    studyName: "study-name",
    studyAbbreviation: "SN",
    dbGaPID: "phsTEST",
    controlledAccess: null,
    pendingModelChange: false,
  }),
  approvedStudyFactory.pick(partialStudyProperties).build({
    _id: "study2",
    studyName: "controlled-study",
    studyAbbreviation: "CS",
    dbGaPID: "phsTEST",
    controlledAccess: true,
    pendingModelChange: false,
  }),
  approvedStudyFactory.pick(partialStudyProperties).build({
    _id: "no-dbGaP-ID",
    studyName: "controlled-study",
    studyAbbreviation: "DB",
    dbGaPID: null,
    controlledAccess: true,
    pendingModelChange: false,
  }),
  approvedStudyFactory.pick(partialStudyProperties).build({
    _id: "pending-model-changes",
    studyName: "study with pending model changes",
    studyAbbreviation: "PMC",
    dbGaPID: "phsTEST",
    controlledAccess: null,
    pendingModelChange: true,
  }),
  approvedStudyFactory.pick(partialStudyProperties).build({
    _id: "pending-GPA-condition",
    studyName: "study with pending GPA condition",
    studyAbbreviation: "PGC",
    dbGaPID: "phsTEST",
    controlledAccess: true,
    pendingModelChange: false,
    isPendingGPA: true,
  }),
  approvedStudyFactory.pick(partialStudyProperties).build({
    _id: "pending-conditions",
    studyName: "study with pending conditions",
    studyAbbreviation: "PC",
    dbGaPID: null,
    controlledAccess: true,
    pendingModelChange: true,
    isPendingGPA: true,
  }),
];

const basePermissions: AuthPermissions[] = ["data_submission:view", "data_submission:create"];

const createSubmissionMocks: MockedResponse<CreateSubmissionResp>[] = [
  {
    request: {
      query: CREATE_SUBMISSION,
      variables: {
        studyID: "study1",
        dataCommons: "CDS",
        name: "Test Submission",
        intention: "New/Update",
        dataType: "Metadata and Data Files",
      },
    },
    result: {
      data: {
        createSubmission: {
          _id: "submission-123",
          status: "New",
          createdAt: new Date().toString(),
        },
      },
    },
  },
];

type ParentProps = {
  mocks?: MockedResponse[];
  authCtxState?: AuthCtxState;
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  authCtxState = authCtxStateFactory.build(),
  mocks = [...createSubmissionMocks],
  children,
}) => (
  <AuthCtx.Provider value={authCtxState}>
    <MockedProvider mocks={mocks} addTypename={false}>
      <TestRouter>{children}</TestRouter>
    </MockedProvider>
  </AuthCtx.Provider>
);

describe("Basic Functionality", () => {
  const handleCreate = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog and form inputs correctly", async () => {
    const { getByText, getByRole } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({
            role: "Submitter",
            permissions: basePermissions,
          }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      const createButton = getByRole("button", { name: "Create" });
      expect(createButton).toBeInTheDocument();
      expect(handleCreate).toHaveBeenCalledTimes(0);
      expect(
        getByText("Please fill out the form below to start your data submission")
      ).toBeInTheDocument();
      expect(getByText("Submission Type")).toBeInTheDocument();
      expect(getByText("Data Type")).toBeInTheDocument();
      expect(getByText("Data Commons")).toBeInTheDocument();
      expect(getByText("Study")).toBeInTheDocument();
      expect(getByText("dbGaP ID")).toBeInTheDocument();
      expect(getByText("Submission Name")).toBeInTheDocument();
    });
  });

  it("submits the form successfully", async () => {
    const { getByTestId, getByRole } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({
            role: "Submitter",
            studies: baseStudies,
            permissions: basePermissions,
          }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
      const studySelectInput = getByTestId("create-data-submission-dialog-study-id-input");
      expect(studySelectInput).toBeInTheDocument();
    });

    // Simulate selecting study from dropdown
    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");
    expect(studySelectButton).toBeInTheDocument();

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-study1"));

    expect(studySelectButton).toHaveTextContent("SN");

    // Simulate typing into Submission Name input
    const submissionNameWrapper = getByTestId(
      "create-data-submission-dialog-submission-name-input"
    );
    const submissionNameInput = within(submissionNameWrapper).getByRole("textbox");
    userEvent.type(submissionNameInput, "Test Submission");

    await waitFor(() => {
      expect(submissionNameInput).toHaveValue("Test Submission");
    });

    // Simulate creating the new data submission and closing the dialog
    const createButton = getByRole("button", { name: "Create" });
    expect(createButton).toBeInTheDocument();
    userEvent.click(createButton);

    await waitFor(() => {
      expect(createButton).not.toBeInTheDocument();
    });

    expect(handleCreate).toHaveBeenCalledTimes(1);
  });

  it("should only show the dbGaP ID if study is controlled access", async () => {
    const { getByRole, getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({
            role: "Submitter",
            studies: baseStudies,
            permissions: basePermissions,
          }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
      const studySelectInput = getByTestId("create-data-submission-dialog-study-id-input");
      expect(studySelectInput).toBeInTheDocument();
    });

    // Simulate selecting study from dropdown
    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");
    expect(studySelectButton).toBeInTheDocument();

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-study1"));

    // Non-Controlled study selected
    expect(studySelectButton).toHaveTextContent("SN");

    expect(getByTestId("dbGaP-id-label")).not.toBeVisible();

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-study2"));

    // Controlled study selected
    expect(studySelectButton).toHaveTextContent("CS");

    expect(getByTestId("dbGaP-id-label")).toBeVisible();
  });

  it("sets dbGaPID to an empty string and isDbGapRequired to false when studyID is not found", async () => {
    const { getByRole, getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({
            role: "Submitter",
            studies: baseStudies,
            permissions: basePermissions,
          }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
      const studySelectInput = getByTestId("create-data-submission-dialog-study-id-input");
      expect(studySelectInput).toBeInTheDocument();
    });

    // Simulate selecting study from dropdown
    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");
    expect(studySelectButton).toBeInTheDocument();

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-no-dbGaP-ID"));

    expect(studySelectButton).toHaveTextContent("DB");

    const dbGaPIDLabel = getByTestId("dbGaP-id-label");
    const dbGaPIDWrapper = getByTestId("create-data-submission-dialog-dbgap-id-input");
    const dbGaPIDInput = within(dbGaPIDWrapper).getByRole("textbox");

    expect(dbGaPIDLabel.textContent).toBe("dbGaP ID*");
    expect(dbGaPIDInput).toHaveValue("");
  });

  it("should show an error message when submission could not be created (network)", async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: CREATE_SUBMISSION,
          variables: {
            studyID: "study1",
            dataCommons: "CDS",
            name: "Test Submission",
            intention: "New/Update",
            dataType: "Metadata and Data Files",
          },
        },
        error: new Error("Simulated network error"),
      },
    ];

    const { getByText, getByRole, getByTestId } = render(
      <TestParent
        mocks={mocks}
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({
            role: "Submitter",
            studies: baseStudies,
            permissions: basePermissions,
          }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
      const studySelectInput = getByTestId("create-data-submission-dialog-study-id-input");
      expect(studySelectInput).toBeInTheDocument();
    });

    // Simulate selecting study from dropdown
    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");
    expect(studySelectButton).toBeInTheDocument();

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-study1"));

    expect(studySelectButton).toHaveTextContent("SN");

    // Simulate typing into Submission Name input
    const submissionNameWrapper = getByTestId(
      "create-data-submission-dialog-submission-name-input"
    );
    const submissionNameInput = within(submissionNameWrapper).getByRole("textbox");
    userEvent.type(submissionNameInput, "Test Submission");

    await waitFor(() => {
      expect(submissionNameInput).toHaveValue("Test Submission");
    });

    // Simulate creating the new data submission and closing the dialog
    const createButton = getByRole("button", { name: "Create" });
    expect(createButton).toBeInTheDocument();
    userEvent.click(createButton);

    await waitFor(() => {
      expect(
        getByText("Unable to create this data submission. If the problem persists please contact")
      ).toBeInTheDocument();
    });
  });

  it("should show an error message when submission could not be created (GraphQL)", async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: CREATE_SUBMISSION,
          variables: {
            studyID: "study1",
            dataCommons: "CDS",
            name: "Test Submission",
            intention: "New/Update",
            dataType: "Metadata and Data Files",
          },
        },
        result: {
          errors: [new GraphQLError("Simulated GraphQL error")],
        },
      },
    ];

    const { getByText, getByRole, getByTestId } = render(
      <TestParent
        mocks={mocks}
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({
            role: "Submitter",
            studies: baseStudies,
            permissions: basePermissions,
          }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
      const studySelectInput = getByTestId("create-data-submission-dialog-study-id-input");
      expect(studySelectInput).toBeInTheDocument();
    });

    // Simulate selecting study from dropdown
    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");
    expect(studySelectButton).toBeInTheDocument();

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-study1"));

    expect(studySelectButton).toHaveTextContent("SN");

    // Simulate typing into Submission Name input
    const submissionNameWrapper = getByTestId(
      "create-data-submission-dialog-submission-name-input"
    );
    const submissionNameInput = within(submissionNameWrapper).getByRole("textbox");
    userEvent.type(submissionNameInput, "Test Submission");

    await waitFor(() => {
      expect(submissionNameInput).toHaveValue("Test Submission");
    });

    // Simulate creating the new data submission and closing the dialog
    const createButton = getByRole("button", { name: "Create" });
    expect(createButton).toBeInTheDocument();
    userEvent.click(createButton);

    await waitFor(() => {
      expect(
        getByText("Unable to create this data submission. If the problem persists please contact")
      ).toBeInTheDocument();
    });
  });

  it("should show message field is required but input is empty", async () => {
    const { getByText, getByRole, getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({
            role: "Submitter",
            studies: baseStudies,
            permissions: basePermissions,
          }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
      const studySelectInput = getByTestId("create-data-submission-dialog-study-id-input");
      expect(studySelectInput).toBeInTheDocument();
    });

    // Simulate selecting study from dropdown
    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");
    expect(studySelectButton).toBeInTheDocument();

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-study1"));

    expect(studySelectButton).toHaveTextContent("SN");

    // Simulate creating the new data submission and closing the dialog
    const createButton = getByRole("button", { name: "Create" });
    expect(createButton).toBeInTheDocument();
    userEvent.click(createButton);

    await waitFor(() => {
      expect(getByText("This field is required")).toBeInTheDocument();
    });
  });

  it("sets dataType to 'Metadata and Data Files' when intention is 'New/Update'", async () => {
    const { getByRole, getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Submitter", permissions: basePermissions }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
      const studySelectInput = getByTestId("create-data-submission-dialog-study-id-input");
      expect(studySelectInput).toBeInTheDocument();
    });

    // Simulate selecting 'New/Update' for intention
    const intentionInput = getByTestId("create-data-submission-dialog-submission-type-input");
    const newUpdateOption = within(intentionInput).getByText("New/Update");
    userEvent.click(newUpdateOption);

    await waitFor(() => {
      const dataTypeInput = getByTestId("create-data-submission-dialog-data-type-input");
      expect(dataTypeInput).toHaveTextContent("Metadata and Data Files");
    });
  });

  it("sets dataType to 'Metadata Only' when intention is 'Delete'", async () => {
    const { getByRole, getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Submitter", permissions: basePermissions }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
      const studySelectInput = getByTestId("create-data-submission-dialog-study-id-input");
      expect(studySelectInput).toBeInTheDocument();
    });

    // Simulate selecting 'Delete' for intention
    const intentionInput = getByTestId("create-data-submission-dialog-submission-type-input");
    const deleteOption = within(intentionInput).getByText("Delete");
    userEvent.click(deleteOption);

    await waitFor(() => {
      const dataTypeInput = getByTestId("create-data-submission-dialog-data-type-input");
      expect(dataTypeInput).toHaveTextContent("Metadata Only");
    });
  });

  it("sets studyID to an empty string when not provided", async () => {
    const { getByTestId, getByRole } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Submitter", permissions: basePermissions }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
      const studySelectButton = within(
        getByTestId("create-data-submission-dialog-study-id-input")
      ).getByRole("button");
      // MUI adds zero-width space
      expect(studySelectButton.textContent).toBe("​");
    });
  });

  it("sets name to an empty string when not provided", async () => {
    const { getByTestId, getByRole } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Submitter", permissions: basePermissions }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
      const studySelectInput = getByTestId("create-data-submission-dialog-study-id-input");
      expect(studySelectInput).toBeInTheDocument();
    });

    const nameWrapper = getByTestId("create-data-submission-dialog-submission-name-input");
    const nameInput = within(nameWrapper).getByRole("textbox");

    expect(nameInput).toHaveValue("");
  });

  it("closes the dialog when the close button is clicked", async () => {
    const { getByTestId, getByRole } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Submitter", permissions: basePermissions }),
        })}
      >
        <CreateDataSubmissionDialog onCreate={handleCreate} />
      </TestParent>
    );
    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
      const studySelectInput = getByTestId("create-data-submission-dialog-study-id-input");
      expect(studySelectInput).toBeInTheDocument();
    });

    const createButton = getByRole("button", { name: "Create" });

    // Simulate clicking the close button
    const closeButton = getByTestId("create-submission-dialog-close-button");
    userEvent.click(closeButton);

    await waitFor(() => {
      expect(createButton).not.toBeInTheDocument();
    });
  });

  it("should show an error if the Submission Name contains emojis", async () => {
    const { getByTestId, getByRole, getByText } = render(
      <CreateDataSubmissionDialog onCreate={handleCreate} />,
      {
        wrapper: (p) => (
          <TestParent
            authCtxState={authCtxStateFactory.build({
              user: userFactory.build({
                role: "Submitter",
                studies: baseStudies,
                permissions: basePermissions,
              }),
            })}
            {...p}
          />
        ),
      }
    );

    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    expect(openDialogButton).toBeInTheDocument();

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getByTestId("create-data-submission-dialog-study-id-input")).toBeEnabled();
    });

    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");
    expect(studySelectButton).toBeInTheDocument();

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-study1"));

    expect(studySelectButton).toHaveTextContent("SN");

    const submissionNameWrapper = getByTestId(
      "create-data-submission-dialog-submission-name-input"
    );
    const submissionNameInput = within(submissionNameWrapper).getByRole("textbox");
    userEvent.type(submissionNameInput, "😁 Emojis are not valid 😁");

    userEvent.click(getByText("Create"));

    await waitFor(() => {
      expect(getByText("This field contains invalid characters")).toBeInTheDocument();
    });
  });
});

describe("Implementation Requirements", () => {
  it("should disable the Create button if dbGaP ID is required and not added to the study", async () => {
    const ApprovedStudyNoDbGaPID: GetMyUserResp["getMyUser"]["studies"] = [
      {
        _id: "controlled",
        studyName: "controlled-study",
        studyAbbreviation: "CS",
        dbGaPID: null,
        controlledAccess: true,
        pendingModelChange: false,
        isPendingGPA: false,
      },
    ];

    const { getByRole, getByTestId } = render(<CreateDataSubmissionDialog onCreate={vi.fn()} />, {
      wrapper: (p) => (
        <TestParent
          mocks={[]}
          authCtxState={authCtxStateFactory.build({
            user: userFactory.build({
              role: "Submitter",
              studies: ApprovedStudyNoDbGaPID,
              permissions: basePermissions,
            }),
          })}
          {...p}
        />
      ),
    });

    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-data-submission-dialog-study-id-input")).toBeInTheDocument();
    });

    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-controlled"));

    await waitFor(() => {
      expect(getByTestId("create-data-submission-dialog-create-button")).toBeDisabled();
    });
  });

  it("should show an alert icon next to dbGaPID if it is required and not added to the study", async () => {
    const ApprovedStudyNoDbGaPID: GetMyUserResp["getMyUser"]["studies"] = [
      {
        _id: "controlled",
        studyName: "controlled-study",
        studyAbbreviation: "CS",
        dbGaPID: null,
        controlledAccess: true,
        pendingModelChange: false,
        isPendingGPA: false,
      },
    ];

    const { getByRole, getByTestId } = render(<CreateDataSubmissionDialog onCreate={vi.fn()} />, {
      wrapper: (p) => (
        <TestParent
          mocks={[]}
          authCtxState={authCtxStateFactory.build({
            user: userFactory.build({
              role: "Submitter",
              studies: ApprovedStudyNoDbGaPID,
              permissions: basePermissions,
            }),
          })}
          {...p}
        />
      ),
    });

    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-data-submission-dialog-study-id-input")).toBeInTheDocument();
    });

    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-controlled"));

    await waitFor(() => {
      expect(getByTestId("pending-conditions-icon")).toBeInTheDocument();
    });

    userEvent.hover(getByTestId("pending-conditions-icon"));

    await waitFor(() => {
      expect(getByRole("tooltip")).toBeInTheDocument();
    });

    expect(getByRole("tooltip")).toHaveTextContent(
      "Please contact NCICRDC@mail.nih.gov to submit your dbGaP ID once you have registered your study on dbGap.",
      { normalizeWhitespace: true }
    );
  });

  it("should hide the dbGaPID field if controlledAccess is false", async () => {
    const ApprovedStudyNoDbGaPID: GetMyUserResp["getMyUser"]["studies"] = [
      {
        _id: "controlled",
        studyName: "controlled-study",
        studyAbbreviation: "CS",
        dbGaPID: "phsTEST",
        controlledAccess: true,
        pendingModelChange: false,
        isPendingGPA: false,
      },
      {
        _id: "non-controlled",
        studyName: "non-controlled-study",
        studyAbbreviation: "NCS",
        dbGaPID: null,
        controlledAccess: false,
        pendingModelChange: false,
        isPendingGPA: false,
      },
    ];

    const { getByRole, getByTestId } = render(<CreateDataSubmissionDialog onCreate={vi.fn()} />, {
      wrapper: (p) => (
        <TestParent
          mocks={[]}
          authCtxState={authCtxStateFactory.build({
            user: userFactory.build({
              role: "Submitter",
              studies: ApprovedStudyNoDbGaPID,
              permissions: basePermissions,
            }),
          })}
          {...p}
        />
      ),
    });

    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-data-submission-dialog-study-id-input")).toBeInTheDocument();
    });

    // --- CONTROLLED STUDY ---
    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-controlled"));

    await waitFor(() => {
      expect(getByTestId("create-data-submission-dialog-dbgap-id-input")).toBeVisible();
    });

    // --- NON-CONTROLLED STUDY ---
    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-non-controlled"));

    await waitFor(() => {
      expect(getByTestId("create-data-submission-dialog-dbgap-id-input")).not.toBeVisible();
    });
  });

  it("should have a tooltip for the dbGaPID field explaining why it is required", async () => {
    const ApprovedStudyNoDbGaPID: GetMyUserResp["getMyUser"]["studies"] = [
      {
        _id: "controlled",
        studyName: "controlled-study",
        studyAbbreviation: "CS",
        dbGaPID: null,
        controlledAccess: true,
        pendingModelChange: false,
        isPendingGPA: false,
      },
    ];

    const { getByRole, getByTestId } = render(<CreateDataSubmissionDialog onCreate={vi.fn()} />, {
      wrapper: (p) => (
        <TestParent
          mocks={[]}
          authCtxState={authCtxStateFactory.build({
            user: userFactory.build({
              role: "Submitter",
              studies: ApprovedStudyNoDbGaPID,
              permissions: basePermissions,
            }),
          })}
          {...p}
        />
      ),
    });

    // Simulate opening dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });

    await waitFor(() => expect(openDialogButton).toBeEnabled());

    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-data-submission-dialog-study-id-input")).toBeInTheDocument();
    });

    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");

    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(studySelectButton).toHaveAttribute("aria-expanded", "true");
    });

    userEvent.click(getByTestId("study-option-controlled"));

    userEvent.hover(getByTestId("create-data-submission-dialog-dbgap-id-input"));

    await waitFor(() => {
      expect(getByRole("tooltip")).toBeInTheDocument();
    });

    expect(getByRole("tooltip")).toHaveTextContent(
      "dbGaPID is required for controlled-access studies.",
      { normalizeWhitespace: true }
    );
  });

  // NOTE: We're just random-testing against the opposite of the RequiresStudiesAssigned variable
  it.each<UserRole>(["Data Commons Personnel"])(
    "should fetch all of the studies if the user's role is %s",
    async (role) => {
      const mockMatcher = vi.fn().mockImplementation(() => true);
      const listApprovedStudiesMock: MockedResponse<
        ListApprovedStudiesResp,
        ListApprovedStudiesInput
      > = {
        request: {
          query: LIST_APPROVED_STUDIES,
        },
        variableMatcher: mockMatcher,
        result: {
          data: {
            listApprovedStudies: {
              total: 1,
              studies: approvedStudyFactory.build(2, (index) => ({
                _id: `study${index + 1}`,
                studyName: `study-${index + 1}-from-api`,
                studyAbbreviation: `study-${index + 1}-from-api-abbr`,
                dbGaPID: "",
                controlledAccess: false,
              })),
            },
          },
        },
      };

      const { getByRole } = render(<CreateDataSubmissionDialog onCreate={vi.fn()} />, {
        wrapper: (p) => (
          <TestParent
            mocks={[listApprovedStudiesMock]}
            authCtxState={authCtxStateFactory.build({
              user: userFactory.build({ role, permissions: basePermissions }),
            })}
            {...p}
          />
        ),
      });

      userEvent.click(getByRole("button", { name: "Create a Data Submission" }));

      await waitFor(() => {
        expect(mockMatcher).toHaveBeenCalledTimes(1); // Ensure the listApprovedStudies query was called
      });
    }
  );

  it("should fetch all of the studies if the user's assigned studies contains the 'All' study", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const listApprovedStudiesMock: MockedResponse<
      ListApprovedStudiesResp,
      ListApprovedStudiesInput
    > = {
      request: {
        query: LIST_APPROVED_STUDIES,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          listApprovedStudies: {
            total: 1,
            studies: approvedStudyFactory.build(1, (index) => ({
              _id: `study${index + 1}`,
              studyName: `study-${index + 1}-from-api`,
              studyAbbreviation: `study-${index + 1}-from-api-abbr`,
              dbGaPID: "",
              controlledAccess: false,
            })),
          },
        },
      },
    };

    const { getByRole } = render(<CreateDataSubmissionDialog onCreate={vi.fn()} />, {
      wrapper: (p) => (
        <TestParent
          mocks={[listApprovedStudiesMock]}
          authCtxState={authCtxStateFactory.build({
            user: userFactory.build({
              role: "Federal Lead",
              studies: [
                {
                  _id: "All", // This is the important part
                  studyAbbreviation: "",
                  studyName: "",
                  dbGaPID: "",
                  controlledAccess: false,
                },
              ],
              permissions: basePermissions,
            }),
          })}
          {...p}
        />
      ),
    });

    userEvent.click(getByRole("button", { name: "Create a Data Submission" }));

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledTimes(1); // Ensure the listApprovedStudies query was called
    });
  });

  it("disables the Create button and shows a tooltip if the selected study has pending model changes", async () => {
    const { getByRole, getByTestId, findByText } = render(
      <CreateDataSubmissionDialog onCreate={vi.fn()} />,
      {
        wrapper: (p) => (
          <TestParent
            authCtxState={authCtxStateFactory.build({
              user: userFactory.build({
                role: "Submitter",
                studies: baseStudies,
                permissions: basePermissions,
              }),
            })}
            {...p}
          />
        ),
      }
    );

    // Open the dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    await waitFor(() => expect(openDialogButton).toBeEnabled());
    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
    });

    // Open the study select dropdown and select the pending model changes study
    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");
    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(getByTestId("study-option-pending-model-changes")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("study-option-pending-model-changes"));

    // The Create button should be disabled
    const createButton = getByTestId("create-data-submission-dialog-create-button");
    expect(createButton).toBeDisabled();

    // Hover over the button parent span to trigger the tooltip
    const createButtonWrapper = createButton.parentElement as HTMLElement;
    userEvent.hover(createButtonWrapper);
    expect(
      await findByText(
        /The CRDC team is reviewing the data requirements of this study for potential data model changes/i
      )
    ).toBeInTheDocument();
  });

  it("disables the Create button and shows a tooltip if the selected study has pending GPA condition", async () => {
    const { getByRole, getByTestId, findByText } = render(
      <CreateDataSubmissionDialog onCreate={vi.fn()} />,
      {
        wrapper: (p) => (
          <TestParent
            authCtxState={authCtxStateFactory.build({
              user: userFactory.build({
                role: "Submitter",
                studies: baseStudies,
                permissions: basePermissions,
              }),
            })}
            {...p}
          />
        ),
      }
    );

    // Open the dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    await waitFor(() => expect(openDialogButton).toBeEnabled());
    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
    });

    // Open the study select dropdown and select the pending GPA study
    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");
    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(getByTestId("study-option-pending-GPA-condition")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("study-option-pending-GPA-condition"));

    // The Create button should be disabled
    const createButton = getByTestId("create-data-submission-dialog-create-button");
    expect(createButton).toBeDisabled();

    // Hover over the button parent span to trigger the tooltip
    const createButtonWrapper = createButton.parentElement as HTMLElement;
    userEvent.hover(createButtonWrapper);
    expect(
      await findByText(
        /Data submissions cannot be created until the required GPA updates are provided./i
      )
    ).toBeInTheDocument();
  });

  it("disables the Create button and shows a tooltip with multiple pending conditions", async () => {
    const { getByRole, getByTestId, findByText } = render(
      <CreateDataSubmissionDialog onCreate={vi.fn()} />,
      {
        wrapper: (p) => (
          <TestParent
            authCtxState={authCtxStateFactory.build({
              user: userFactory.build({
                role: "Submitter",
                studies: baseStudies,
                permissions: basePermissions,
              }),
            })}
            {...p}
          />
        ),
      }
    );

    // Open the dialog
    const openDialogButton = getByRole("button", { name: "Create a Data Submission" });
    await waitFor(() => expect(openDialogButton).toBeEnabled());
    userEvent.click(openDialogButton);

    await waitFor(() => {
      expect(getByTestId("create-submission-dialog")).toBeInTheDocument();
    });

    // Open the study select dropdown and select the multiple pending conditions study
    const studySelectButton = within(
      getByTestId("create-data-submission-dialog-study-id-input")
    ).getByRole("button");
    userEvent.click(studySelectButton);

    await waitFor(() => {
      expect(getByTestId("study-option-pending-conditions")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("study-option-pending-conditions"));

    // The Create button should be disabled
    const createButton = getByTestId("create-data-submission-dialog-create-button");
    expect(createButton).toBeDisabled();

    // Hover over the button parent span to trigger the tooltip
    const createButtonWrapper = createButton.parentElement as HTMLElement;
    userEvent.hover(createButtonWrapper);
    expect(
      await findByText(
        /Data submissions cannot be created until the required GPA updates are provided./i
      )
    ).toBeInTheDocument();
    expect(
      await findByText(
        /The CRDC team is reviewing the data requirements of this study for potential data model changes/i
      )
    ).toBeInTheDocument();
  });
});
