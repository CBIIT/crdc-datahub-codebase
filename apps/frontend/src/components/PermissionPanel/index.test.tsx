import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC } from "react";
import { FormProvider, FormProviderProps } from "react-hook-form";
import { axe } from "vitest-axe";

import {
  EditUserInput,
  GET_TOOLTIPS,
  GetTooltipsInput,
  GetTooltipsResp,
  RETRIEVE_PBAC_DEFAULTS,
  RetrievePBACDefaultsInput,
  RetrievePBACDefaultsResp,
} from "../../graphql";
import { act, render, screen, waitFor, within } from "../../test-utils";

import PermissionPanel from "./index";

const getTooltipsMock: MockedResponse<GetTooltipsResp, GetTooltipsInput> = {
  request: {
    query: GET_TOOLTIPS,
  },
  result: {
    data: {
      getTooltips: [
        // Permissions
        { key: "submission_request:view", value: "View Submission Request" },
        { key: "data_submission:view", value: "View Data Submission" },
        { key: "program:manage", value: "Manage Programs" },
        { key: "access:request", value: "Request Access" },

        // Notifications
        { key: "submission_request:submitted", value: "Submission Request submitted" },
        { key: "data_submission:created", value: "Submission Request submitted" },
        { key: "access:requested", value: "Access Requested" },
      ],
    },
  },
};

type MockParentProps = {
  children: React.ReactNode;
  methods?: FormProviderProps<unknown>;
  mocks?: MockedResponse[];
};

const MockParent: FC<MockParentProps> = ({ children, methods, mocks = [] }) => (
  <MockedProvider mocks={mocks}>
    <FormProvider
      watch={vi.fn().mockImplementation(() => []) as FormProviderProps["watch"]}
      setValue={vi.fn()}
      {...methods}
    >
      {children}
    </FormProvider>
  </MockedProvider>
);

describe("Accessibility", () => {
  it("should not have any accessibility violations (empty)", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [],
              notifications: [],
            },
          ],
        },
      },
    };

    const { container } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[mock, getTooltipsMock]}>{children}</MockParent>
      ),
    });

    let result;
    await act(async () => {
      result = await axe(container);
    });
    expect(result).toHaveNoViolations();
  });

  it("should not have any accessibility violations (populated)", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
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

    const { container } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[mock, getTooltipsMock]}>{children}</MockParent>
      ),
    });

    let result;
    await act(async () => {
      result = await axe(container);
    });
    expect(result).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should not crash when rendered", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [],
              notifications: [],
            },
          ],
        },
      },
    };

    const { container } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[mock, getTooltipsMock]}>{children}</MockParent>
      ),
    });

    expect(container).toBeInTheDocument();
  });

  it("should cache the default PBAC data by default", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [],
              notifications: [],
            },
          ],
        },
      },
      maxUsageCount: 999,
    };

    const { rerender } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[mock, getTooltipsMock]}>{children}</MockParent>
      ),
    });

    expect(mockMatcher).toHaveBeenCalledTimes(1);

    rerender(<PermissionPanel />);

    expect(mockMatcher).toHaveBeenCalledTimes(1);
  });

  it("should group the permissions by their pre-defined groups", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
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
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "data_submission:view",
                  group: "Data Submission",
                  name: "View",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: true,
                },
                {
                  _id: "program:manage",
                  group: "Admin",
                  name: "Manage Programs",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
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

    const mockWatcher = vi.fn().mockImplementation((field) => {
      // Return the selected role (e.g. watch("role"))
      if (field === "role") {
        return "Submitter";
      }

      // Return the selected permissions (e.g. watch("permissions"))
      return [];
    });

    const { getByTestId } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permissions-group-Submission Request")).toBeInTheDocument();
    });

    const srGroup = getByTestId("permissions-group-Submission Request");
    expect(within(srGroup).getByTestId("permission-submission_request:create")).toBeInTheDocument();

    const dsGroup = getByTestId("permissions-group-Data Submission");
    expect(dsGroup).toBeInTheDocument();
    expect(within(dsGroup).getByTestId("permission-data_submission:view")).toBeInTheDocument();

    const adminGroup = getByTestId("permissions-group-Admin");
    expect(adminGroup).toBeInTheDocument();
    expect(within(adminGroup).getByTestId("permission-program:manage")).toBeInTheDocument();

    const dsEmailGroup = getByTestId("notifications-group-Data Submissions");
    expect(dsEmailGroup).toBeInTheDocument();
    expect(
      within(dsEmailGroup).getByTestId("notification-data_submission:cancelled")
    ).toBeInTheDocument();

    const accountGroup = getByTestId("notifications-group-Account");
    expect(accountGroup).toBeInTheDocument();
    expect(within(accountGroup).getByTestId("notification-account:disabled")).toBeInTheDocument();
  });

  it("should utilize a maximum of 3 columns for the permissions", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "submission_request:create",
                  group: "Group1",
                  name: "Create",
                  inherited: ["submission_request:view"],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "submission_request:submit",
                  group: "Group1",
                  name: "Create",
                  inherited: ["submission_request:view"],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "submission_request:review",
                  group: "Group2",
                  name: "Create",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "submission_request:submit",
                  group: "Group3",
                  name: "Create",
                  inherited: ["submission_request:view"],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "submission_request:view",
                  group: "Group4",
                  name: "Create",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "data_submission:create",
                  group: "Group5",
                  name: "Create",
                  inherited: ["data_submission:view"],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "study:manage",
                  group: "Group6",
                  name: "Create",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
              ],
              notifications: [],
            },
          ],
        },
      },
    };

    const mockWatcher = vi.fn().mockImplementation((field) => {
      if (field === "role") {
        return "Submitter";
      }

      return [];
    });

    const { getByTestId, queryByTestId } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permissions-column-0")).toBeInTheDocument();
      expect(getByTestId("permissions-column-1")).toBeInTheDocument();
      expect(getByTestId("permissions-column-2")).toBeInTheDocument();
    });

    // Column 0-1 (has 1 group)
    expect(
      within(getByTestId("permissions-column-0")).getByTestId("permissions-group-Group1")
    ).toBeInTheDocument();
    expect(
      within(getByTestId("permissions-column-1")).getByTestId("permissions-group-Group2")
    ).toBeInTheDocument();

    // Column 2 (has remaining groups)
    expect(
      within(getByTestId("permissions-column-2")).getByTestId("permissions-group-Group3")
    ).toBeInTheDocument();
    expect(
      within(getByTestId("permissions-column-2")).getByTestId("permissions-group-Group4")
    ).toBeInTheDocument();
    expect(
      within(getByTestId("permissions-column-2")).getByTestId("permissions-group-Group5")
    ).toBeInTheDocument();
    expect(
      within(getByTestId("permissions-column-2")).getByTestId("permissions-group-Group6")
    ).toBeInTheDocument();

    // Sanity check
    expect(queryByTestId("permissions-column-3")).not.toBeInTheDocument();
  });

  it("should utilize a maximum of 3 columns for the notifications", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [],
              notifications: [
                {
                  _id: "access:requested",
                  group: "Group1",
                  name: "Notification 1",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "data_submission:deleted",
                  group: "Group1",
                  name: "Notification 1-2",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "account:disabled",
                  group: "Group2",
                  name: "Notification 2",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "data_submission:cancelled",
                  group: "Group3",
                  name: "Notification 3",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "submission_request:to_be_reviewed",
                  group: "Group4",
                  name: "Notification 4",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "data_submission:withdrawn",
                  group: "Group5",
                  name: "Notification 5",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "data_submission:deleted",
                  group: "Group6",
                  name: "Notification 6",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
              ],
            },
          ],
        },
      },
    };

    const mockWatcher = vi.fn().mockImplementation((field) => {
      if (field === "role") {
        return "Submitter";
      }

      return [];
    });

    const { getByTestId, queryByTestId } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("notifications-column-0")).toBeInTheDocument();
      expect(getByTestId("notifications-column-1")).toBeInTheDocument();
      expect(getByTestId("notifications-column-2")).toBeInTheDocument();
    });

    // Column 0-1 (has 1 group)
    expect(
      within(getByTestId("notifications-column-0")).getByTestId("notifications-group-Group1")
    ).toBeInTheDocument();
    expect(
      within(getByTestId("notifications-column-1")).getByTestId("notifications-group-Group2")
    ).toBeInTheDocument();

    // Column 2 (has remaining groups)
    expect(
      within(getByTestId("notifications-column-2")).getByTestId("notifications-group-Group3")
    ).toBeInTheDocument();
    expect(
      within(getByTestId("notifications-column-2")).getByTestId("notifications-group-Group4")
    ).toBeInTheDocument();
    expect(
      within(getByTestId("notifications-column-2")).getByTestId("notifications-group-Group5")
    ).toBeInTheDocument();
    expect(
      within(getByTestId("notifications-column-2")).getByTestId("notifications-group-Group6")
    ).toBeInTheDocument();

    // Sanity check
    expect(queryByTestId("notifications-column-3")).not.toBeInTheDocument();
  });

  it("should sort the permissions and notifications by their order property", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "submission_request:create",
                  group: "Group1",
                  name: "Create",
                  inherited: ["submission_request:view"],
                  order: 1,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "submission_request:submit",
                  group: "Group1",
                  name: "Submit",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "submission_request:review",
                  group: "Group1",
                  name: "Review",
                  inherited: [],
                  order: 2,
                  checked: true,
                  disabled: false,
                },
              ],
              notifications: [
                {
                  _id: "access:requested",
                  group: "Group1",
                  name: "Notification 1",
                  inherited: [],
                  order: 1,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "data_submission:deleted",
                  group: "Group1",
                  name: "Notification 1-2",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "account:disabled",
                  group: "Group1",
                  name: "Notification 2",
                  inherited: [],
                  order: 2,
                  checked: true,
                  disabled: false,
                },
              ],
            },
          ],
        },
      },
    };

    const mockWatcher = vi.fn().mockImplementation((field) => {
      if (field === "role") {
        return "Submitter";
      }

      return [];
    });

    const { getByTestId } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permissions-group-Group1")).toBeInTheDocument();
    });

    const permissionGroup = getByTestId("permissions-group-Group1");
    expect(permissionGroup.innerHTML.search("permission-submission_request:submit")).toBeLessThan(
      permissionGroup.innerHTML.search("permission-submission_request:create")
    );
    expect(permissionGroup.innerHTML.search("permission-submission_request:create")).toBeLessThan(
      permissionGroup.innerHTML.search("permission-submission_request:review")
    );

    const notificationGroup = getByTestId("notifications-group-Group1");
    expect(notificationGroup.innerHTML.search("notification-data_submission:deleted")).toBeLessThan(
      notificationGroup.innerHTML.search("notification-access:requested")
    );
    expect(notificationGroup.innerHTML.search("notification-access:requested")).toBeLessThan(
      notificationGroup.innerHTML.search("notification-account:disabled")
    );
  });

  it("should show an error when unable to retrieve the default PBAC details (GraphQL)", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        errors: [new GraphQLError("Mock Error")],
      },
    };

    render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[mock, getTooltipsMock]}>{children}</MockParent>
      ),
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(expect.any(String), {
        variant: "error",
      });
    });
  });

  it("should show an error when unable to retrieve the default PBAC details (Network)", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      error: new Error("Network error"),
    };

    render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[mock, getTooltipsMock]}>{children}</MockParent>
      ),
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(expect.any(String), {
        variant: "error",
      });
    });
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should utilize the initial form values to determine the checked state of each permission", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
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
                  checked: false,
                  disabled: false,
                },
                {
                  _id: "program:manage",
                  group: "Admin",
                  name: "Manage Programs",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
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

    const mockWatcher = vi.fn().mockImplementation((field) => {
      if (field === "role") {
        return "Submitter";
      }

      if (field === "permissions") {
        return ["submission_request:create", "program:manage"];
      }

      if (field === "notifications") {
        return ["data_submission:cancelled"];
      }

      return [];
    });

    const { getByTestId } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-submission_request:create")).toBeInTheDocument();
    });

    // Checked permissions by default based on the initial form values
    expect(
      within(getByTestId("permission-submission_request:create")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();
    expect(
      within(getByTestId("permission-program:manage")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();

    // Unchecked permissions sanity check
    expect(
      within(getByTestId("permission-data_submission:view")).getByRole("checkbox", {
        hidden: true,
      })
    ).not.toBeChecked();

    // Checked notifications by default based on the initial form values
    expect(
      within(getByTestId("notification-data_submission:cancelled")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();

    // Unchecked notifications sanity check
    expect(
      within(getByTestId("notification-account:disabled")).getByRole("checkbox", {
        hidden: true,
      })
    ).not.toBeChecked();
  });

  it("should reset the permissions to their default values when the role changes", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
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
                  checked: false,
                  disabled: false,
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
            {
              role: "Federal Lead",
              permissions: [
                {
                  _id: "submission_request:create",
                  group: "Submission Request",
                  name: "Create",
                  inherited: ["submission_request:view"],
                  order: 0,
                  checked: false, // Original submitter had this checked
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
              ],
              notifications: [
                {
                  _id: "data_submission:cancelled",
                  group: "Data Submissions",
                  name: "Cancelled",
                  inherited: [],
                  order: 0,
                  checked: false, // Original submitter had this checked
                  disabled: false,
                },
                {
                  _id: "account:disabled",
                  group: "Account",
                  name: "Disabled",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
              ],
            },
          ],
        },
      },
    };

    const formValues: Partial<EditUserInput> = {
      role: "Submitter",
      permissions: ["submission_request:create"],
      notifications: ["data_submission:cancelled"],
    };

    const mockWatcher = vi.fn().mockImplementation((field) => formValues[field] ?? "");

    const mockSetValue = vi.fn().mockImplementation((field, value) => {
      formValues[field] = value;
    });

    const { getByTestId, rerender } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher, setValue: mockSetValue } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-submission_request:create")).toBeInTheDocument();
    });

    // Checked permissions by default based on the initial form values
    expect(
      within(getByTestId("permission-submission_request:create")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();

    // Unchecked permissions sanity check
    expect(
      within(getByTestId("permission-data_submission:view")).getByRole("checkbox", {
        hidden: true,
      })
    ).not.toBeChecked();

    // Checked notifications by default based on the initial form values
    expect(
      within(getByTestId("notification-data_submission:cancelled")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();

    // Unchecked notifications sanity check
    expect(
      within(getByTestId("notification-account:disabled")).getByRole("checkbox", {
        hidden: true,
      })
    ).not.toBeChecked();

    // Change the role
    formValues.role = "Federal Lead";

    rerender(<PermissionPanel />); // The original role is "Submitter", nothing should change
    rerender(<PermissionPanel />); // This is a work-around to trigger the UI update

    // Checked permissions by default based on the NEW role
    expect(
      within(getByTestId("permission-data_submission:view")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();

    // Unchecked permissions sanity check
    expect(
      within(getByTestId("permission-submission_request:create")).getByRole("checkbox", {
        hidden: true,
      })
    ).not.toBeChecked();

    // Checked notifications by default based on the NEW role
    expect(
      within(getByTestId("notification-account:disabled")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();

    // Unchecked notifications sanity check
    expect(
      within(getByTestId("notification-data_submission:cancelled")).getByRole("checkbox", {
        hidden: true,
      })
    ).not.toBeChecked();
  });

  it("should allow disabled PBAC options to be checked by default", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
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
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: true,
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
              ],
              notifications: [
                {
                  _id: "data_submission:cancelled",
                  group: "Data Submissions",
                  name: "Cancelled",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: true,
                },
                {
                  _id: "account:disabled",
                  group: "Account",
                  name: "Disabled",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
              ],
            },
          ],
        },
      },
      maxUsageCount: 999,
    };

    const formValues: Partial<EditUserInput> = {
      role: "Federal Lead",
      permissions: [],
      notifications: [],
    };

    const mockWatcher = vi.fn().mockImplementation((field) => formValues[field] ?? "");

    const mockSetValue = vi.fn().mockImplementation((field, value) => {
      formValues[field] = value;
    });

    const { getByTestId, rerender } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher, setValue: mockSetValue } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    // Trigger role change
    formValues.role = "Submitter";

    rerender(<PermissionPanel />);

    await waitFor(() => {
      expect(getByTestId("permission-submission_request:create")).toBeInTheDocument();
    });

    expect(
      within(getByTestId("permission-submission_request:create")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeDisabled();

    expect(
      within(getByTestId("notification-data_submission:cancelled")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeDisabled();
  });

  it("should be rendered as collapsed by default", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [],
        },
      },
    };

    const { getByTestId } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[mock, getTooltipsMock]}>{children}</MockParent>
      ),
    });

    expect(within(getByTestId("permissions-accordion")).getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    userEvent.click(within(getByTestId("permissions-accordion")).getByRole("button"));

    expect(within(getByTestId("permissions-accordion")).getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "true"
    );

    expect(within(getByTestId("notifications-accordion")).getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    userEvent.click(within(getByTestId("notifications-accordion")).getByRole("button"));

    expect(within(getByTestId("notifications-accordion")).getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("should propagate the permission and notification selections to the parent form", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
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
              ],
            },
          ],
        },
      },
    };

    const formValues: Partial<EditUserInput> = {
      role: "Submitter",
      permissions: [],
      notifications: [],
    };

    const mockWatcher = vi.fn().mockImplementation((field) => formValues[field] ?? "");

    const mockSetValue = vi.fn().mockImplementation((field, value) => {
      formValues[field] = value;
    });

    const { getByTestId, rerender } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher, setValue: mockSetValue } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-submission_request:create")).toBeInTheDocument();
    });

    userEvent.click(
      within(getByTestId("permission-submission_request:create")).getByRole("checkbox", {
        hidden: true,
      })
    );

    rerender(<PermissionPanel />); // Force the watch() to be called again and update the form values

    expect(mockSetValue).toHaveBeenCalledWith("permissions", [
      "submission_request:create", // Selected permission
      "submission_request:view", // Inherited permission
    ]);

    rerender(<PermissionPanel />); // Force the watch() to be called again and update the form values

    userEvent.click(
      within(getByTestId("permission-submission_request:create")).getByRole("checkbox", {
        hidden: true,
      })
    );

    expect(mockSetValue).toHaveBeenCalledWith("permissions", [
      "submission_request:view", // Inherited permission not unchecked
    ]);

    userEvent.click(
      within(getByTestId("notification-data_submission:cancelled")).getByRole("checkbox", {
        hidden: true,
      })
    );

    expect(mockSetValue).toHaveBeenCalledWith("notifications", ["data_submission:cancelled"]);

    rerender(<PermissionPanel />); // Force the watch() to be called again and update the form values

    userEvent.click(
      within(getByTestId("notification-data_submission:cancelled")).getByRole("checkbox", {
        hidden: true,
      })
    );

    expect(mockSetValue).toHaveBeenCalledWith("notifications", []);
  });

  it("should render a notice when there are no default PBAC details for a role", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [],
        },
      },
    };

    const { getByTestId } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[mock, getTooltipsMock]}>{children}</MockParent>
      ),
    });

    expect(getByTestId("no-permissions-notice")).toBeInTheDocument();
    expect(getByTestId("no-permissions-notice")).toHaveTextContent(
      /No permission options found for this role./i
    );

    expect(getByTestId("no-notifications-notice")).toBeInTheDocument();
    expect(getByTestId("no-notifications-notice")).toHaveTextContent(
      /No notification options found for this role./i
    );
  });

  it("should mark multiple inherited permissions as disabled", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "submission_request:view",
                  group: "Submission Request",
                  name: "View",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
                {
                  _id: "submission_request:create",
                  group: "Submission Request",
                  name: "Create",
                  inherited: [
                    "submission_request:view",
                    "submission_request:cancel",
                    "access:request",
                  ],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "submission_request:cancel",
                  group: "Submission Request",
                  name: "Cancel",
                  inherited: ["submission_request:view"],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "data_submission:cancel",
                  group: "Data Submission",
                  name: "Cancel",
                  inherited: ["data_submission:view"],
                  order: 1,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "data_submission:view",
                  group: "Data Submission",
                  name: "View",
                  inherited: [],
                  order: 1,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "access:request",
                  group: "Misc",
                  name: "Access Request",
                  inherited: [],
                  order: 2,
                  checked: true,
                  disabled: false,
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

    const formValues: Partial<EditUserInput> = {
      role: "Submitter",
      permissions: ["submission_request:create", "data_submission:cancel"],
      notifications: [],
    };

    const mockWatcher = vi.fn().mockImplementation((field) => formValues[field] ?? "");

    const mockSetValue = vi.fn().mockImplementation((field, value) => {
      formValues[field] = value;
    });

    const { getByTestId } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher, setValue: mockSetValue } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permissions-group-Submission Request")).toBeInTheDocument();
    });

    const inheritedPermissions: AuthPermissions[] = [
      "submission_request:view",
      "submission_request:cancel",
      "access:request",
      "data_submission:view",
    ];

    const nonInheritedPermissions: AuthPermissions[] = [
      "submission_request:create",
      "data_submission:cancel",
    ];

    inheritedPermissions.forEach((p) => {
      const checkbox = within(getByTestId(`permission-${p}`)).getByRole("checkbox", {
        hidden: true,
      });
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();
    });

    nonInheritedPermissions.forEach((p) => {
      const checkbox = within(getByTestId(`permission-${p}`)).getByRole("checkbox", {
        hidden: true,
      });
      expect(checkbox).toBeChecked();
      expect(checkbox).not.toBeDisabled();
    });
  });

  it("should disable all options when readOnly is specified", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
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
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false, // NOT DISABLED
                },
                {
                  _id: "data_submission:view",
                  group: "Data Submission",
                  name: "View",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false, // NOT DISABLED
                },
              ],
              notifications: [
                {
                  _id: "data_submission:cancelled",
                  group: "Data Submissions",
                  name: "Cancelled",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false, // NOT DISABLED
                },
                {
                  _id: "account:disabled",
                  group: "Account",
                  name: "Disabled",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false, // NOT DISABLED
                },
              ],
            },
          ],
        },
      },
      maxUsageCount: 999,
    };

    const formValues: Partial<EditUserInput> = {
      role: "Federal Lead",
      permissions: [],
      notifications: [],
    };

    const mockWatcher = vi.fn().mockImplementation((field) => formValues[field] ?? "");

    const mockSetValue = vi.fn().mockImplementation((field, value) => {
      formValues[field] = value;
    });

    const { getByTestId, rerender } = render(<PermissionPanel readOnly={false} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher, setValue: mockSetValue } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    // Trigger role change
    formValues.role = "Submitter";

    rerender(<PermissionPanel />);

    await waitFor(() => {
      expect(getByTestId("permission-submission_request:create")).toBeInTheDocument();
    });

    expect(
      within(getByTestId("permission-submission_request:create")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeEnabled();
    expect(
      within(getByTestId("permission-data_submission:view")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeEnabled();
    expect(
      within(getByTestId("notification-account:disabled")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeEnabled();
    expect(
      within(getByTestId("notification-data_submission:cancelled")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeEnabled();

    // Change the readOnly prop
    rerender(<PermissionPanel readOnly />);

    await waitFor(() => {
      expect(
        within(getByTestId("permission-submission_request:create")).getByRole("checkbox", {
          hidden: true,
        })
      ).toBeDisabled();
    });

    expect(
      within(getByTestId("permission-data_submission:view")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeDisabled();
    expect(
      within(getByTestId("notification-account:disabled")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeDisabled();
    expect(
      within(getByTestId("notification-data_submission:cancelled")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeDisabled();
  });

  it("should display the total number of checked permissions and notifications", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
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
                  inherited: [],
                  order: 0,
                  checked: true,
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
                  _id: "data_submission:cancel",
                  group: "Data Submission",
                  name: "Cancel",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
              ],
              notifications: [
                {
                  _id: "data_submission:cancelled",
                  group: "Data Submissions",
                  name: "Cancelled",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "account:disabled",
                  group: "Account",
                  name: "Disabled",
                  inherited: [],
                  order: 0,
                  checked: true,
                  disabled: false,
                },
                {
                  _id: "account:inactivated",
                  group: "Account",
                  name: "Inactivated",
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

    const formValues: Partial<EditUserInput> = {
      role: "Submitter",
      permissions: ["submission_request:create", "data_submission:view"],
      notifications: ["data_submission:cancelled", "account:disabled"],
    };

    const mockWatcher = vi.fn().mockImplementation((field) => formValues[field] ?? "");

    const mockSetValue = vi.fn().mockImplementation((field, value) => {
      formValues[field] = value;
    });

    const { getByTestId, rerender } = render(<PermissionPanel readOnly={false} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher, setValue: mockSetValue } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-submission_request:create")).toBeInTheDocument();
    });

    rerender(<PermissionPanel />);

    expect(getByTestId("permissions-count")).toHaveTextContent(/(2)/);
    expect(getByTestId("notifications-count")).toHaveTextContent(/(2)/);

    // Change the permissions and notifications
    userEvent.click(
      within(getByTestId("permission-data_submission:cancel")).getByRole("checkbox", {
        hidden: true,
      })
    );
    userEvent.click(
      within(getByTestId("notification-account:inactivated")).getByRole("checkbox", {
        hidden: true,
      })
    );

    rerender(<PermissionPanel />);

    expect(getByTestId("permissions-count")).toHaveTextContent(/(3)/);
    expect(getByTestId("notifications-count")).toHaveTextContent(/(3)/);
  });

  // NOTE: This is to test an edge case where linked values did not update the form values as expected
  it("should reflect inherited checkboxes in the total number of checked permissions and notifications", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "data_submission:view",
                  group: "Data Submission",
                  name: "View",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
                {
                  _id: "data_submission:cancel",
                  group: "Data Submission",
                  name: "Cancel",
                  inherited: ["data_submission:view"],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
              ],
              notifications: [
                {
                  _id: "account:disabled",
                  group: "Account",
                  name: "Disabled",
                  inherited: ["account:inactivated"],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
                {
                  _id: "account:inactivated",
                  group: "Account",
                  name: "Inactivated",
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

    const formValues: Partial<EditUserInput> = {
      role: "Submitter",
      permissions: [],
      notifications: [],
    };

    const mockWatcher = vi.fn().mockImplementation((field) => formValues[field] ?? "");

    const mockSetValue = vi.fn().mockImplementation((field, value) => {
      formValues[field] = value;
    });

    const { getByTestId, rerender } = render(<PermissionPanel readOnly={false} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher, setValue: mockSetValue } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-data_submission:view")).toBeInTheDocument();
    });

    rerender(<PermissionPanel />);

    // Nothing is checked initially
    expect(getByTestId("permissions-count")).toHaveTextContent(/(0)/);
    expect(getByTestId("notifications-count")).toHaveTextContent(/(0)/);

    // Check the checkboxes with inherited values
    userEvent.click(
      within(getByTestId("permission-data_submission:cancel")).getByRole("checkbox", {
        hidden: true,
      })
    );
    userEvent.click(
      within(getByTestId("notification-account:disabled")).getByRole("checkbox", {
        hidden: true,
      })
    );

    rerender(<PermissionPanel />);
    rerender(<PermissionPanel />);

    // NOTE: We are just checking the counts here, the checkboxes are checked in another test
    expect(getByTestId("permissions-count")).toHaveTextContent(/(2)/);
    expect(getByTestId("notifications-count")).toHaveTextContent(/(2)/);
  });

  // NOTE: This test ensures that a inherited permission's inherited permissions are also considered
  it("should check multi-level inherited permissions", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "data_submission:view",
                  group: "Data Submission",
                  name: "View",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
                {
                  _id: "data_submission:create",
                  group: "Data Submission",
                  name: "Create",
                  inherited: ["data_submission:view"], // Depends on the ability to view
                  order: 0,
                  checked: false,
                  disabled: false,
                },
                {
                  _id: "data_submission:cancel",
                  group: "Data Submission",
                  name: "Cancel",
                  inherited: ["data_submission:create"], // Depends on the ability to create
                  order: 0,
                  checked: false,
                  disabled: false,
                },
              ],
              notifications: [],
            },
          ],
        },
      },
    };

    const formValues: Partial<EditUserInput> = {
      role: "Submitter",
      permissions: [],
      notifications: [],
    };

    const mockWatcher = vi.fn().mockImplementation((field) => formValues[field] ?? "");

    const mockSetValue = vi.fn().mockImplementation((field, value) => {
      formValues[field] = value;
    });

    const { getByTestId, rerender } = render(<PermissionPanel readOnly={false} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher, setValue: mockSetValue } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-data_submission:view")).toBeInTheDocument();
    });

    // Check the cancel permission which has a multi-level dependency
    userEvent.click(
      within(getByTestId("permission-data_submission:cancel")).getByRole("checkbox", {
        hidden: true,
      })
    );

    // Force rerenders to trigger the useEffect. The mock functions in this test do not automatically trigger updates.
    rerender(<PermissionPanel />);
    rerender(<PermissionPanel />);
    rerender(<PermissionPanel />);

    await waitFor(() => {
      expect(getByTestId("permissions-count")).toHaveTextContent(/(3)/);
    });

    // Check that all the inherited permissions are checked
    expect(
      within(getByTestId("permission-data_submission:view")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();
    expect(
      within(getByTestId("permission-data_submission:create")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();
    expect(
      within(getByTestId("permission-data_submission:cancel")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();
  });

  it("should check multi-level inherited notifications", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [],
              notifications: [
                {
                  _id: "account:inactivated",
                  group: "Account",
                  name: "Inactivated",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
                {
                  _id: "account:disabled",
                  group: "Account",
                  name: "Disabled",
                  inherited: ["account:inactivated"], // Depends on the inactivation
                  order: 0,
                  checked: false,
                  disabled: false,
                },
                {
                  _id: "data_submission:cancelled",
                  group: "Data Submissions",
                  name: "Cancelled",
                  inherited: ["account:disabled"], // Depends on the disabled account
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

    const formValues: Partial<EditUserInput> = {
      role: "Submitter",
      permissions: [],
      notifications: [],
    };

    const mockWatcher = vi.fn().mockImplementation((field) => formValues[field] ?? "");

    const mockSetValue = vi.fn().mockImplementation((field, value) => {
      formValues[field] = value;
    });

    const { getByTestId, rerender } = render(<PermissionPanel readOnly={false} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher, setValue: mockSetValue } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("notification-account:inactivated")).toBeInTheDocument();
    });

    // Check the cancelled notification which has a multi-level dependency
    userEvent.click(
      within(getByTestId("notification-data_submission:cancelled")).getByRole("checkbox", {
        hidden: true,
      })
    );

    // Force rerenders to trigger the useEffect. The mock functions in this test do not automatically trigger updates.
    rerender(<PermissionPanel />);
    rerender(<PermissionPanel />);
    rerender(<PermissionPanel />);

    await waitFor(() => {
      expect(getByTestId("notifications-count")).toHaveTextContent(/(3)/);
    });

    // Check that all the inherited notifications are checked
    expect(
      within(getByTestId("notification-account:inactivated")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();
    expect(
      within(getByTestId("notification-account:disabled")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();
    expect(
      within(getByTestId("notification-data_submission:cancelled")).getByRole("checkbox", {
        hidden: true,
      })
    ).toBeChecked();
  });

  it("should check permissions when both user permission and defaults have scopes", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "data_submission:view:scope:scope-value" as AuthPermissions,
                  group: "Data Submission",
                  name: "View",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
              ],
              notifications: [],
            },
          ],
        },
      },
    };

    const formValues: Partial<EditUserInput> = {
      role: "Submitter",
      permissions: ["data_submission:view:scope:scope-value" as AuthPermissions],
      notifications: [],
    };

    const mockWatcher = vi.fn().mockImplementation((field) => formValues[field] ?? "");

    const mockSetValue = vi.fn().mockImplementation((field, value) => {
      formValues[field] = value;
    });

    const { getByTestId } = render(<PermissionPanel readOnly={false} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher, setValue: mockSetValue } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-data_submission:view:scope:scope-value")).toBeInTheDocument();
    });

    expect(getByTestId("permissions-count")).toHaveTextContent(/(1)/);

    expect(
      within(getByTestId("permission-data_submission:view:scope:scope-value")).getByRole(
        "checkbox",
        {
          hidden: true,
        }
      )
    ).toBeChecked();
  });

  it("should display tooltip on permission label when hovering", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "submission_request:view",
                  group: "Submission Request",
                  name: "View",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
              ],
              notifications: [],
            },
          ],
        },
      },
    };

    const mockWatcher = vi.fn().mockImplementation((field) => {
      if (field === "role") {
        return "Submitter";
      }
      return [];
    });

    const { getByTestId, getByRole } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-submission_request:view-label")).toBeInTheDocument();
    });

    const expandButton = getByRole("button", { name: /Permissions/ });
    userEvent.click(expandButton);

    const labelSpan = getByTestId("permission-submission_request:view-label");

    userEvent.hover(labelSpan);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("View Submission Request", {
        normalizeWhitespace: true,
      });
    });
  });

  it("should display tooltip on notification label when hovering", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [],
              notifications: [
                {
                  _id: "submission_request:submitted",
                  group: "Submission Request",
                  name: "Submitted",
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

    const mockWatcher = vi.fn().mockImplementation((field) => {
      if (field === "role") {
        return "Submitter";
      }
      return [];
    });

    const { getByTestId, getByRole } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("notification-submission_request:submitted-label")).toBeInTheDocument();
    });

    const expandButton = getByRole("button", { name: /Email Notifications/ });
    userEvent.click(expandButton);

    const labelSpan = getByTestId("notification-submission_request:submitted-label");

    userEvent.hover(labelSpan);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Submission Request submitted", {
        normalizeWhitespace: true,
      });
    });
  });

  it("should store tooltips as array in local storage", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [],
              notifications: [],
            },
          ],
        },
      },
    };

    render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[mock, getTooltipsMock]}>{children}</MockParent>
      ),
    });

    await waitFor(() => {
      expect(localStorage.getItem("profile-tooltips")).not.toBeNull();
    });

    const storedTooltips = JSON.parse(localStorage.getItem("profile-tooltips") || "[]");

    expect(Array.isArray(storedTooltips)).toBe(true);
    expect(storedTooltips.length).toBeGreaterThan(0);
    expect(storedTooltips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "submission_request:view",
          value: "View Submission Request",
        }),
        expect.objectContaining({ key: "data_submission:view", value: "View Data Submission" }),
        expect.objectContaining({ key: "program:manage", value: "Manage Programs" }),
        expect.objectContaining({ key: "access:request", value: "Request Access" }),
        expect.objectContaining({
          key: "submission_request:submitted",
          value: "Submission Request submitted",
        }),
        expect.objectContaining({
          key: "data_submission:created",
          value: "Submission Request submitted",
        }),
        expect.objectContaining({ key: "access:requested", value: "Access Requested" }),
      ])
    );
  });

  it("should not call API when tooltips are already in local storage", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [],
              notifications: [],
            },
          ],
        },
      },
    };

    const storedTooltips = [
      { key: "submission_request:view", value: "View Submission Request" },
      { key: "data_submission:view", value: "View Data Submission" },
      { key: "program:manage", value: "Manage Programs" },
    ];
    localStorage.setItem("profile-tooltips", JSON.stringify(storedTooltips));

    render(<PermissionPanel />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(localStorage.getItem("profile-tooltips")).not.toBeNull();
    });

    const tooltips = JSON.parse(localStorage.getItem("profile-tooltips") || "[]");
    expect(tooltips).toEqual(storedTooltips);
  });

  it("should retrieve tooltip using base key (without scope suffix)", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "data_submission:view:scope:scope-123" as AuthPermissions,
                  group: "Data Submission",
                  name: "View",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
              ],
              notifications: [],
            },
          ],
        },
      },
    };

    const mockWatcher = vi.fn().mockImplementation((field) => {
      if (field === "role") {
        return "Submitter";
      }
      return [];
    });

    const { getByTestId, getByRole } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(
        getByTestId("permission-data_submission:view:scope:scope-123-label")
      ).toBeInTheDocument();
    });

    const expandButton = getByRole("button", { name: /Permissions/ });
    userEvent.click(expandButton);

    const labelSpan = getByTestId("permission-data_submission:view:scope:scope-123-label");

    userEvent.hover(labelSpan);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("View Data Submission", {
        normalizeWhitespace: true,
      });
    });
  });

  it("should handle missing tooltip data gracefully", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "submission_request:view",
                  group: "Submission Request",
                  name: "View",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
              ],
              notifications: [],
            },
          ],
        },
      },
    };

    const mockWatcher = vi.fn().mockImplementation((field) => {
      if (field === "role") {
        return "Submitter";
      }
      return [];
    });

    const getTooltipsEmptyMock: MockedResponse<GetTooltipsResp, GetTooltipsInput> = {
      request: {
        query: GET_TOOLTIPS,
      },
      result: {
        data: {
          getTooltips: [],
        },
      },
    };

    const { getByTestId, getByRole } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsEmptyMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-submission_request:view")).toBeInTheDocument();
    });

    const expandButton = getByRole("button", { name: /Permissions/ });
    userEvent.click(expandButton);

    expect(getByTestId("permission-submission_request:view")).toBeInTheDocument();
    expect(global.mockEnqueue).not.toHaveBeenCalled();
  });

  it("should handle GET_TOOLTIPS API failure gracefully", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "submission_request:view",
                  group: "Submission Request",
                  name: "View",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
              ],
              notifications: [],
            },
          ],
        },
      },
    };

    const mockWatcher = vi.fn().mockImplementation((field) => {
      if (field === "role") {
        return "Submitter";
      }
      return [];
    });

    const getTooltipsErrorMock: MockedResponse<GetTooltipsResp, GetTooltipsInput> = {
      request: {
        query: GET_TOOLTIPS,
      },
      error: new Error("Network error"),
    };

    const { getByTestId, getByRole } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsErrorMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-submission_request:view")).toBeInTheDocument();
    });

    const expandButton = getByRole("button", { name: /Permissions/ });
    userEvent.click(expandButton);

    expect(getByTestId("permission-submission_request:view")).toBeInTheDocument();
    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Failed to retrieve PBAC tooltips", {
        variant: "error",
      });
    });
  });

  it("should handle GET_TOOLTIPS GraphQL error gracefully", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "data_submission:view",
                  group: "Data Submission",
                  name: "View",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
              ],
              notifications: [],
            },
          ],
        },
      },
    };

    const mockWatcher = vi.fn().mockImplementation((field) => {
      if (field === "role") {
        return "Submitter";
      }
      return [];
    });

    const getTooltipsGraphQLErrorMock: MockedResponse<GetTooltipsResp, GetTooltipsInput> = {
      request: {
        query: GET_TOOLTIPS,
      },
      result: {
        errors: [new GraphQLError("Failed to fetch tooltips")],
      },
    };

    const { getByTestId, getByRole } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsGraphQLErrorMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-data_submission:view")).toBeInTheDocument();
    });

    const expandButton = getByRole("button", { name: /Permissions/ });
    userEvent.click(expandButton);

    expect(getByTestId("permission-data_submission:view")).toBeInTheDocument();
    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Failed to retrieve PBAC tooltips", {
        variant: "error",
      });
    });
  });

  it("should handle null tooltip response gracefully", async () => {
    const mock: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
      request: {
        query: RETRIEVE_PBAC_DEFAULTS,
        variables: { roles: ["All"] },
      },
      result: {
        data: {
          retrievePBACDefaults: [
            {
              role: "Submitter",
              permissions: [
                {
                  _id: "program:manage",
                  group: "Admin",
                  name: "Manage Programs",
                  inherited: [],
                  order: 0,
                  checked: false,
                  disabled: false,
                },
              ],
              notifications: [],
            },
          ],
        },
      },
    };

    const mockWatcher = vi.fn().mockImplementation((field) => {
      if (field === "role") {
        return "Submitter";
      }
      return [];
    });

    const getTooltipsNullMock: MockedResponse<GetTooltipsResp, GetTooltipsInput> = {
      request: {
        query: GET_TOOLTIPS,
      },
      result: {
        data: {
          getTooltips: null as unknown as GetTooltipsResp["getTooltips"],
        },
      },
    };

    const { getByTestId, getByRole } = render(<PermissionPanel />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock, getTooltipsNullMock]}
          methods={{ watch: mockWatcher } as unknown as FormProviderProps}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("permission-program:manage")).toBeInTheDocument();
    });

    const expandButton = getByRole("button", { name: /Permissions/ });
    userEvent.click(expandButton);

    expect(getByTestId("permission-program:manage")).toBeInTheDocument();
    expect(global.mockEnqueue).not.toHaveBeenCalled();
  });
});
