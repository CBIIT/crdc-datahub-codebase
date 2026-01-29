import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within, screen } from "@storybook/test";

import { Context as AuthContext } from "@/components/Contexts/AuthContext";
import { Column } from "@/components/GenericTable";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { LIST_SUBMISSIONS, ListSubmissionsInput, ListSubmissionsResp } from "@/graphql";
import { FormatDate } from "@/utils";

import Button from "./index";

type Submission = ListSubmissionsResp["listSubmissions"]["submissions"][number];

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

const defaultColumns: Column<Submission>[] = [
  {
    label: "Submission Name",
    renderValue: (a) => a.name,
    field: "name",
    exportValue: (a) => ({ label: "Submission Name", value: a.name }),
  },
  {
    label: "Submitter",
    renderValue: (a) => a.submitterName,
    field: "submitterName",
    exportValue: (a) => ({ label: "Submitter", value: a.submitterName }),
  },
  {
    label: "Data Commons",
    renderValue: (a) => a.dataCommonsDisplayName,
    field: "dataCommonsDisplayName",
    exportValue: (a) => ({ label: "Data Commons", value: a.dataCommonsDisplayName }),
  },
  {
    label: "Type",
    renderValue: (a) => a.intention,
    field: "intention",
    exportValue: (a) => ({ label: "Type", value: a.intention }),
  },
  {
    label: "Model Version",
    renderValue: (a) => a.modelVersion,
    field: "modelVersion",
    exportValue: (a) => ({ label: "Model Version", value: a.modelVersion }),
  },
  {
    label: "Program",
    renderValue: (a) => a.organization?.name ?? "NA",
    fieldKey: "organization.name",
    exportValue: (a) => ({ label: "Program", value: a.organization?.name ?? "" }),
  },
  {
    label: "Study",
    renderValue: (a) => a.study.studyAbbreviation,
    fieldKey: "study.studyAbbreviation",
    exportValue: (a) => ({ label: "Study", value: a.study.studyAbbreviation }),
  },
  {
    label: "dbGaP ID",
    renderValue: (a) => a.dbGaPID,
    field: "dbGaPID",
    exportValue: (a) => ({ label: "dbGaP ID", value: a.dbGaPID }),
  },
  {
    label: "Status",
    renderValue: (a) => a.status,
    field: "status",
    exportValue: (a) => ({ label: "Status", value: a.status }),
  },
  {
    label: "Data Concierge",
    renderValue: (a) => a.conciergeName,
    field: "conciergeName",
    exportValue: (a) => ({ label: "Data Concierge", value: a.conciergeName }),
  },
  {
    label: "Record Count",
    renderValue: (a) =>
      Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(a.nodeCount || 0),
    field: "nodeCount",
    exportValue: (a) => ({
      label: "Record Count",
      value: Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(a.nodeCount || 0),
    }),
  },
  {
    label: "Data File Size",
    renderValue: (a) => a.dataFileSize.formatted || 0,
    fieldKey: "dataFileSize.size",
    exportValue: (a) => ({ label: "Data File Size", value: a.dataFileSize.formatted || 0 }),
  },
  {
    label: "Created Date",
    renderValue: (a) => FormatDate(a.createdAt, "M/D/YYYY"),
    field: "createdAt",
    exportValue: (a) => ({
      label: "Created Date",
      value: a.createdAt ? FormatDate(a.createdAt, "M/D/YYYY h:mm A") : "",
    }),
  },
  {
    label: "Last Updated",
    renderValue: (a) => FormatDate(a.updatedAt, "M/D/YYYY"),
    field: "updatedAt",
    exportValue: (a) => ({
      label: "Last Updated",
      value: a.updatedAt ? FormatDate(a.updatedAt, "M/D/YYYY h:mm A") : "",
    }),
  },
];

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
    visibleColumns: defaultColumns,
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
