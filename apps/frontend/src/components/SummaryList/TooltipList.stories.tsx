import type { Meta, StoryObj } from "@storybook/react";

import TooltipList, { Props } from "./TooltipList";

const meta: Meta<typeof TooltipList> = {
  title: "Miscellaneous / TooltipList",
  component: TooltipList,
  tags: ["autodocs"],
} satisfies Meta<typeof TooltipList>;

export default meta;
type Story = StoryObj<Props<{ _id: string; name: string; abbreviation?: string }>>;

/**
 * A scenario in which only one item is provided.
 */
export const Single: Story = {
  args: {
    data: [{ _id: "item-1", name: "Item One" }],
    getItemKey: (item) => item._id,
    renderTooltipItem: (item) => item.name,
  },
};

/**
 * A scenario in which multiple items are provided.
 */
export const Multiple: Story = {
  args: {
    data: [
      { _id: "item-1", name: "Item One" },
      { _id: "item-2", name: "Item Two", abbreviation: "IT2-ABBR" },
      { _id: "item-3", name: "Item Three" },
    ],
    getItemKey: (item) => item._id,
    renderTooltipItem: (item) => item.name,
  },
};

/**
 * No items are provided.
 */
export const None: Story = {
  args: {
    data: [],
    getItemKey: (item) => item._id,
    renderTooltipItem: (item) => item.name,
  },
};
