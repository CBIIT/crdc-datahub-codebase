import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "@storybook/test";
import { FormProvider, useForm } from "react-hook-form";

import {
  RetrievePBACDefaultsResp,
  RetrievePBACDefaultsInput,
  RETRIEVE_PBAC_DEFAULTS,
  EditUserInput,
  GET_TOOLTIPS,
  GetTooltipsResp,
  GetTooltipsInput,
} from "../../graphql";

import PermissionPanel from "./index";

const meta: Meta<typeof PermissionPanel> = {
  title: "Miscellaneous / Permission Panel",
  component: PermissionPanel,
  tags: ["autodocs"],
  args: {
    readOnly: false,
  },
  decorators: [
    (Story, ctx) => {
      const methods = useForm<EditUserInput>({
        defaultValues: {
          role: "Submitter",
          permissions: [],
          notifications: [],
        },
      });

      return (
        <FormProvider key={`${ctx.args.readOnly}`} {...methods}>
          <Story />
        </FormProvider>
      );
    },
    (Story) => (
      <div style={{ position: "relative", marginTop: "-63px" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(within(canvas.getByTestId("permissions-accordion")).getByRole("button"));

    await userEvent.click(
      within(canvas.getByTestId("notifications-accordion")).getByRole("button")
    );

    // Remove focus from the accordion button
    await userEvent.click(canvasElement);
  },
} satisfies Meta<typeof PermissionPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockWithData: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
  request: {
    query: RETRIEVE_PBAC_DEFAULTS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      retrievePBACDefaults: [
        {
          role: "Submitter",
          permissions: [
            {
              _id: "submission_request:create",
              group: "Submission Request",
              name: "Create",
              inherited: ["submission_request:view"],
              order: 0,
              checked: false,
              disabled: false,
            },
            {
              _id: "data_submission:view",
              group: "Data Submission",
              name: "View",
              inherited: [],
              order: 0,
              checked: true,
              disabled: false,
            },
            {
              _id: "data_submission:create",
              group: "Data Submission",
              name: "Create",
              inherited: ["data_submission:view"],
              order: 0,
              checked: false,
              disabled: false,
            },
            {
              _id: "data_submission:cancel",
              group: "Data Submission",
              name: "Cancel",
              inherited: ["data_submission:create"],
              order: 0,
              checked: false,
              disabled: false,
            },
            {
              _id: "data_submission:review",
              group: "Data Submission",
              name: "Review",
              inherited: ["data_submission:view"],
              order: 0,
              checked: false,
              disabled: false,
            },
            {
              _id: "access:request",
              group: "Miscellaneous",
              name: "Request Access",
              inherited: [],
              order: 0,
              checked: true,
              disabled: true,
            },
          ],
          notifications: [
            {
              _id: "data_submission:cancelled",
              group: "Data Submissions",
              name: "Cancelled",
              inherited: [],
              order: 0,
              checked: false,
              disabled: false,
            },
            {
              _id: "data_submission:completed",
              group: "Data Submissions",
              name: "Completed",
              inherited: ["data_submission:cancelled"],
              order: 0,
              checked: false,
              disabled: false,
            },
            {
              _id: "account:disabled",
              group: "Account",
              name: "Disabled",
              inherited: [],
              order: 0,
              checked: false,
              disabled: false,
            },
          ],
        },
      ],
    },
  },
};

const mockTooltips: MockedResponse<GetTooltipsResp, GetTooltipsInput> = {
  request: {
    query: GET_TOOLTIPS,
  },
  result: {
    data: {
      getTooltips: [
        // Permissions
        { key: "submission_request:view", value: "View Submission Request" },
        { key: "submission_request:create", value: "Create Submission Request" },
        { key: "data_submission:view", value: "View Data Submission" },
        { key: "data_submission:create", value: "Create Data Submission" },
        { key: "data_submission:cancel", value: "Cancel Data Submission" },
        { key: "data_submission:review", value: "Review Data Submission" },
        { key: "access:request", value: "Request Access" },

        // Notifications
        { key: "submission_request:submitted", value: "Submission Request Submitted" },
        { key: "data_submission:cancelled", value: "Data Submission Cancelled" },
        { key: "data_submission:completed", value: "Data Submission Completed" },
        { key: "data_submission:created", value: "Data Submission Created" },
        { key: "account:disabled", value: "Account Disabled" },
        { key: "access:requested", value: "Access Requested" },
      ],
    },
  },
};

export const Default: Story = {
  parameters: {
    apolloClient: {
      mocks: [mockWithData, mockTooltips],
    },
  },
};

export const Readonly: Story = {
  args: {
    readOnly: true,
  },
  parameters: {
    apolloClient: {
      mocks: [mockWithData, mockTooltips],
    },
  },
};

export const TooltipHover: Story = {
  args: {
    readOnly: false,
  },
  parameters: {
    apolloClient: {
      mocks: [mockWithData, mockTooltips],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(within(canvas.getByTestId("permissions-accordion")).getByRole("button"));

    await userEvent.click(
      within(canvas.getByTestId("notifications-accordion")).getByRole("button")
    );

    // Remove focus from the accordion button
    await userEvent.click(canvasElement);

    await userEvent.hover(canvas.getByTestId("permission-data_submission:view-label"));

    await canvas.findByText("Request Access");
  },
};

const mockWithNoData: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
  request: {
    query: RETRIEVE_PBAC_DEFAULTS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      retrievePBACDefaults: [],
    },
  },
};

export const NoOptions: Story = {
  args: {},
  parameters: {
    apolloClient: {
      mocks: [mockWithNoData],
    },
  },
};
