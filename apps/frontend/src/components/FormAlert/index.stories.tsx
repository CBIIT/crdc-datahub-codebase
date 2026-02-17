import type { Meta, StoryObj } from "@storybook/react";

import FormAlert from "./index";

const meta = {
  title: "Miscellaneous / FormAlert",
  component: FormAlert,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof FormAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoAlert: Story = {
  args: {},
};

export const WithPropError: Story = {
  args: {
    error: "This is an error message provided via prop.",
  },
};

export const WithLocationStateError: Story = {
  parameters: {
    router: {
      initialEntries: [
        {
          pathname: "/",
          state: { alert: true, error: "This error comes from location state." },
        },
      ],
    },
  },
};

export const WithBothErrors: Story = {
  args: {
    error: "Error from prop (should be overridden).",
  },
  parameters: {
    router: {
      initialEntries: [
        {
          pathname: "/",
          state: { alert: true, error: "Error from location state takes precedence." },
        },
      ],
    },
  },
};
