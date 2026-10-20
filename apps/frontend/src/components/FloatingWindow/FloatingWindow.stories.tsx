import { Meta, StoryObj } from "@storybook/react";

import FloatingWindow from "./FloatingWindow";
import { FloatingWindowProvider } from "./FloatingWindowContext";
import type { FloatingWindowConfig } from "./FloatingWindowContext";

const config: FloatingWindowConfig = {
  height: { collapsed: 368, min: 368 },
  width: { default: 400, min: 400, expanded: 420 },
};

const meta: Meta<typeof FloatingWindow> = {
  title: "Miscellaneous / Floating Window",
  component: FloatingWindow,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story, context) => (
      <FloatingWindowProvider
        config={config}
        confirmBeforeClose={!!context.args.confirmCloseContent}
      >
        <Story />
      </FloatingWindowProvider>
    ),
  ],
  args: {
    id: "floating-window",
  },
  argTypes: {
    children: {
      description: "Child content rendered in the window body.",
      table: {
        disable: true,
      },
    },
    confirmCloseContent: {
      description: "Content rendered over the body while a close confirmation is pending.",
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof FloatingWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <div style={{ padding: "16px" }}>Window content goes here</div>,
  },
};

export const WithCustomContent: Story = {
  args: {
    children: (
      <div style={{ padding: "16px" }}>
        <h3>Custom Panel</h3>
        <p>This is custom content inside the floating window.</p>
      </div>
    ),
  },
};

export const WithCloseConfirmation: Story = {
  args: {
    children: <div style={{ padding: "16px" }}>Click the close button to confirm.</div>,
    confirmCloseContent: (
      <div
        role="alertdialog"
        aria-label="Close window"
        style={{ position: "absolute", inset: 0, background: "#E3E9F2", padding: "16px" }}
      >
        Are you sure you want to close?
      </div>
    ),
  },
};
