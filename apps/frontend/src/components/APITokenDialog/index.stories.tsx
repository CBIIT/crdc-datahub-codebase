import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";

import { GRANT_TOKEN, GrantTokenResp } from "../../graphql";

import Dialog from "./index";

const meta = {
  title: "Dialogs / API Token",
  component: Dialog,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockGrantToken: MockedResponse<GrantTokenResp> = {
  request: {
    query: GRANT_TOKEN,
  },
  result: {
    data: {
      grantToken: {
        tokens: ["fake-api-token-example"],
        message: null,
      },
    },
  },
};

export const Default: Story = {
  args: {
    open: true,
    onClose: () => {},
  },
  parameters: {
    apolloClient: {
      mocks: [mockGrantToken],
    },
  },
};
