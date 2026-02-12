import type { Meta, StoryObj } from "@storybook/react";
import { fn, screen, userEvent, within } from "@storybook/test";

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

import ImportApplicationButton from "./index";

type CustomStoryProps = React.ComponentProps<typeof ImportApplicationButton> & {
  userRole: UserRole;
  permissions: AuthPermissions[];
  applicationStatus: ApplicationStatus;
};

const meta: Meta<CustomStoryProps> = {
  title: "Submission Requests / Import Application Button",
  component: ImportApplicationButton,
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Directly disable the button",
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
    disabled: false,
    userRole: "Submitter",
    permissions: ["submission_request:view", "submission_request:create"],
    applicationStatus: "In Progress",
  },
};

export const DisabledByStatus: Story = {
  name: "Disabled (Submitted Status)",
  args: {
    ...Default.args,
    applicationStatus: "Submitted",
  },
};

export const DisabledProp: Story = {
  name: "Disabled (Prop)",
  args: {
    ...Default.args,
    disabled: true,
  },
};

export const Hovered: Story = {
  args: {
    ...Default.args,
    disabled: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("import-application-excel-tooltip-text");

    await userEvent.hover(button);

    await screen.findByRole("tooltip");
  },
};

export default meta;
