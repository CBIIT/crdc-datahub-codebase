import type { Meta, StoryObj } from "@storybook/react";

import SummaryList from "./index";

const meta: Meta<typeof SummaryList> = {
  title: "Miscellaneous / SummaryList",
  component: SummaryList,
  tags: ["autodocs"],
} satisfies Meta<typeof SummaryList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A scenario in which only one option is provided.
 */
export const Single: Story = {
  args: {
    data: [{ _id: "option-1", name: "Option One" }],
    getItemKey: (item) => item._id,
    renderItem: (item) => item.name,
    renderTooltipItem: (item) => item.name,
  },
};

/**
 * A scenario in which multiple options are provided.
 *
 * Will include a tooltip with the full list of options.
 */
export const Multiple: Story = {
  args: {
    data: [
      { _id: "option-1", name: "Option One" },
      { _id: "option-2", name: "Option Two", abbreviation: "ST2-ABBR" },
      { _id: "option-3", name: "Option Three" },
    ],
    getItemKey: (item) => item._id,
    renderItem: (item) => item.name,
    renderTooltipItem: (item) => item.name,
  },
};

/**
 * No options are provided.
 */
export const None: Story = {
  args: {
    data: [],
    getItemKey: (item) => item._id,
    renderItem: (item) => item.name,
    renderTooltipItem: (item) => item.name,
    emptyText: "Empty Text Example",
  },
  argTypes: {
    emptyText: {
      name: "EmptyText",
      control: {
        type: "text",
      },
    },
  },
};

/**
 * A scenario where a long option name needs to be wrapped
 * in order to fit within the parent container.
 */
export const WordWrap: Story = {
  args: {
    data: [
      { _id: "long-option", name: "A".repeat(100) },
      { _id: "option-1", name: "Option One" },
      { _id: "option-2", name: "Option Two", abbreviation: "OT" },
      { _id: "option-3", name: "Option Three" },
    ],
    getItemKey: (item) => item._id,
    renderItem: (item) => item.name,
    renderTooltipItem: (item) => item.name,
  },
  decorators: [
    (Story) => (
      <div style={{ width: "300px" }}>
        <Story />
      </div>
    ),
  ],
};
