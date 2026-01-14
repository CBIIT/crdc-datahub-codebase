import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within, screen } from "@storybook/test";

import { Context as AuthContext } from "@/components/Contexts/AuthContext";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { LIST_SUBMISSIONS, ListSubmissionsInput, ListSubmissionsResp } from "@/graphql";

import Button from "./index";

const mockSubmissions = submissionFactory.build(2, (idx) => ({
  _id: `submission-${idx}`,
  name: `Test Submission ${idx}`,
  submitterName: `Test Submitter ${idx}`,
  dataCommonsDisplayName: "GDC",
  intention: "New/Update",
  modelVersion: "1.0.0",
  organization: organizationFactory.pick(["_id", "name", "abbreviation"]).build({
    _id: `org-${idx}`,
    name: `Test Organization ${idx}`,
    abbreviation: `ORG-${idx}`,
  }),
  studyAbbreviation: `TEST-${idx}`,
  dbGaPID: `phs00000${idx}`,
  status: "In Progress",
  conciergeName: `Test Concierge ${idx}`,
  nodeCount: 1000 + idx,
  dataFileSize: { size: 1024 * 1024 * (idx + 1), formatted: `${idx + 1} MB` },
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
}));

const mockPopulatedResp: MockedResponse<ListSubmissionsResp, ListSubmissionsInput> = {
  request: {
    query: LIST_SUBMISSIONS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listSubmissions: {
        submissions: mockSubmissions,
        organizations: [],
        submitterNames: [],
        dataCommons: [],
        dataCommonsDisplayNames: [],
        total: 2,
      },
    },
  },
};

const defaultScope = {
  organization: "All",
  status: ["In Progress" as const],
  dataCommons: "All",
  name: "",
  dbGaPID: "",
  submitterName: "All",
  sortDirection: "desc" as const,
  orderBy: "updatedAt",
};

/**
 * A button providing the ability to export the list of Data Submissions to CSV.
 */
const meta: Meta<typeof Button> = {
  title: "Data Submissions / Export Submissions Button",
  component: Button,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <AuthContext.Provider
        value={authCtxStateFactory.build({
          isLoggedIn: true,
          user: userFactory.build({
            permissions: ["data_submission:view"],
          }),
        })}
      >
        <Story />
      </AuthContext.Provider>
    ),
  ],
  args: {
    scope: defaultScope,
    hasData: true,
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Default story showing the Export Submissions Button enabled.
 */
export const Default: Story = {
  parameters: {
    apolloClient: {
      mocks: [mockPopulatedResp],
    },
  },
};

/**
 * A story to cover the hover state of the enabled button with the tooltip present.
 */
export const DefaultTooltip: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    await userEvent.hover(button);

    await screen.findByRole("tooltip");
  },
};

/**
 * A story showing the Export Submissions Button disabled (no data available).
 */
export const Disabled: Story = {
  ...Default,
  args: {
    scope: defaultScope,
    hasData: false,
  },
};

/**
 * A story to cover the hover state of the disabled button with the tooltip present.
 */
export const DisabledTooltip: Story = {
  ...Disabled,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    await userEvent.hover(button, { pointerEventsCheck: 0 });

    await screen.findByRole("tooltip");
  },
};
