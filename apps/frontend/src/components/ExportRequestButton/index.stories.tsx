import { Stack } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react";

import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";

import { Context as FormContext, Status as FormStatus } from "../Contexts/FormContext";

import Button from "./index";

type CustomStoryProps = {
  FormStatus: FormStatus;
  application: Application;
} & React.ComponentProps<typeof Button>;

const meta: Meta<CustomStoryProps> = {
  title: "Submission Requests / Export Request Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {},
  argTypes: {
    application: {
      control: {
        disable: true,
      },
    },
    FormStatus: {
      description: "Form status",
      control: "select",
      options: Object.values(FormStatus),
    },
  },
  decorators: [
    (Story) => (
      <Stack spacing={5} width="100%" justifyContent="center" alignItems="center">
        <div data-pdf-print-region="1">mock PDF content</div>
        <Story />
      </Stack>
    ),
    (Story, context) => (
      <FormContext.Provider
        value={{
          ...formContextStateFactory.build({
            status: context.args.FormStatus,
            data: context.args.application,
          }),
        }}
      >
        <Story />
      </FormContext.Provider>
    ),
  ],
  render: ({ FormStatus, application, ...rest }) => <Button {...rest} />,
} satisfies Meta<CustomStoryProps>;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    FormStatus: FormStatus.LOADED,
    application: applicationFactory.build({
      applicant: {
        applicantID: "mock-applicant-id",
        applicantName: "John Doe",
        applicantEmail: "john.doe@example.com",
      },
      questionnaireData: questionnaireDataFactory.build(),
      status: "In Progress",
      submittedDate: "2023-10-01T00:00:00Z",
    }),
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    ...Default.args,
    FormStatus: FormStatus.LOADING,
  },
};

export const Hovered: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    pseudo: {
      hover: true,
      selectors: "MuiButtonBase-root",
    },
  },
};

export default meta;
