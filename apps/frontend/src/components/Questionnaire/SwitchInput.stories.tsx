import type { Meta, StoryObj } from "@storybook/react";

import SwitchInput from "./SwitchInput";

const meta: Meta<typeof SwitchInput> = {
  title: "Submission Requests / Switch Input",
  component: SwitchInput,
  tags: ["autodocs"],
} satisfies Meta<typeof SwitchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default switch input in an unchecked state.
 */
export const Unchecked: Story = {
  args: {
    label: "Switch Off",
    name: "switch-input",
    value: false,
    tooltipText: "Toggle the switch",
    required: false,
    gridWidth: 6,
  },
};

/**
 * The switch input in a checked state with additional content.
 */
export const Checked: Story = {
  args: {
    label: "Switch On",
    name: "switch-input",
    value: true,
    tooltipText: "Toggle the switch",
    required: true,
    gridWidth: 6,
    errorText: "This field is required",
    toggleContent: <div>Additional Content Visible When On</div>,
  },
};

/**
 * The switch input in a readOnly state and unchecked.
 */
export const ReadOnlyUnchecked: Story = {
  args: {
    label: "Read Only Unchecked Switch",
    name: "switch-input-unchecked-readonly",
    value: false,
    tooltipText: "This switch is read only",
    required: false,
    gridWidth: 6,
    readOnly: true,
    toggleContent: <div>Read-only toggle content</div>,
  },
};

/**
 * The switch input in a readOnly state and checked.
 */
export const ReadOnlyChecked: Story = {
  args: {
    label: "Read Only Checked Switch",
    name: "switch-input-checked-readonly",
    value: true,
    tooltipText: "This switch is read only",
    required: false,
    gridWidth: 6,
    readOnly: true,
    toggleContent: <div>Read-only toggle content</div>,
  },
};

/**
 * The switch input in a hovered state.
 */
export const Hovered: Story = {
  args: {
    label: "Switch Hover",
    name: "switch-input-hover",
    value: false,
    tooltipText: "Toggle the switch",
    required: false,
    gridWidth: 6,
  },
  parameters: {
    pseudo: {
      hover: true,
      selectors: ".track",
    },
  },
};

/**
 * The switch input in a focused state.
 */
export const Focused: Story = {
  args: {
    label: "Switch Focused",
    name: "switch-input-focus",
    value: false,
    tooltipText: "Toggle the switch",
    required: false,
    gridWidth: 6,
  },
  parameters: {
    pseudo: {
      focus: true,
      selectors: "switchBase",
    },
  },
};
