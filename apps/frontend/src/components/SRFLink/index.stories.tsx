import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, waitFor, within } from "@storybook/test";

import SRFLink from "./index";

const meta: Meta<typeof SRFLink> = {
  title: "Data Submissions / SRFLink",
  component: SRFLink,
  tags: ["autodocs"],
} satisfies Meta<typeof SRFLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  args: {
    appId: "mock-app-id",
  },
};

export const Disabled: Story = {
  args: {
    appId: "mock-app-id",
    disabled: true,
  },
};

export const Hidden: Story = {
  args: {
    appId: "",
  },
};

export const EnabledTooltip: Story = {
  name: "Enabled (Tooltip)",
  args: {
    appId: "mock-app-id",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tooltipTarget = canvas.getByTestId("view-submission-request-form-tooltip-mock-app-id");

    await userEvent.hover(tooltipTarget);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Click to open the Submission Request Form for this study."
    );
  },
};

export const DisabledTooltip: Story = {
  name: "Disabled (Tooltip)",
  args: {
    appId: "mock-app-id",
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tooltipTarget = canvas.getByTestId("view-submission-request-form-tooltip-mock-app-id");

    await userEvent.hover(tooltipTarget);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "You don't have permission to view the Submission Request Form for this study."
    );
  },
};
