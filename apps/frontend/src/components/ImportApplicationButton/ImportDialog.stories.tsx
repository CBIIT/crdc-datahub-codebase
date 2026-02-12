import type { Meta, StoryObj } from "@storybook/react";
import { fn, screen, userEvent } from "@storybook/test";

import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { historyEventFactory } from "@/factories/application/HistoryEventFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import { Roles } from "../../config/AuthRoles";
import { Context as AuthContext, Status as AuthCtxStatus } from "../Contexts/AuthContext";
import {
  Context as FormContext,
  Status as FormStatus,
  ContextState as FormContextState,
} from "../Contexts/FormContext";

import ImportDialog from "./ImportDialog";

type CustomStoryProps = React.ComponentProps<typeof ImportDialog> & {
  userRole: UserRole;
  permissions: AuthPermissions[];
  applicationStatus: ApplicationStatus;
};

const meta: Meta<CustomStoryProps> = {
  title: "Submission Requests / Import Dialog",
  component: ImportDialog,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    open: {
      control: "boolean",
      description: "Controls dialog visibility",
    },
    disabled: {
      control: "boolean",
      description: "Disables dialog actions",
    },
    userRole: {
      description: "Role of the user",
      control: "select",
      options: Roles,
    },
    permissions: {
      description: "Permissions assigned to the user",
      control: "check",
      options: ["submission_request:view", "submission_request:create"],
    },
    applicationStatus: {
      description: "Current status of the Submission Request",
      control: "select",
      options: [
        "In Progress",
        "Submitted",
        "Approved",
        "Rejected",
        "Canceled",
        "Deleted",
      ] as ApplicationStatus[],
    },
    onClose: { control: false },
    onConfirm: { control: false },
  },
  decorators: [
    (Story, context) => (
      <AuthContext.Provider
        value={authCtxStateFactory.build({
          status: AuthCtxStatus.LOADED,
          user: userFactory.build({
            _id: "current-user",
            role: context.args.userRole,
            permissions: context.args.permissions,
          }),
        })}
      >
        <Story />
      </AuthContext.Provider>
    ),
    (Story, context) => {
      const formValue: FormContextState = formContextStateFactory.build({
        status: FormStatus.LOADED,
        data: applicationFactory.build({
          _id: "application-1",
          status: context.args.applicationStatus,
          applicant: applicantFactory.build({ applicantID: "current-user" }),
          history: historyEventFactory.build(1),
          newInstitutions: [],
          questionnaireData: questionnaireDataFactory.build(),
        }) as Application,
        setData: fn(),
        submitData: fn(),
        reopenForm: fn(),
        approveForm: fn(),
        inquireForm: fn(),
        rejectForm: fn(),
      });
      return (
        <FormContext.Provider value={formValue}>
          <Story />
        </FormContext.Provider>
      );
    },
  ],
} satisfies Meta<CustomStoryProps>;

type Story = StoryObj<CustomStoryProps>;

export const Default: Story = {
  args: {
    open: true,
    disabled: false,
    userRole: "Submitter",
    permissions: ["submission_request:view", "submission_request:create"],
    applicationStatus: "In Progress",
    onClose: fn(),
    onConfirm: fn(),
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};

export const Closed: Story = {
  args: {
    ...Default.args,
    open: false,
  },
};

export const WithFileSelected: Story = {
  args: {
    open: true,
    disabled: false,
  },
  play: async () => {
    const input = screen.getByTestId("import-upload-file-input") as HTMLInputElement;

    const file = new File(["test"], "valid.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await userEvent.upload(input, file);

    await screen.findByDisplayValue("valid.xlsx");
  },
};

export default meta;
