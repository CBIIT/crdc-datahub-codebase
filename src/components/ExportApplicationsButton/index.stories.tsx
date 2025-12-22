import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within, screen } from "@storybook/test";

import { Context as AuthContext } from "@/components/Contexts/AuthContext";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { LIST_APPLICATIONS, ListApplicationsInput, ListApplicationsResp } from "@/graphql";

import Button from "./index";

const mockPopulatedResp: MockedResponse<ListApplicationsResp, ListApplicationsInput> = {
  request: {
    query: LIST_APPLICATIONS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listApplications: {
        applications: applicationFactory.build(2),
        programs: [],
        studies: [],
        total: 2,
      },
    },
  },
};

/**
 * A button providing the ability to export the list of Submission Requests.
 */
const meta: Meta<typeof Button> = {
  title: "Submission Requests / Export Applications Button",
  component: Button,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <AuthContext.Provider
        value={authCtxStateFactory.build({
          isLoggedIn: true,
          user: userFactory.build({
            permissions: ["submission_request:view"],
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
 * Default story showing the Export Applications Button enabled.
 */
export const Default: Story = {
  parameters: {
    apolloClient: {
      mocks: [mockPopulatedResp],
    },
  },
};

/**
 * A story to cover the hover state of the enabled button with the tooltip present.
 */
export const DefaultTooltip: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    await userEvent.hover(button);

    await screen.findByRole("tooltip");
  },
};

/**
 * A story showing the Export Applications Button disabled.
 */
export const Disabled: Story = {
  ...Default,
  args: {
    disabled: true,
  },
};

/**
 * A story to cover the hover state of the disabled button with the tooltip present.
 */
export const DisabledTooltip: Story = {
  ...Disabled,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    await userEvent.hover(button, { pointerEventsCheck: 0 });

    await screen.findByRole("tooltip");
  },
};
