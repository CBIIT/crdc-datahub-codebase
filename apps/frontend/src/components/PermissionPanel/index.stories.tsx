import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { screen, userEvent, waitFor, within, expect } from "@storybook/test";
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
          role: (ctx.parameters?.formDefaultRole as UserRole) || "Submitter",
          permissions: [],
          notifications: (ctx.parameters?.formDefaultNotifications as AuthNotifications[]) || [],
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

const mockNestedReadonly: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
  request: {
    query: RETRIEVE_PBAC_DEFAULTS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      retrievePBACDefaults: [
        {
          role: "Submitter",
          permissions: [],
          notifications: [
            {
              _id: "submission_request:reviewed",
              group: "Submission Request Emails",
              name: "When review decision made",
              inherited: [],
              order: 3,
              checked: true,
              disabled: true,
            },
            {
              _id: "submission_request:pending_cleared",
              group: "Submission Request Emails",
              name: "When conditionally approved",
              inherited: [],
              order: 4,
              checked: true,
              disabled: true,
            },
            {
              _id: "submission_request:expiring",
              group: "Submission Request Emails",
              name: "Pending on dbGaPID",
              inherited: [],
              order: 4.1,
              checked: true,
              disabled: true,
            },
            {
              _id: "submission_request:deleted",
              group: "Submission Request Emails",
              name: "Pending on model update",
              inherited: [],
              order: 4.2,
              checked: true,
              disabled: true,
            },
            {
              _id: "submission_request:canceled",
              group: "Submission Request Emails",
              name: "Pending on image de-ID",
              inherited: [],
              order: 4.3,
              checked: true,
              disabled: true,
            },
            {
              _id: "submission_request:submitted",
              group: "Submission Request Emails",
              name: "When Reopened",
              inherited: [],
              order: 5,
              checked: false,
              disabled: true,
            },
          ],
        },
      ],
    },
  },
};

const mockNestedEditable: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
  request: {
    query: RETRIEVE_PBAC_DEFAULTS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      retrievePBACDefaults: [
        {
          role: "Federal Lead",
          permissions: [],
          notifications: [
            {
              _id: "submission_request:reviewed",
              group: "Submission Request Emails",
              name: "When review decision made",
              inherited: [],
              order: 3,
              checked: false,
              disabled: false,
            },
            {
              _id: "submission_request:pending_cleared",
              group: "Submission Request Emails",
              name: "When conditionally approved",
              inherited: [],
              order: 4,
              checked: false,
              disabled: false,
            },
            {
              _id: "submission_request:expiring",
              group: "Submission Request Emails",
              name: "Pending on dbGaPID",
              inherited: [],
              order: 4.1,
              checked: false,
              disabled: false,
            },
            {
              _id: "submission_request:deleted",
              group: "Submission Request Emails",
              name: "Pending on model update",
              inherited: [],
              order: 4.2,
              checked: false,
              disabled: false,
            },
            {
              _id: "submission_request:canceled",
              group: "Submission Request Emails",
              name: "Pending on image de-ID",
              inherited: [],
              order: 4.3,
              checked: false,
              disabled: false,
            },
          ],
        },
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

    await waitFor(async () => {
      await screen.findByText("View Data Submission");
    });
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

export const NestedOptions: Story = {
  name: "Nested Options (Disabled)",
  args: {
    readOnly: false,
  },
  parameters: {
    formDefaultNotifications: [
      "submission_request:reviewed",
      "submission_request:pending_cleared",
      "submission_request:expiring",
      "submission_request:deleted",
      "submission_request:canceled",
    ],
    docs: {
      description: {
        story:
          "Nested notification options with backend-driven default checked and disabled states.",
      },
    },
    apolloClient: {
      mocks: [mockNestedReadonly, mockTooltips],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      within(canvas.getByTestId("notifications-accordion")).getByRole("button")
    );

    await waitFor(() => {
      expect(
        canvas.getByTestId("notification-submission_request:pending_cleared")
      ).toBeInTheDocument();
    });

    const reviewedCheckbox = within(
      canvas.getByTestId("notification-submission_request:reviewed")
    ).getByRole("checkbox", { hidden: true });

    const canceledCheckbox = within(
      canvas.getByTestId("notification-submission_request:canceled")
    ).getByRole("checkbox", { hidden: true });

    const submittedCheckbox = within(
      canvas.getByTestId("notification-submission_request:submitted")
    ).getByRole("checkbox", { hidden: true });

    // Backend-driven default checked states are reflected from the seeded form.
    expect(reviewedCheckbox).toBeChecked();
    expect(canceledCheckbox).toBeChecked();
    expect(canceledCheckbox).toBeDisabled();
    expect(submittedCheckbox).not.toBeChecked();
  },
};

export const NestedOptionsEditable: Story = {
  name: "Nested Options (Editable)",
  args: {
    readOnly: false,
  },
  parameters: {
    formDefaultRole: "Federal Lead",
    docs: {
      description: {
        story: "Internal role nested notification options in editable mode.",
      },
    },
    apolloClient: {
      mocks: [mockNestedEditable, mockTooltips],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      within(canvas.getByTestId("notifications-accordion")).getByRole("button")
    );

    await waitFor(() => {
      expect(
        canvas.getByTestId("notification-submission_request:pending_cleared")
      ).toBeInTheDocument();
    });

    const parentCheckbox = within(
      canvas.getByTestId("notification-submission_request:pending_cleared")
    ).getByRole("checkbox", { hidden: true });

    const childCheckbox = within(
      canvas.getByTestId("notification-submission_request:canceled")
    ).getByRole("checkbox", { hidden: true });

    expect(parentCheckbox).toBeEnabled();
    expect(childCheckbox).toBeEnabled();

    await userEvent.click(parentCheckbox);

    await waitFor(() => {
      expect(childCheckbox).toBeChecked();
    });
  },
};
