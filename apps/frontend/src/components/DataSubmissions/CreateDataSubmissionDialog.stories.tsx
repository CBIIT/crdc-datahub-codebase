import { MockedResponse } from "@apollo/client/testing";
import { Box } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, within, screen, expect } from "@storybook/test";

import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import {
  GetMyUserResp,
  CreateSubmissionResp,
  CREATE_SUBMISSION,
  CreateSubmissionInput,
} from "../../graphql";
import { Context as AuthContext, Status as AuthStatus } from "../Contexts/AuthContext";

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

const createSubmissionMock: MockedResponse<CreateSubmissionResp, CreateSubmissionInput> = {
  request: {
    query: CREATE_SUBMISSION,
  },
  variableMatcher: () => true,
  result: {
    data: {
      createSubmission: {
        _id: "mock-submission-id",
        status: "New",
        createdAt: new Date().toString(),
      },
    },
  },
};

const meta: Meta<typeof CreateDataSubmissionDialog> = {
  title: "Data Submissions / Create Dialog",
  component: CreateDataSubmissionDialog,
  tags: ["autodocs"],
  parameters: {
    apolloClient: {
      mocks: [createSubmissionMock],
    },
  },
  decorators: [
    (Story) => (
      <Box mt={3}>
        <Story />
      </Box>
    ),
    (Story) => (
      <AuthContext.Provider
        value={{
          status: AuthStatus.LOADED,
          isLoggedIn: true,
          user: userFactory.build({
            role: "Submitter",
            studies: baseStudies,
            permissions: ["data_submission:create"],
          }),
        }}
      >
        <Story />
      </AuthContext.Provider>
    ),
  ],
} satisfies Meta<typeof CreateDataSubmissionDialog>;

export default meta;
type Story = StoryObj<typeof CreateDataSubmissionDialog>;

export const Button: Story = {
  args: {
    onCreate: fn(),
  },
};

export const Dialog: Story = {
  ...Button,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Create a Data Submission" }));

    await screen.findAllByRole("presentation");
  },
};

export const DialogWithPendingChanges: Story = {
  ...Button,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open the dialog
    await userEvent.click(canvas.getByRole("button", { name: "Create a Data Submission" }));
    await screen.findAllByRole("presentation");

    // Open the study select dropdown and select the pending option
    const studySelect = await screen.findByTestId("create-data-submission-dialog-study-id-input");
    await userEvent.click(within(studySelect).getByRole("button"));
    const pendingOption: HTMLElement = await screen.findByTestId(
      "study-option-pending-model-changes"
    );
    await userEvent.click(pendingOption);

    // Check that the "Create" button is disabled
    const createButton = await screen.findByTestId("create-data-submission-dialog-create-button");
    expect(createButton).toBeDisabled();

    // Hover over the button parent span to trigger the tooltip
    const createButtonWrapper = createButton.parentElement as HTMLElement;
    await userEvent.hover(createButtonWrapper);
    const tooltip = await screen.findByText(
      /The CRDC team is reviewing the data requirements of this study for potential data model changes/i
    );
    expect(tooltip).toBeInTheDocument();
  },
};

export const DialogWithPendingGPACondition: Story = {
  ...Button,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open the dialog
    await userEvent.click(canvas.getByRole("button", { name: "Create a Data Submission" }));
    await screen.findAllByRole("presentation");

    // Open the study select dropdown and select the pending option
    const studySelect = await screen.findByTestId("create-data-submission-dialog-study-id-input");
    await userEvent.click(within(studySelect).getByRole("button"));
    const pendingOption: HTMLElement = await screen.findByTestId(
      "study-option-pending-GPA-condition"
    );
    await userEvent.click(pendingOption);

    // Check that the "Create" button is disabled
    const createButton = await screen.findByTestId("create-data-submission-dialog-create-button");
    expect(createButton).toBeDisabled();

    // Hover over the button parent span to trigger the tooltip
    const createButtonWrapper = createButton.parentElement as HTMLElement;
    await userEvent.hover(createButtonWrapper);
    const tooltip = await screen.findByText(
      /Data submissions cannot be created until the required GPA updates are provided./i
    );
    expect(tooltip).toBeInTheDocument();
  },
};

export const DialogWithMultiplePendingConditions: Story = {
  ...Button,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open the dialog
    await userEvent.click(canvas.getByRole("button", { name: "Create a Data Submission" }));
    await screen.findAllByRole("presentation");

    // Open the study select dropdown and select the pending option
    const studySelect = await screen.findByTestId("create-data-submission-dialog-study-id-input");
    await userEvent.click(within(studySelect).getByRole("button"));
    const pendingOption: HTMLElement = await screen.findByTestId("study-option-pending-conditions");
    await userEvent.click(pendingOption);

    // Check that the "Create" button is disabled
    const createButton = await screen.findByTestId("create-data-submission-dialog-create-button");
    expect(createButton).toBeDisabled();

    // Hover over the button parent span to trigger the tooltip
    const createButtonWrapper = createButton.parentElement as HTMLElement;
    await userEvent.hover(createButtonWrapper);
    const tooltip1 = await screen.findByText(
      /Data submissions cannot be created until the required GPA updates are provided./i
    );
    const tooltip2 = await screen.findByText(
      /The CRDC team is reviewing the data requirements of this study for potential data model changes/i
    );
    expect(tooltip1).toBeInTheDocument();
    expect(tooltip2).toBeInTheDocument();
  },
};
