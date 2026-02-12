import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, within, screen } from "@storybook/test";

import { SaveAppResp, SaveAppInput, SAVE_APP } from "../../graphql";
import { Context as AuthContext, Status as AuthStatus } from "../Contexts/AuthContext";

import CreateApplicationButton from "./index";

const mockUser: User = {
  _id: "user-1",
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  dataCommons: [],
  dataCommonsDisplayNames: [],
  studies: [],
  institution: null,
  IDP: "nih",
  userStatus: "Active",
  updateAt: "",
  createdAt: "",
  notifications: [],
  role: "Submitter",
  permissions: ["submission_request:create"],
};

const mockSaveApplication: MockedResponse<SaveAppResp, SaveAppInput> = {
  request: {
    query: SAVE_APP,
  },
  variableMatcher: () => true,
  result: {
    data: {
      saveApplication: {
        _id: "mock-application-12345",
      } as SaveAppResp["saveApplication"],
    },
  },
};

const meta = {
  title: "Submission Requests / Create Application Button",
  component: CreateApplicationButton,
  parameters: {
    layout: "centered",
    apolloClient: {
      mocks: [mockSaveApplication],
    },
  },
  decorators: [
    (Story) => (
      <AuthContext.Provider
        value={{
          status: AuthStatus.LOADED,
          isLoggedIn: true,
          user: mockUser,
        }}
      >
        <Story />
      </AuthContext.Provider>
    ),
  ],
} satisfies Meta<typeof CreateApplicationButton>;

export default meta;
type Story = StoryObj<typeof CreateApplicationButton>;

/**
 * A story that represents the default state of the CreateApplicationButton component.
 */
export const ButtonOnly: Story = {
  name: "Button",
  args: {
    onCreate: fn(),
  },
};

/**
 * A story that renders the dialog confirmation for the CreateApplicationButton component.
 */
export const DialogOpen: Story = {
  ...ButtonOnly,
  name: "Dialog",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const button = await canvas.findByTestId("create-application-button");
    await userEvent.click(button);

    await screen.findByRole("dialog");
  },
};
