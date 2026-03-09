import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

import bannerPng from "../../assets/banner/submission_banner.png";

import PageBanner from "./index";
import PageBannerBody from "./PageBannerBody";

const meta = {
  title: "Miscellaneous / PageBanner",
  component: PageBanner,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    title: {
      control: "text",
      description: "The main title displayed on the banner",
    },
    subTitle: {
      control: "text",
      description: "The subtitle displayed on the banner",
    },
    bannerSrc: {
      control: "text",
      description: "The URL for the banner background image",
    },
    padding: {
      control: "text",
      description: "Custom CSS padding for the banner content container",
    },
    body: {
      control: false,
      description: "Optional React node that renders additional banner content",
    },
  },
} satisfies Meta<typeof PageBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Submission Requests",
    subTitle:
      "Below is a list of submission requests that are associated with your account. Please click on any of the submission requests to review or continue work.",
    bannerSrc: bannerPng,
  },
};

export const WithBody: Story = {
  args: {
    title: "Submission Requests",
    subTitle:
      "Below is a list of submission requests that are associated with your account. Please click on any of the submission requests to review or continue work.",
    bannerSrc: bannerPng,
    body: <PageBannerBody label="Start a Submission Request" to="/destination" />,
  },
};
