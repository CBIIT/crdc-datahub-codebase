import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import React from "react";

import { userFactory } from "@/factories/auth/UserFactory";
import { collaboratorFactory } from "@/factories/submission/CollaboratorFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import {
  LIST_POTENTIAL_COLLABORATORS,
  EDIT_SUBMISSION_COLLABORATORS,
  ListPotentialCollaboratorsResp,
  ListPotentialCollaboratorsInput,
  EditSubmissionCollaboratorsResp,
  EditSubmissionCollaboratorsInput,
} from "../../graphql";
import { act, fireEvent, render, renderHook, waitFor } from "../../test-utils";

import { useCollaboratorsContext, CollaboratorsProvider } from "./CollaboratorsContext";

const dummySubmissionData = {
  getSubmission: submissionFactory.build({
    _id: "submission-id-123",
    collaborators: [
      collaboratorFactory.build({
        collaboratorID: "user-1",
        permission: "Can Edit",
        collaboratorName: "Smith, Alice",
      }),
      collaboratorFactory.build({
        collaboratorID: "user-2",
        permission: "Can Edit",
        collaboratorName: "Johnson, Bob",
      }),
    ],
  }),
};

let mockSubmissionData = dummySubmissionData;
vi.mock("./SubmissionContext", async () => ({
  ...(await vi.importActual("./SubmissionContext")),
  useSubmissionContext: () => ({
    data: mockSubmissionData,
  }),
}));

const mockPotentialCollaborators: User[] = [
  userFactory.build({
    _id: "user-1",
    firstName: "Alice",
    lastName: "Smith",
    role: "User",
  }),
  userFactory.build({
    _id: "user-2",
    firstName: "Bob",
    lastName: "Johnson",
    role: "User",
  }),
  userFactory.build({
    _id: "user-3",
    firstName: "Charlie",
    lastName: "Brown",
    role: "User",
  }),
];

const listPotentialCollaboratorsMock: MockedResponse<
  ListPotentialCollaboratorsResp,
  ListPotentialCollaboratorsInput
> = {
  request: {
    query: LIST_POTENTIAL_COLLABORATORS,
    variables: { submissionID: "submission-id-123" },
  },
  result: {
    data: {
      listPotentialCollaborators: mockPotentialCollaborators,
    },
  },
};

const editSubmissionCollaboratorsMock: MockedResponse<
  EditSubmissionCollaboratorsResp,
  EditSubmissionCollaboratorsInput
> = {
  request: {
    query: EDIT_SUBMISSION_COLLABORATORS,
    variables: {
      submissionID: "submission-id-123",
      collaborators: [{ collaboratorID: "user-3", permission: "Can Edit" } as Collaborator],
    },
  },
  result: {
    data: {
      editSubmissionCollaborators: {
        collaborators: [{ collaboratorID: "user-3", permission: "Can Edit" } as Collaborator],
      } as Submission,
    },
  },
};

const TestChild: React.FC = () => {
  const {
    currentCollaborators,
    remainingPotentialCollaborators,
    handleAddCollaborator,
    handleRemoveCollaborator,
    handleUpdateCollaborator,
    saveCollaborators,
    resetCollaborators,
    loadPotentialCollaborators,
    loading,
    error,
  } = useCollaboratorsContext();

  return (
    <div>
      <div data-testid="current-collaborators">{JSON.stringify(currentCollaborators)}</div>
      <div data-testid="remaining-potential-collaborators">
        {JSON.stringify(remainingPotentialCollaborators)}
      </div>
      <button type="button" data-testid="add-collaborator-button" onClick={handleAddCollaborator}>
        Add Collaborator
      </button>
      <button
        type="button"
        data-testid="remove-collaborator-button"
        onClick={() => handleRemoveCollaborator(0)}
      >
        Remove Collaborator
      </button>
      <button
        type="button"
        data-testid="remove-collaborator-1-button"
        onClick={() => handleRemoveCollaborator(1)}
      >
        Remove Collaborator at Index 1
      </button>
      <button
        type="button"
        data-testid="remove-collaborator-2-button"
        onClick={() => handleRemoveCollaborator(2)}
      >
        Remove Collaborator at Index 2
      </button>
      <button
        type="button"
        data-testid="update-collaborator-button"
        onClick={() =>
          handleUpdateCollaborator(0, { collaboratorID: "user-3", permission: "Can Edit" })
        }
      >
        Update Collaborator
      </button>
      <button type="button" data-testid="save-collaborators-button" onClick={saveCollaborators}>
        Save Collaborators
      </button>
      <button type="button" data-testid="reset-collaborators-button" onClick={resetCollaborators}>
        Reset Collaborators
      </button>
      <button
        type="button"
        data-testid="load-potential-collaborators-button"
        onClick={loadPotentialCollaborators}
      >
        Load Potential Collaborators
      </button>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="error">{error ? error.message : ""}</div>
      <button
        type="button"
        data-testid="remove-collaborator-invalid-button"
        onClick={() => handleRemoveCollaborator(5)}
      >
        Remove Collaborator Invalid
      </button>
      <button
        type="button"
        data-testid="update-collaborator-invalid-index-button"
        onClick={() =>
          handleUpdateCollaborator(NaN, {
            collaboratorID: "",
            permission: "" as CollaboratorPermissions,
          })
        }
      >
        Update Collaborator Invalid Index
      </button>
      <button
        type="button"
        data-testid="update-collaborator-invalid-data-button"
        onClick={() =>
          handleUpdateCollaborator(0, {
            collaboratorID: "",
            permission: "" as CollaboratorPermissions,
          })
        }
      >
        Update Collaborator Invalid Data
      </button>
    </div>
  );
};

type TestParentProps = {
  mocks?: MockedResponse[];
  children?: React.ReactNode;
};

const TestParent: React.FC<TestParentProps> = ({ mocks = [], children }) => (
  <MockedProvider mocks={mocks}>
    <CollaboratorsProvider>{children ?? <TestChild />}</CollaboratorsProvider>
  </MockedProvider>
);

describe("CollaboratorsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should initialize with default current collaborator", () => {
    const { getByTestId } = render(<TestParent />);

    const currentCollaborators = JSON.parse(
      getByTestId("current-collaborators").textContent || "[]"
    );

    expect(currentCollaborators.length).toBe(
      dummySubmissionData.getSubmission.collaborators.length
    );
    expect(currentCollaborators[0].collaboratorID).toBe("user-1");
    expect(currentCollaborators[1].collaboratorID).toBe("user-2");
  });

  it("should load potential collaborators", async () => {
    const mocks = [listPotentialCollaboratorsMock];
    mockSubmissionData = {
      getSubmission: {
        ...dummySubmissionData.getSubmission,
        collaborators: [],
      },
    };

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    userEvent.click(getByTestId("load-potential-collaborators-button"));

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });

    await waitFor(() => {
      const remainingCollaborators = JSON.parse(
        getByTestId("remaining-potential-collaborators").textContent || "[]"
      );
      expect(remainingCollaborators.length).toEqual(mockPotentialCollaborators.length);
    });

    mockSubmissionData = dummySubmissionData;
  });

  it("should add a collaborator", async () => {
    const mocks = [listPotentialCollaboratorsMock];

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    userEvent.click(getByTestId("load-potential-collaborators-button"));

    expect(JSON.parse(getByTestId("current-collaborators").textContent || "[]").length).toBe(
      dummySubmissionData.getSubmission.collaborators.length
    );

    fireEvent.click(getByTestId("add-collaborator-button"));

    await waitFor(() => {
      expect(JSON.parse(getByTestId("current-collaborators").textContent || "[]").length).toBe(
        dummySubmissionData.getSubmission.collaborators.length + 1
      );
    });
  });

  it("should remove a collaborator", () => {
    const mocks = [listPotentialCollaboratorsMock];
    const { getByTestId } = render(<TestParent mocks={mocks} />);

    userEvent.click(getByTestId("load-potential-collaborators-button")); // Now we have 2 collaborators

    userEvent.click(getByTestId("remove-collaborator-button"));

    const currentCollaborators = JSON.parse(
      getByTestId("current-collaborators").textContent || "[]"
    );

    expect(currentCollaborators.length).toBe(1);
  });

  it("should keep an empty collaborator row if it is the last row while removing a collaborator", () => {
    const mocks = [listPotentialCollaboratorsMock];
    const { getByTestId } = render(<TestParent mocks={mocks} />);

    userEvent.click(getByTestId("load-potential-collaborators-button")); // Now we have 2 collaborators

    userEvent.click(getByTestId("remove-collaborator-button"));

    expect(JSON.parse(getByTestId("current-collaborators").textContent || "[]").length).toBe(1);

    userEvent.click(getByTestId("remove-collaborator-button"));
    userEvent.click(getByTestId("remove-collaborator-button"));
    userEvent.click(getByTestId("remove-collaborator-button"));
    expect(JSON.parse(getByTestId("current-collaborators").textContent || "[]").length).toBe(1);
  });

  it("should remove a collaborator when there are multiple collaborators", () => {
    const { getByTestId } = render(<TestParent />);

    let currentCollaborators = JSON.parse(getByTestId("current-collaborators").textContent || "[]");
    expect(currentCollaborators.length).toBe(
      dummySubmissionData.getSubmission.collaborators.length
    );

    userEvent.click(getByTestId("add-collaborator-button"));
    userEvent.click(getByTestId("add-collaborator-button")); // Now length 4

    currentCollaborators = JSON.parse(getByTestId("current-collaborators").textContent || "[]");
    expect(currentCollaborators.length).toBe(
      dummySubmissionData.getSubmission.collaborators.length + 2
    );

    userEvent.click(getByTestId("remove-collaborator-1-button"));

    currentCollaborators = JSON.parse(getByTestId("current-collaborators").textContent || "[]");
    expect(currentCollaborators.length).toBe(
      dummySubmissionData.getSubmission.collaborators.length + 1
    );

    expect(currentCollaborators[0]).toBeDefined();
    expect(currentCollaborators[1]).toBeDefined();
  });

  it("should update a collaborator", () => {
    const { getByTestId } = render(<TestParent />);

    userEvent.click(getByTestId("update-collaborator-button"));

    const currentCollaborators = JSON.parse(
      getByTestId("current-collaborators").textContent || "[]"
    );

    expect(currentCollaborators[0].collaboratorID).toBe("user-3");
    expect(currentCollaborators[0].permission).toBe("Can Edit");
  });

  it("should save collaborators", async () => {
    const mocks = [editSubmissionCollaboratorsMock];

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    // Remove user-2
    userEvent.click(getByTestId("remove-collaborator-button"));

    userEvent.click(getByTestId("update-collaborator-button"));

    const currentCollaborators = JSON.parse(
      getByTestId("current-collaborators").textContent || "[]"
    );

    expect(currentCollaborators[0].collaboratorID).toBe("user-3");
    expect(currentCollaborators[0].permission).toBe("Can Edit");

    userEvent.click(getByTestId("save-collaborators-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "All collaborator changes have been saved successfully."
      );
    });
  });

  it("should handle save collaborators error", async () => {
    const errorMock: MockedResponse<
      EditSubmissionCollaboratorsResp,
      EditSubmissionCollaboratorsInput
    > = {
      request: {
        query: EDIT_SUBMISSION_COLLABORATORS,
      },
      variableMatcher: () => true,
      error: new Error("Failed to save collaborators."),
    };

    const mocks = [errorMock];

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    userEvent.click(getByTestId("update-collaborator-button"));

    userEvent.click(getByTestId("save-collaborators-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to edit submission collaborators.", {
        variant: "error",
      });
    });
  });

  it("should reset collaborators", () => {
    const { getByTestId } = render(<TestParent />);

    userEvent.click(getByTestId("update-collaborator-button"));

    userEvent.click(getByTestId("reset-collaborators-button"));

    const currentCollaborators = JSON.parse(
      getByTestId("current-collaborators").textContent || "[]"
    );

    expect(currentCollaborators[0].collaboratorID).toBe("user-1");
    expect(currentCollaborators[1].collaboratorID).toBe("user-2");
  });

  it("should throw an error when useCollaboratorsContext is used outside of CollaboratorsProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // Suppress expected console error

    expect(() => {
      render(
        <MockedProvider>
          <TestChild />
        </MockedProvider>
      );
    }).toThrow("useCollaboratorsContext must be used within a CollaboratorsProvider");

    vi.spyOn(console, "error").mockRestore();
  });

  it("should handle null potential collaborators list", async () => {
    const mocks = [
      {
        request: {
          query: LIST_POTENTIAL_COLLABORATORS,
          variables: { submissionID: "submission-id-123" },
        },
        result: {
          data: {
            listPotentialCollaborators: null,
          },
        },
      },
    ];

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    userEvent.click(getByTestId("load-potential-collaborators-button"));

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
      const remainingCollaborators = JSON.parse(
        getByTestId("remaining-potential-collaborators").textContent || "[]"
      );
      expect(remainingCollaborators.length).toBe(0);
    });
  });

  it("should handle error when loading potential collaborators", async () => {
    const errorMock: MockedResponse<
      ListPotentialCollaboratorsResp,
      ListPotentialCollaboratorsInput
    > = {
      request: {
        query: LIST_POTENTIAL_COLLABORATORS,
        variables: { submissionID: "submission-id-123" },
      },
      error: new Error("Failed to load potential collaborators."),
    };

    const { getByTestId } = render(<TestParent mocks={[errorMock]} />);

    userEvent.click(getByTestId("load-potential-collaborators-button"));

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
      expect(getByTestId("error").textContent).toContain("Failed to load potential collaborators.");
    });
  });

  it("should map submission collaborators with potential collaborators", async () => {
    const mocks = [listPotentialCollaboratorsMock];

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    userEvent.click(getByTestId("load-potential-collaborators-button"));

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });

    userEvent.click(getByTestId("reset-collaborators-button"));

    await waitFor(() => {
      const currentCollaborators = JSON.parse(
        getByTestId("current-collaborators").textContent || "[]"
      );

      expect(currentCollaborators[0].collaboratorID).toBe("user-1");
      expect(currentCollaborators[0].collaboratorName).toBe("Smith, Alice");
    });
  });

  it("should not load potential collaborators if submissionID is null", async () => {
    const testSubmissionData = {
      getSubmission: submissionFactory.build({
        _id: null,
        collaborators: [
          collaboratorFactory.build({
            collaboratorID: "user-4",
            permission: "Can Edit",
            collaboratorName: "Doe, John",
          }),
        ],
      }),
    };

    mockSubmissionData = testSubmissionData;

    const { getByTestId } = render(<TestParent mocks={[]} />);

    userEvent.click(getByTestId("load-potential-collaborators-button"));

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });

    fireEvent.click(getByTestId("add-collaborator-button"));
    fireEvent.click(getByTestId("add-collaborator-button"));
    fireEvent.click(getByTestId("add-collaborator-button"));

    userEvent.click(getByTestId("reset-collaborators-button"));

    await waitFor(() => {
      const currentCollaborators = JSON.parse(
        getByTestId("current-collaborators").textContent || "[]"
      );

      // Should reset back to initial getSubmission collaborators
      expect(currentCollaborators[0].collaboratorID).toBe("user-4");
      expect(currentCollaborators[0].permission).toBe("Can Edit");
      expect(currentCollaborators[0].collaboratorName).toBe("Doe, John");
    });

    mockSubmissionData = dummySubmissionData;
  });

  it("should handle collaborators not in potential collaborators", async () => {
    const testSubmissionData = {
      getSubmission: submissionFactory.build({
        _id: "submission-id-123",
        collaborators: [{ collaboratorID: "user-4", permission: "Can Edit" } as Collaborator],
      }),
    };

    mockSubmissionData = testSubmissionData;

    const mocks = [listPotentialCollaboratorsMock];

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    userEvent.click(getByTestId("load-potential-collaborators-button"));

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });

    userEvent.click(getByTestId("reset-collaborators-button"));

    await waitFor(() => {
      const currentCollaborators = JSON.parse(
        getByTestId("current-collaborators").textContent || "[]"
      );

      expect(currentCollaborators[0].collaboratorID).toBe("user-4");
      expect(currentCollaborators[0].collaboratorName).toBeUndefined();
    });

    mockSubmissionData = dummySubmissionData;
  });

  it("should not remove collaborator if index is invalid in handleRemoveCollaborator", () => {
    const { getByTestId } = render(<TestParent />);

    const initialCollaborators = JSON.parse(
      getByTestId("current-collaborators").textContent || "[]"
    );
    expect(initialCollaborators.length).toBe(
      dummySubmissionData.getSubmission.collaborators.length
    );

    userEvent.click(getByTestId("remove-collaborator-invalid-button"));

    const currentCollaborators = JSON.parse(
      getByTestId("current-collaborators").textContent || "[]"
    );
    expect(currentCollaborators.length).toBe(
      dummySubmissionData.getSubmission.collaborators.length
    );
  });

  it("should reset to default collaborator when all collaborators are removed", () => {
    const { getByTestId } = render(<TestParent />);

    userEvent.click(getByTestId("remove-collaborator-button"));

    const currentCollaborators = JSON.parse(
      getByTestId("current-collaborators").textContent || "[]"
    );

    expect(currentCollaborators.length).toBe(
      dummySubmissionData.getSubmission.collaborators.length - 1
    );
    expect(currentCollaborators[0].collaboratorID).toBe(
      dummySubmissionData.getSubmission.collaborators[1].collaboratorID
    );
  });

  it("should not update collaborator if input is invalid in handleUpdateCollaborator", () => {
    const { getByTestId } = render(<TestParent />);

    const initialCollaborators = JSON.parse(
      getByTestId("current-collaborators").textContent || "[]"
    );

    userEvent.click(getByTestId("update-collaborator-invalid-index-button"));

    let currentCollaborators = JSON.parse(getByTestId("current-collaborators").textContent || "[]");
    expect(currentCollaborators).toEqual(initialCollaborators);

    userEvent.click(getByTestId("update-collaborator-invalid-data-button"));

    currentCollaborators = JSON.parse(getByTestId("current-collaborators").textContent || "[]");
    expect(currentCollaborators).toEqual(initialCollaborators);
  });

  it("should handle update collaborator when potentialCollaborators is empty", () => {
    const { getByTestId } = render(<TestParent />);

    userEvent.click(getByTestId("update-collaborator-button"));

    const currentCollaborators = JSON.parse(
      getByTestId("current-collaborators").textContent || "[]"
    );

    expect(currentCollaborators[0].collaboratorID).toBe("user-3");
    expect(currentCollaborators[0].permission).toBe("Can Edit");
    expect(currentCollaborators[0].collaboratorName).toBeUndefined();
  });

  it("should handle missing data in saveCollaborators", async () => {
    const mocks: MockedResponse<
      EditSubmissionCollaboratorsResp,
      EditSubmissionCollaboratorsInput
    >[] = [
      {
        request: {
          query: EDIT_SUBMISSION_COLLABORATORS,
        },
        variableMatcher: () => true,
        result: {
          data: null,
        },
      },
    ];

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    userEvent.click(getByTestId("update-collaborator-button"));

    userEvent.click(getByTestId("save-collaborators-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to edit submission collaborators.", {
        variant: "error",
      });
    });
  });

  it("should update a collaborator with data from potentialCollaborators", async () => {
    const mocks = [listPotentialCollaboratorsMock];

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    userEvent.click(getByTestId("load-potential-collaborators-button"));

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });

    userEvent.click(getByTestId("update-collaborator-button"));

    const currentCollaborators = JSON.parse(
      getByTestId("current-collaborators").textContent || "[]"
    );

    expect(currentCollaborators[0].collaboratorID).toBe("user-3");
    expect(currentCollaborators[0].permission).toBe("Can Edit");

    expect(currentCollaborators[0].collaboratorName).toBe("Brown, Charlie");
  });

  it("should handle updating an existing collaborator when they're no longer a potential collaborator", async () => {
    mockSubmissionData = dummySubmissionData;

    const emptyPotentialCollaborators: MockedResponse<
      ListPotentialCollaboratorsResp,
      ListPotentialCollaboratorsInput
    > = {
      request: {
        query: LIST_POTENTIAL_COLLABORATORS,
        variables: { submissionID: "submission-id-123" },
      },
      result: {
        data: {
          listPotentialCollaborators: [],
        },
      },
    };

    const { result } = renderHook(() => useCollaboratorsContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[emptyPotentialCollaborators]}>{children}</TestParent>
      ),
    });

    act(() => {
      result.current.loadPotentialCollaborators();
    });

    const existingCol = dummySubmissionData.getSubmission.collaborators[0];

    await waitFor(() => {
      expect(result.current.currentCollaborators.length).toBe(2);
      expect(result.current.maxCollaborators).toBe(2);
    });

    expect(result.current.currentCollaborators[0].collaboratorID).toBe(existingCol.collaboratorID);
    expect(result.current.currentCollaborators[0].permission).toBe(existingCol.permission);

    // Update an existing collaborator that NO LONGER exists in potential collaborators
    act(() => {
      result.current.handleUpdateCollaborator(0, {
        collaboratorID: dummySubmissionData.getSubmission.collaborators[0].collaboratorID,
        permission: "Can Edit",
      });
    });

    await waitFor(() => {
      // Verify the update propagated
      expect(result.current.currentCollaborators[0].permission).toBe("Can Edit");
    });

    // Verify the user's details are carried over from the existing collaborators
    expect(result.current.currentCollaborators[0].collaboratorName).toBe(
      existingCol.collaboratorName
    );

    act(() => {
      result.current.handleRemoveCollaborator(0);
    });

    // Verify preventing re-adding invalid potential collaborator
    await waitFor(() => {
      expect(result.current.currentCollaborators.length).toBe(1);
      expect(result.current.maxCollaborators).toBe(1);
    });
  });
});
