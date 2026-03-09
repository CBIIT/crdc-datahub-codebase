import type { Meta, StoryObj } from "@storybook/react";

import bannerPng from "../../assets/banner/submission_banner.png";

import PageContainer, { PageContainerProps } from "./index";

const meta: Meta<PageContainerProps> = {
  title: "Miscellaneous / PageContainer",
  component: PageContainer,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<PageContainerProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Mock Page Title - ",
    titleSuffix: "lorem ipsum dolor sit amet consectetur adipiscing elit",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    background: bannerPng,
    children: <p>mock children</p>,
  },
};
