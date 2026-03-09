import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { fn, expect, screen, userEvent, waitFor, within } from "@storybook/test";

import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import {
  CANCEL_APP,
  CancelAppInput,
  CancelAppResp,
  RESTORE_APP,
  RestoreAppInput,
  RestoreAppResp,
} from "../../graphql";
import { Context as AuthContext } from "../Contexts/AuthContext";

import Button from "./index";

const mockCancelApp: MockedResponse<CancelAppResp, CancelAppInput> = {
  request: {
    query: CANCEL_APP,
  },
  variableMatcher: () => true,
  result: {
    data: {
      cancelApplication: {
        _id: "some id",
      },
    },
  },
};

const mockRestoreApp: MockedResponse<RestoreAppResp, RestoreAppInput> = {
  request: {
    query: RESTORE_APP,
  },
  variableMatcher: () => true,
  result: {
    data: {
      restoreApplication: {
        _id: "some id",
      },
    },
  },
};

const meta: Meta<typeof Button> = {
  title: "Submission Requests / ToggleApplicationButton",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    apolloClient: {
      mocks: [mockCancelApp, mockRestoreApp],
    },
  },
  decorators: [
    (Story) => (
      <AuthContext.Provider
        value={authCtxStateFactory.build({
          isLoggedIn: true,
          user: userFactory.build({
            _id: "applicant-123",
            role: "Submitter",
            permissions: ["submission_request:cancel"],
          }),
        })}
      >
        <Story />
      </AuthContext.Provider>
    ),
  ],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The button that allows the user to restore an application.
 */
export const RestoreCanceled: Story = {
  name: "Restore (From Canceled)",
  args: {
    onCancel: fn(),
    application: applicationFactory.build({
      _id: "mock-id",
      status: "Canceled",
      applicant: applicantFactory.build({
        applicantID: "applicant-123",
        applicantName: "",
        applicantEmail: "",
      }),
      studyAbbreviation: "Mock Study that is canceled",
    }),
  },
  argTypes: {
    application: {
      control: {
        disable: true,
      },
    },
  },
};

/**
 * The button that allows the user to restore an application.
 */
export const RestoreDeleted: Story = {
  name: "Restore (From Deleted)",
  args: {
    onCancel: fn(),
    application: applicationFactory.build({
      _id: "mock-id",
      status: "Deleted",
      applicant: applicantFactory.build({
        applicantID: "applicant-123",
        applicantName: "",
        applicantEmail: "",
      }),
      studyAbbreviation: "Mock Study that is deleted",
    }),
  },
  argTypes: {
    application: {
      control: {
        disable: true,
      },
    },
  },
};

export const RestoreDialog: Story = {
  name: "Restore Confirmation Dialog",
  args: {
    onCancel: fn(),
    application: applicationFactory.build({
      _id: "mock-id",
      status: "Canceled",
      applicant: applicantFactory.build({
        applicantID: "applicant-123",
        applicantName: "",
        applicantEmail: "",
      }),
      studyAbbreviation: "Mock Study that is canceled",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const button = canvas.getByRole("button", { name: /restore/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const reasonInput = within(screen.getByRole("dialog")).queryByTestId(
      "cancel-restore-application-reason"
    );

    await userEvent.type(reasonInput, "lorem ipsum dol excel ".repeat(10));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirm/i })).toBeEnabled();
    });
  },
  argTypes: {
    application: {
      control: {
        disable: true,
      },
    },
  },
};

/**
 * The button that's visible when the application is in a state that allows restoration.
 */
export const Cancel: Story = {
  args: {
    onCancel: fn(),
    application: applicationFactory.build({
      _id: "mock-id",
      status: "In Progress",
      applicant: applicantFactory.build({
        applicantID: "applicant-123",
        applicantName: "",
        applicantEmail: "",
      }),
      studyAbbreviation: "Mock Study that is in progress",
    }),
  },
  argTypes: {
    application: {
      control: {
        disable: true,
      },
    },
  },
};

export const CancelConfirmDialog: Story = {
  name: "Cancel Confirmation Dialog",
  args: {
    onCancel: fn(),
    application: applicationFactory.build({
      _id: "mock-id",
      status: "In Progress",
      applicant: applicantFactory.build({
        applicantID: "applicant-123",
        applicantName: "",
        applicantEmail: "",
      }),
      studyAbbreviation: "Mock Study that is in progress",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const button = canvas.getByRole("button", { name: /cancel/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const reasonInput = within(screen.getByRole("dialog")).queryByTestId(
      "cancel-restore-application-reason"
    );

    await userEvent.type(reasonInput, "lorem ipsum dol excel ".repeat(10));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirm/i })).toBeEnabled();
    });
  },
  argTypes: {
    application: {
      control: {
        disable: true,
      },
    },
  },
};
