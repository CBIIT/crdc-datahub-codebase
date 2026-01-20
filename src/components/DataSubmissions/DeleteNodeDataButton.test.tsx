import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { useMemo } from "react";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { collaboratorFactory } from "@/factories/submission/CollaboratorFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { DELETE_DATA_RECORDS, DeleteDataRecordsInput, DeleteDataRecordsResp } from "../../graphql";
import { render, waitFor, within } from "../../test-utils";
import { Context as AuthContext, ContextState as AuthContextState } from "../Contexts/AuthContext";
import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../Contexts/SubmissionContext";

import Button from "./DeleteNodeDataButton";

type TestParentProps = {
  submission?: Partial<Submission>;
  user?: Partial<User>;
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const TestParent: React.FC<TestParentProps> = ({
  mocks = [],
  submission = {},
  user = { permissions: ["data_submission:view", "data_submission:create"] },
  children,
}) => {
  const submissionCtxValue = useMemo<SubmissionCtxState>(
    () =>
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADED,
        error: null,
        data: {
          getSubmission: submissionFactory.build({ ...submission }),
          submissionStats: {
            stats: [],
          },
          getSubmissionAttributes: null,
        },
      }),
    [submission]
  );

  const authCtxValue = useMemo<AuthContextState>(
    () => authCtxStateFactory.build({ user: userFactory.build({ ...user }) }),
    [user]
  );

  return (
    <MockedProvider mocks={mocks} showWarnings>
      <AuthContext.Provider value={authCtxValue}>
        <SubmissionContext.Provider value={submissionCtxValue}>
          {children}
        </SubmissionContext.Provider>
      </AuthContext.Provider>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  it("should have no violations for DeleteNodeDataButton component", async () => {
    const { container, getByTestId } = render(
      <Button nodeType="test" selectedItems={["ID_1", "ID_2", "ID_3"]} selectType="explicit" />,
      { wrapper: TestParent }
    );

    expect(getByTestId("delete-node-data-button")).not.toBeDisabled(); // Sanity check to ensure the button is active
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations for DeleteNodeDataButton component when disabled", async () => {
    const { container, getByTestId } = render(
      <Button nodeType="test" selectedItems={[]} selectType="explicit" />,
      {
        wrapper: TestParent,
      }
    );

    expect(getByTestId("delete-node-data-button")).toBeDisabled(); // Sanity check to ensure the button is disabled
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", () => {
    expect(() =>
      render(<Button nodeType="" selectedItems={[]} selectType="explicit" />, {
        wrapper: TestParent,
      })
    ).not.toThrow();
  });

  it("should show a snackbar when the delete operation fails (GraphQL Error)", async () => {
    const mocks: MockedResponse<DeleteDataRecordsResp, DeleteDataRecordsInput>[] = [
      {
        request: {
          query: DELETE_DATA_RECORDS,
        },
        variableMatcher: () => true,
        result: {
          errors: [new GraphQLError("Simulated GraphQL error")],
        },
      },
    ];

    const { getByTestId, getByRole } = render(
      <Button nodeType="test" selectedItems={["1 item ID"]} selectType="explicit" />,
      { wrapper: (props) => <TestParent {...props} mocks={mocks} /> }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("delete-node-data-button"));

    // Click dialog confirm button
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "An error occurred while deleting the selected rows.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should show a snackbar when the delete operation fails (Network Error)", async () => {
    const mocks: MockedResponse<DeleteDataRecordsResp, DeleteDataRecordsInput>[] = [
      {
        request: {
          query: DELETE_DATA_RECORDS,
        },
        variableMatcher: () => true,
        error: new Error("Simulated network error"),
      },
    ];

    const { getByTestId, getByRole } = render(
      <Button nodeType="test" selectedItems={["1 item ID"]} selectType="explicit" />,
      { wrapper: (props) => <TestParent {...props} mocks={mocks} /> }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("delete-node-data-button"));

    // Click dialog confirm button
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "An error occurred while deleting the selected rows.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should show a snackbar when the delete operation fails (API Error)", async () => {
    const mocks: MockedResponse<DeleteDataRecordsResp, DeleteDataRecordsInput>[] = [
      {
        request: {
          query: DELETE_DATA_RECORDS,
        },
        variableMatcher: () => true,
        result: {
          data: {
            deleteDataRecords: {
              success: false,
              message: "Simulated API rejection message",
            },
          },
        },
      },
    ];

    const { getByTestId, getByRole } = render(
      <Button nodeType="test" selectedItems={["1 item ID"]} selectType="explicit" />,
      { wrapper: (props) => <TestParent {...props} mocks={mocks} /> }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("delete-node-data-button"));

    // Click dialog confirm button
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "An error occurred while deleting the selected rows.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should be disabled when there are no selected items", () => {
    const { getByTestId } = render(
      <Button nodeType="fake-node" selectedItems={[]} selectType="explicit" />,
      {
        wrapper: TestParent,
      }
    );

    expect(getByTestId("delete-node-data-button")).toBeDisabled();
  });

  it("should be enabled when the collaborator does have 'Can Edit' permissions", () => {
    const { getByTestId } = render(
      <TestParent
        user={{
          _id: "collaborator-user",
          role: "Submitter",
        }}
        submission={submissionFactory.build({
          submitterID: "some-other-user",
          collaborators: [
            collaboratorFactory.build({
              collaboratorID: "collaborator-user",
              collaboratorName: "",
              permission: "Can Edit",
            }),
          ],
        })}
      >
        <Button nodeType="test" selectedItems={["ID_1", "ID_2", "ID_3"]} selectType="explicit" />,
      </TestParent>
    );

    expect(getByTestId("delete-node-data-button")).toBeEnabled();
  });

  it("should call the onDelete callback when the delete operation is successful", async () => {
    const onDelete = vi.fn();
    const mocks: MockedResponse<DeleteDataRecordsResp, DeleteDataRecordsInput>[] = [
      {
        request: {
          query: DELETE_DATA_RECORDS,
        },
        variableMatcher: () => true,
        result: {
          data: {
            deleteDataRecords: {
              success: true,
              message: "",
            },
          },
        },
      },
    ];

    const { getByTestId, getByRole } = render(
      <Button
        nodeType="test"
        selectedItems={["1 item ID"]}
        onDelete={onDelete}
        selectType="explicit"
      />,
      { wrapper: (props) => <TestParent {...props} mocks={mocks} /> }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("delete-node-data-button"));

    // Click dialog confirm button
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalled();
    });
  });
});

describe("Implementation Requirements", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should be disabled when a deletion operation is in progress", () => {
    const { getByTestId } = render(
      <Button nodeType="test" selectedItems={[]} selectType="explicit" />,
      {
        wrapper: (props) => <TestParent {...props} submission={{ deletingData: true }} />,
      }
    );

    expect(getByTestId("delete-node-data-button")).toBeDisabled();
  });

  it("should have a tooltip on the delete button (enabled)", async () => {
    const { getByTestId, findByRole } = render(
      <Button nodeType="test" selectedItems={["1 item ID"]} selectType="explicit" />,
      {
        wrapper: TestParent,
      }
    );

    userEvent.hover(getByTestId("delete-node-data-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument(); // NOTE: We don't care about the tooltip content here, see below

    userEvent.unhover(getByTestId("delete-node-data-button"));

    await waitFor(() => {
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  it.each<[nodeType: string, content: string]>([
    ["data file", "Delete all the selected data files from this data submission"],
    ["random metadata", "Delete all the selected records from this data submission"],
  ])(
    "should customize the tooltip text for metadata vs data files",
    async (nodeType, tooltipText) => {
      const { getByTestId, findByRole } = render(
        <Button nodeType={nodeType} selectedItems={["1 item ID"]} selectType="explicit" />,
        {
          wrapper: TestParent,
        }
      );

      userEvent.hover(getByTestId("delete-node-data-button"));

      const tooltip = await findByRole("tooltip");
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent(tooltipText);
    }
  );

  it("should have a tooltip when the delete button is disabled with an ongoing deletion", async () => {
    const { getByTestId, findByRole } = render(
      <Button nodeType="test" selectedItems={[]} selectType="explicit" />,
      {
        wrapper: (props) => <TestParent {...props} submission={{ deletingData: true }} />,
      }
    );

    // NOTE: Cannot hover a disabled button, pointing to the span instead
    userEvent.hover(getByTestId("delete-node-data-button").parentElement);

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(
      "Delete action unavailable while another delete operation is in progress"
    );
  });

  it("should show a confirmation dialog when the 'Delete' icon is clicked", async () => {
    const { getByTestId, getByRole } = render(
      <Button nodeType="test" selectedItems={["1 item ID"]} selectType="explicit" />,
      {
        wrapper: TestParent,
      }
    );

    expect(() => getByRole("dialog")).toThrow();

    userEvent.click(getByTestId("delete-node-data-button"));

    expect(getByRole("dialog")).toBeInTheDocument();
  });

  it("should delete the selected nodes only when the 'Delete' button is clicked in the dialog", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mocks: MockedResponse<DeleteDataRecordsResp, DeleteDataRecordsInput>[] = [
      {
        request: {
          query: DELETE_DATA_RECORDS,
        },
        variableMatcher: mockMatcher,
        result: {
          data: {
            deleteDataRecords: {
              success: false,
              message: "Simulated API rejection message",
            },
          },
        },
      },
    ];

    const { getByTestId, getByRole } = render(
      <Button
        nodeType="test-node-type"
        selectedItems={["ID_1", "ID_2", "ID_3"]}
        selectType="explicit"
      />,
      {
        wrapper: (props) => (
          <TestParent {...props} mocks={mocks} submission={{ _id: "mock-submission-id" }} />
        ),
      }
    );

    expect(mockMatcher).not.toHaveBeenCalled();

    userEvent.click(getByTestId("delete-node-data-button"));

    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: "mock-submission-id",
          nodeType: "test-node-type",
          nodeIds: ["ID_1", "ID_2", "ID_3"],
        })
      );
    });
  });

  it("should use deleteAll API when selectType is true with no exclusions", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mocks: MockedResponse<DeleteDataRecordsResp, DeleteDataRecordsInput>[] = [
      {
        request: {
          query: DELETE_DATA_RECORDS,
        },
        variableMatcher: mockMatcher,
        result: {
          data: {
            deleteDataRecords: {
              success: true,
              message: "",
            },
          },
        },
      },
    ];

    const { getByTestId, getByRole } = render(
      <Button
        nodeType="test-node-type"
        selectedItems={[]}
        selectType="exclusion"
        totalData={100}
      />,
      {
        wrapper: (props) => (
          <TestParent {...props} mocks={mocks} submission={{ _id: "mock-submission-id" }} />
        ),
      }
    );

    expect(mockMatcher).not.toHaveBeenCalled();

    userEvent.click(getByTestId("delete-node-data-button"));

    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: "mock-submission-id",
          nodeType: "test-node-type",
          deleteAll: true,
        })
      );
      // nodeIds should not be provided when deleteAll is true
      expect(mockMatcher).not.toHaveBeenCalledWith(
        expect.objectContaining({
          nodeIds: expect.anything(),
        })
      );
    });
  });

  it("should use deleteAll with exclusiveIDs when selectAllActive is true with exclusions", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mocks: MockedResponse<DeleteDataRecordsResp, DeleteDataRecordsInput>[] = [
      {
        request: {
          query: DELETE_DATA_RECORDS,
        },
        variableMatcher: mockMatcher,
        result: {
          data: {
            deleteDataRecords: {
              success: true,
              message: "",
            },
          },
        },
      },
    ];

    const { getByTestId, getByRole } = render(
      <Button
        nodeType="test-node-type"
        selectedItems={["excluded-id-1", "excluded-id-2"]}
        selectType="exclusion"
        totalData={100}
      />,
      {
        wrapper: (props) => (
          <TestParent {...props} mocks={mocks} submission={{ _id: "mock-submission-id" }} />
        ),
      }
    );

    userEvent.click(getByTestId("delete-node-data-button"));

    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: "mock-submission-id",
          nodeType: "test-node-type",
          deleteAll: true,
          exclusiveIDs: ["excluded-id-1", "excluded-id-2"],
        })
      );
    });
  });

  it("should show error when exclusiveIDs exceed the 2000 limit", async () => {
    const { getByTestId } = render(
      <Button
        nodeType="test-node-type"
        selectedItems={Array(2001).fill("excluded-id")}
        selectType="exclusion"
        totalData={5000}
      />,
      {
        wrapper: TestParent,
      }
    );

    userEvent.click(getByTestId("delete-node-data-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Cannot delete with more than 2000 exclusions. Please adjust your selection.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should show error when nodeIds exceed the 2000 limit (non-selectAll mode)", async () => {
    const { getByTestId } = render(
      <Button
        nodeType="test-node-type"
        selectedItems={Array(2001).fill("node-id")}
        selectType="explicit"
        totalData={5000}
      />,
      {
        wrapper: TestParent,
      }
    );

    userEvent.click(getByTestId("delete-node-data-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        'Cannot delete more than 2000 items at once. Please use "Select All" or reduce your selection.',
        {
          variant: "error",
        }
      );
    });
  });

  it("should show correct item count in dialog when selectAllActive is true", async () => {
    const { getByTestId, getByRole } = render(
      <Button
        nodeType="test-node"
        selectedItems={["excluded-1", "excluded-2"]}
        selectType="exclusion"
        totalData={100}
      />,
      {
        wrapper: TestParent,
      }
    );

    userEvent.click(getByTestId("delete-node-data-button"));

    const dialog = getByRole("dialog");
    // Should show 98 items (100 total - 2 excluded)
    expect(within(dialog).getByTestId("delete-dialog-description")).toHaveTextContent(
      "You have selected to delete 98 test-node nodes"
    );
  });

  it("should be disabled when selectAllActive is true but all items are excluded", () => {
    const { getByTestId } = render(
      <Button
        nodeType="test-node"
        selectedItems={["id-1", "id-2", "id-3"]}
        selectType="exclusion"
        totalData={3}
      />,
      {
        wrapper: TestParent,
      }
    );

    // Effective count is 0 (3 total - 3 excluded)
    expect(getByTestId("delete-node-data-button")).toBeDisabled();
  });

  it("should dismiss the dialog when the 'Cancel' button is clicked", async () => {
    const { getByTestId, getByRole } = render(
      <Button nodeType="test" selectedItems={["1 item ID"]} selectType="explicit" />,
      {
        wrapper: TestParent,
      }
    );

    userEvent.click(getByTestId("delete-node-data-button"));

    const dialog = getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const button = await within(dialog).findByRole("button", { name: /cancel/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(() => getByRole("dialog")).toThrow();
    });
  });

  it("should contain the nodeType and selection count in the delete dialog content", async () => {
    const { getByTestId, getByRole } = render(
      <Button nodeType="test-node-123" selectedItems={["node-id-456"]} selectType="explicit" />,
      {
        wrapper: TestParent,
      }
    );

    userEvent.click(getByTestId("delete-node-data-button"));

    const dialog = getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    expect(dialog).toHaveTextContent(/Delete test-node-123/i);
    expect(dialog).toHaveTextContent(/You have selected to delete 1 test-node-123/i);
  });

  it.each<[string, string]>([
    ["not a data file", "Delete Not A Data File Node"],
    ["genomic_info", "Delete Genomic_info Node"],
    ["file", "Delete File Node"],
    ["ALL CAPS", "Delete All Caps Node"],
  ])("should use a title-cased nodeType in the dialog header", (nodeType, expected) => {
    const { getByTestId, getByRole } = render(
      <Button nodeType={nodeType} selectedItems={["node-id-456"]} selectType="explicit" />,
      {
        wrapper: TestParent,
      }
    );

    userEvent.click(getByTestId("delete-node-data-button"));

    const dialog = getByRole("dialog");

    expect(within(dialog).getByTestId("delete-dialog-header")).toHaveTextContent(expected);
  });

  it.each<[number, string]>([
    [1, "Delete Xyz-node Node"],
    [2, "Delete Xyz-node Nodes"],
    [72, "Delete Xyz-node Nodes"],
  ])(
    "should use the proper pluralization for the delete dialog title",
    async (selectedItems, expected) => {
      const { getByTestId, getByRole } = render(
        <Button
          nodeType="xyz-node"
          selectedItems={Array(selectedItems).fill("fake-node-id")}
          selectType="explicit"
        />,
        {
          wrapper: TestParent,
        }
      );

      userEvent.click(getByTestId("delete-node-data-button"));

      const dialog = getByRole("dialog");

      expect(within(dialog).getByTestId("delete-dialog-header")).toHaveTextContent(expected);
    }
  );

  it.each<[number, string]>([
    [
      1,
      "You have selected to delete 1 test-node-123 node. This action is irreversible. Are you sure you want to delete them and their associated children from this data submission?",
    ],
    [
      2,
      "You have selected to delete 2 test-node-123 nodes. This action is irreversible. Are you sure you want to delete them and their associated children from this data submission?",
    ],
    [
      1024,
      "You have selected to delete 1024 test-node-123 nodes. This action is irreversible. Are you sure you want to delete them and their associated children from this data submission?",
    ],
  ])(
    "should use the proper pluralization for the delete dialog content",
    async (selectedItems, expected) => {
      const { getByTestId, getByRole } = render(
        <Button
          nodeType="test-node-123"
          selectedItems={Array(selectedItems).fill("fake-node-id")}
          selectType="explicit"
        />,
        {
          wrapper: TestParent,
        }
      );

      userEvent.click(getByTestId("delete-node-data-button"));

      const dialog = getByRole("dialog");
      expect(within(dialog).getByTestId("delete-dialog-description")).toHaveTextContent(expected);
    }
  );

  it.each<[number, string]>([
    [
      1,
      "1 test-node-123 node and their associated child nodes have been deleted from this data submission",
    ],
    [
      2,
      "2 test-node-123 nodes and their associated child nodes have been deleted from this data submission",
    ],
    [
      1024,
      "1024 test-node-123 nodes and their associated child nodes have been deleted from this data submission",
    ],
  ])(
    "should use the proper pluralization for the delete confirmation snackbar message",
    async (selectedItems, expected) => {
      const mockOnDelete = vi.fn();
      const mock: MockedResponse<DeleteDataRecordsResp, DeleteDataRecordsInput> = {
        request: {
          query: DELETE_DATA_RECORDS,
        },
        variableMatcher: () => true,
        result: {
          data: {
            deleteDataRecords: {
              success: true,
              message: "",
            },
          },
        },
      };

      const { getByTestId, getByRole } = render(
        <Button
          nodeType="test-node-123"
          selectedItems={Array(selectedItems).fill("fake-node-id")}
          onDelete={mockOnDelete}
          selectType="explicit"
        />,
        {
          wrapper: (props) => <TestParent {...props} mocks={[mock]} />,
        }
      );

      userEvent.click(getByTestId("delete-node-data-button"));

      const dialog = getByRole("dialog");
      const button = await within(dialog).findByRole("button", { name: /confirm/i });

      userEvent.click(button);

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith(expected);
      });
    }
  );

  // NOTE: This is just a broad sanity check for the Data File nodeType
  // which is common across all data models and has special handling
  it.each<{
    selectedItems: number;
    dialogTitle: string;
    dialogBody: string;
    snackbarMessage: string;
  }>([
    {
      selectedItems: 1,
      dialogTitle: "Delete Data File",
      dialogBody: "You have selected to delete 1 data file from this data submission.",
      snackbarMessage: "1 data file have been deleted from this data submission",
    },
    {
      selectedItems: 35,
      dialogTitle: "Delete Data Files",
      dialogBody: "You have selected to delete 35 data files from this data submission.",
      snackbarMessage: "35 data files have been deleted from this data submission",
    },
  ])(
    "should have different verbiage when the nodeType is 'data file'",
    async ({ selectedItems, dialogTitle, dialogBody, snackbarMessage }) => {
      const mockOnDelete = vi.fn();
      const mock: MockedResponse<DeleteDataRecordsResp, DeleteDataRecordsInput> = {
        request: {
          query: DELETE_DATA_RECORDS,
        },
        variableMatcher: () => true,
        result: {
          data: {
            deleteDataRecords: {
              success: true,
              message: "",
            },
          },
        },
      };

      const { getByTestId, getByRole } = render(
        <Button
          nodeType="data file"
          selectedItems={Array(selectedItems).fill("fake-data-file")}
          onDelete={mockOnDelete}
          selectType="explicit"
        />,
        {
          wrapper: (props) => <TestParent {...props} mocks={[mock]} />,
        }
      );

      userEvent.click(getByTestId("delete-node-data-button"));

      const dialog = getByRole("dialog");
      expect(within(dialog).getByTestId("delete-dialog-header")).toHaveTextContent(dialogTitle);
      expect(within(dialog).getByTestId("delete-dialog-description")).toHaveTextContent(dialogBody);

      const button = await within(dialog).findByRole("button", { name: /confirm/i });
      userEvent.click(button);

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith(snackbarMessage);
      });
    }
  );

  it("should be visible and interactive when the user has the required permissions", async () => {
    const { getByTestId } = render(
      <Button nodeType="test" selectedItems={[]} selectType="explicit" />,
      {
        wrapper: (props) => (
          <TestParent
            {...props}
            user={{
              role: "Submitter",
              permissions: ["data_submission:view", "data_submission:create"],
            }}
          />
        ),
      }
    );

    expect(getByTestId("delete-node-data-button")).toBeVisible();
  });

  it("should not be rendered when the user is missing the required permissions", async () => {
    const { queryByTestId } = render(
      <Button nodeType="test" selectedItems={[]} selectType="explicit" />,
      {
        wrapper: (props) => <TestParent {...props} user={{ role: "Submitter", permissions: [] }} />,
      }
    );

    expect(queryByTestId("delete-node-data-button")).not.toBeInTheDocument();
  });

  it.each<SubmissionStatus>(["New", "In Progress", "Rejected", "Withdrawn"])(
    "should (implicitly) be enabled for the Submission Status %s",
    (status) => {
      const { getByTestId } = render(
        <Button nodeType="test" selectedItems={["item-1"]} selectType="explicit" />,
        {
          wrapper: (props) => <TestParent {...props} submission={{ status }} />,
        }
      );

      expect(getByTestId("delete-node-data-button")).toBeEnabled();
    }
  );

  it.each<SubmissionStatus>(["Submitted", "Released", "Completed", "Canceled", "Deleted"])(
    "should be disabled for the Submission Status %s",
    (status) => {
      const { getByTestId } = render(
        <Button nodeType="test" selectedItems={["item-1"]} selectType="explicit" />,
        {
          wrapper: (props) => <TestParent {...props} submission={{ status }} />,
        }
      );

      expect(getByTestId("delete-node-data-button")).toBeDisabled();
    }
  );
});
