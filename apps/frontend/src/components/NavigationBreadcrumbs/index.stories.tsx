import type { Meta, StoryObj } from "@storybook/react";

import NavigationBreadcrumbs, { NavigationBreadcrumbsProps } from "./index";

const meta: Meta<NavigationBreadcrumbsProps> = {
  title: "Miscellaneous / Navigation Breadcrumbs",
  component: NavigationBreadcrumbs,
  tags: ["autodocs"],
} satisfies Meta<NavigationBreadcrumbsProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    entries: [
      { label: "Home", to: "/" },
      { label: "Study Management", to: "/studies" },
      { label: "mock-study-uuid" },
    ],
  },
};

export const Truncation: Story = {
  args: {
    entries: [
      { label: "Home", to: "/" },
      { label: "Data Explorer", to: "/data-explorer" },
      {
        label:
          "lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt",
      },
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ width: "350px" }}>
        <Story />
      </div>
    ),
  ],
};
