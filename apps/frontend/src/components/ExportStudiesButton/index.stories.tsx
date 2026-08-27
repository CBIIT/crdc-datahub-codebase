import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";

import { Context as AuthContext } from "@/components/Contexts/AuthContext";
import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import {
  LIST_APPROVED_STUDIES,
  ListApprovedStudiesInput,
  ListApprovedStudiesResp,
} from "@/graphql";

import Button from "./index";

const mockPopulatedResp: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput> = {
  request: {
    query: LIST_APPROVED_STUDIES,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listApprovedStudies: {
        studies: approvedStudyFactory.build(2),
        total: 2,
      },
    },
  },
};

/**
 * A button providing the ability to export the list of Studies.
 */
const meta: Meta<typeof Button> = {
  title: "Manage Studies / Export Studies Button",
  component: Button,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <AuthContext.Provider
        value={authCtxStateFactory.build({
          isLoggedIn: true,
          user: userFactory.build({
            permissions: ["study:manage"],
          }),
        })}
      >
        <Story />
      </AuthContext.Provider>
    ),
  ],
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Default story showing the Export Studies Button enabled.
 */
export const Default: Story = {
  args: {
    scope: null,
  },
  parameters: {
    apolloClient: {
      mocks: [mockPopulatedResp],
    },
  },
};

/**
 * Story showing the Export Studies Button when there are no results to export.
 */
export const Disabled: Story = {
  args: {
    scope: null,
    disabled: true,
  },
};
