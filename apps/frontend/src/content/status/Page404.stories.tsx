import type { Meta, StoryObj } from "@storybook/react";

import Page404 from "./Page404";

const meta: Meta = {
  title: "Pages / 404 Page",
  component: Page404,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "404 Page",
};
