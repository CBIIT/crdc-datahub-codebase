import type { Meta, StoryObj } from "@storybook/react";

import OverlayComponent from "./OverlayWindow";

const meta: Meta<typeof OverlayComponent> = {
  title: "Miscellaneous / System Use Banner",
  component: OverlayComponent,
  args: {},
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => {
      sessionStorage.clear();

      return <Story />;
    },
  ],
} satisfies Meta<typeof OverlayComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
