import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, screen } from "@storybook/test";

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

const meta = {
  title: "Submission Requests / Create Application Button",
  component: CreateApplicationButton,
  parameters: {
    layout: "centered",
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

/**
 * A story that confirms the button callback is invoked with the legacy "new" route id.
 */
export const ConfirmAndCreate: Story = {
  name: "Confirm and Create",
  args: {
    onCreate: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const button = await canvas.findByTestId("create-application-button");
    await userEvent.click(button);

    const confirmButton = await screen.findByText("I Read and Accept");
    await userEvent.click(confirmButton);

    await expect(args.onCreate).toHaveBeenCalledWith("new");
  },
};
