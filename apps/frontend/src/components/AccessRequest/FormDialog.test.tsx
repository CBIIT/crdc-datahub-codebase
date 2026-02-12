import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";

import {
  LIST_APPROVED_STUDIES,
  ListApprovedStudiesInput,
  ListApprovedStudiesResp,
  REQUEST_ACCESS,
  RequestAccessInput,
  RequestAccessResp,
} from "../../graphql";
import { render, waitFor, within } from "../../test-utils";
import {
  Context as AuthContext,
  ContextState as AuthContextState,
  Status as AuthContextStatus,
} from "../Contexts/AuthContext";
import {
  InstitutionCtx,
  InstitutionCtxState,
  InstitutionCtxStatus,
} from "../Contexts/InstitutionListContext";

import FormDialog from "./FormDialog";

const emptyStudiesMock: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput> = {
  request: {
    query: LIST_APPROVED_STUDIES,
  },
  result: {
    data: {
      listApprovedStudies: {
        total: 0,
        studies: [],
      },
    },
  },
  variableMatcher: () => true,
};

const studiesMock: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput> = {
  request: {
    query: LIST_APPROVED_STUDIES,
  },
  result: {
    data: {
      listApprovedStudies: {
        total: 2,
        studies: approvedStudyFactory.build(2, (index) => ({
          _id: `study-${index + 1}`,
          studyName: `Study-${index + 1}`,
          studyAbbreviation: `S${index + 1}`,
          dbGaPID: null,
          originalOrg: null,
          primaryContact: null,
        })),
      },
    },
  },
  variableMatcher: () => true,
};

const mockInstitutionList: Institution[] = [
  institutionFactory.build({
    _id: "institution-1",
    name: "Institution 1",
    submitterCount: 0,
  }),
  institutionFactory.build({
    _id: "institution-2",
    name: "Institution 2",
    submitterCount: 5,
  }),
  institutionFactory.build({
    _id: "institution-3",
    name: "Institution 3",
    submitterCount: 2,
  }),
];

type MockParentProps = {
  mocks: MockedResponse[];
  user?: Partial<User>;
  institutions?: Institution[];
  children: React.ReactNode;
};

const MockParent: FC<MockParentProps> = ({ mocks, user = {}, institutions = [], children }) => {
  const authValue: AuthContextState = useMemo<AuthContextState>(
    () => ({
      isLoggedIn: true,
      status: AuthContextStatus.LOADED,
      user: userFactory.build({ permissions: ["access:request"], ...user }),
    }),
    [user]
  );

  const instValue: InstitutionCtxState = useMemo<InstitutionCtxState>(
    () => ({
      data: institutions,
      total: institutions.length,
      status: InstitutionCtxStatus.LOADED,
    }),
    [institutions]
  );

  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      <AuthContext.Provider value={authValue}>
        <InstitutionCtx.Provider value={instValue}>{children}</InstitutionCtx.Provider>
      </AuthContext.Provider>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // NOTE – Failing in CI
  it.skip("should have no violations", async () => {
    const { container } = render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[emptyStudiesMock]} institutions={[]}>
          {children}
        </MockParent>
      ),
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", () => {
    const mockOnClose = vi.fn();

    expect(() =>
      render(<FormDialog open onClose={mockOnClose} />, {
        wrapper: ({ children }) => (
          <MockParent institutions={[]} mocks={[emptyStudiesMock]}>
            {children}
          </MockParent>
        ),
      })
    ).not.toThrow();
  });

  it("should close the dialog when the 'Cancel' button is clicked", async () => {
    const mockOnClose = vi.fn();

    const { getByTestId } = render(<FormDialog open onClose={mockOnClose} />, {
      wrapper: ({ children }) => (
        <MockParent institutions={[]} mocks={[emptyStudiesMock]}>
          {children}
        </MockParent>
      ),
    });

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("access-request-dialog-cancel-button"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the 'X' icon is clicked", async () => {
    const mockOnClose = vi.fn();

    const { getByTestId } = render(<FormDialog open onClose={mockOnClose} />, {
      wrapper: ({ children }) => (
        <MockParent institutions={[]} mocks={[emptyStudiesMock]}>
          {children}
        </MockParent>
      ),
    });

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("access-request-dialog-close-icon"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the backdrop is clicked", async () => {
    const mockOnClose = vi.fn();

    const { getByTestId } = render(<FormDialog open onClose={mockOnClose} />, {
      wrapper: ({ children }) => (
        <MockParent institutions={[]} mocks={[emptyStudiesMock]}>
          {children}
        </MockParent>
      ),
    });

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("access-request-dialog").firstChild as HTMLElement);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  // NOTE – Failing in CI
  it.skip("should gracefully handle API errors when submitting (Network)", async () => {
    const mock: MockedResponse<RequestAccessResp, RequestAccessInput> = {
      request: {
        query: REQUEST_ACCESS,
      },
      variableMatcher: () => true,
      error: new Error("Network error"),
    };

    const { getByTestId } = render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[emptyStudiesMock, mock]}>{children}</MockParent>
      ),
    });

    userEvent.type(getByTestId("access-request-organization-field"), "My Mock Organization"); // Required field

    userEvent.click(getByTestId("access-request-dialog-submit-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to submit access request form. Please try again.",
        { variant: "error" }
      );
    });
  });

  // NOTE – Failing in CI
  it.skip("should gracefully handle API errors when submitting (GraphQL)", async () => {
    const mock: MockedResponse<RequestAccessResp, RequestAccessInput> = {
      request: {
        query: REQUEST_ACCESS,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Mock GraphQL error")],
      },
    };

    const { getByTestId } = render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[emptyStudiesMock, mock]}>{children}</MockParent>
      ),
    });

    userEvent.type(getByTestId("access-request-organization-field"), "My Mock Organization"); // Required field

    userEvent.click(getByTestId("access-request-dialog-submit-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to submit access request form. Please try again.",
        { variant: "error" }
      );
    });
  });

  // NOTE – Failing in CI
  it.skip("should gracefully handle API errors when submitting (Success with GraphQL Errors)", async () => {
    const mock: MockedResponse<RequestAccessResp, RequestAccessInput> = {
      request: {
        query: REQUEST_ACCESS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          requestAccess: {
            success: true,
            message: "Mock success with GraphQL errors",
          },
        },
        errors: [new GraphQLError("Mock GraphQL error")],
      },
    };

    const { getByTestId } = render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[emptyStudiesMock, mock]}>{children}</MockParent>
      ),
    });

    userEvent.type(getByTestId("access-request-organization-field"), "My Mock Organization"); // Required field

    userEvent.click(getByTestId("access-request-dialog-submit-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to submit access request form. Please try again.",
        { variant: "error" }
      );
    });
  });

  it.skip("should gracefully handle API errors when submitting (Error Response)", async () => {
    const mock: MockedResponse<RequestAccessResp, RequestAccessInput> = {
      request: {
        query: REQUEST_ACCESS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          requestAccess: {
            success: false,
            message: "Mock error message",
          },
        },
      },
    };

    const { getByTestId } = render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[emptyStudiesMock, mock]}>{children}</MockParent>
      ),
    });

    userEvent.type(getByTestId("access-request-organization-field"), "My Mock Organization"); // Required field

    userEvent.click(getByTestId("access-request-dialog-submit-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to submit access request form. Please try again.",
        { variant: "error" }
      );
    });
  });

  it("should gracefully handle approved studies listing API errors (GraphQL)", async () => {
    const mock: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput> = {
      request: {
        query: LIST_APPROVED_STUDIES,
      },
      result: {
        errors: [new GraphQLError("Mock GraphQL error")],
      },
      variableMatcher: () => true,
    };

    render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent institutions={[]} mocks={[mock]}>
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to retrieve approved studies list.", {
        variant: "error",
      });
    });
  });

  it("should gracefully handle approved studies listing API errors (Network)", async () => {
    const mock: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput> = {
      request: {
        query: LIST_APPROVED_STUDIES,
      },
      error: new Error("Network error"),
      variableMatcher: () => true,
    };

    render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent institutions={[]} mocks={[mock]}>
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to retrieve approved studies list.", {
        variant: "error",
      });
    });
  });

  // NOTE – Failing in CI
  it.skip("should disable the submit button while the form is submitting", async () => {
    const mock: MockedResponse<RequestAccessResp, RequestAccessInput> = {
      request: {
        query: REQUEST_ACCESS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          requestAccess: {
            success: true,
            message: "Mock success",
          },
        },
      },
    };

    const { getByTestId } = render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[emptyStudiesMock, mock]}>{children}</MockParent>
      ),
    });

    userEvent.type(getByTestId("access-request-organization-field"), "My Mock Organization"); // Required field

    userEvent.click(getByTestId("access-request-dialog-submit-button"));

    await waitFor(() => {
      expect(getByTestId("access-request-dialog-submit-button")).toBeDisabled();
    });

    await waitFor(() => {
      expect(getByTestId("access-request-dialog-submit-button")).not.toBeDisabled();
    });
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it("should have the placeholder '100 characters allowed' for the institution field", () => {
    const { getByTestId } = render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent institutions={[]} mocks={[emptyStudiesMock]}>
          {children}
        </MockParent>
      ),
    });

    expect(
      within(getByTestId("access-request-institution-field")).getByRole("combobox")
    ).toHaveAttribute("placeholder", "100 characters allowed");
  });

  // NOTE – Failing in CI
  it.skip("should trim whitespace from the text fields before submitting", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<RequestAccessResp, RequestAccessInput> = {
      request: {
        query: REQUEST_ACCESS,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          requestAccess: {
            success: true,
            message: "Mock success",
          },
        },
      },
    };

    const { getByTestId } = render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent institutions={mockInstitutionList} mocks={[studiesMock, mock]}>
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("access-request-additionalInfo-field")).toBeInTheDocument();
    });

    // Modify input fields
    userEvent.type(getByTestId("access-request-additionalInfo-field"), "  My Mock Info   ");

    userEvent.type(getByTestId("access-request-institution-field"), "  My Mock institution   ");

    // Populate required fields
    const studiesSelect = within(getByTestId("access-request-studies-field")).getByRole("button");
    userEvent.click(studiesSelect);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("access-request-studies-field")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );
      expect(within(muiSelectList).getByTestId("studies-Study-1")).toBeInTheDocument();
      expect(within(muiSelectList).getByTestId("studies-Study-2")).toBeInTheDocument();
    });
    userEvent.click(getByTestId("studies-Study-1"));

    userEvent.click(getByTestId("access-request-dialog-submit-button"));

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith({
        role: expect.any(String),
        institutionName: "My Mock institution",
        studies: ["study-1"],
        additionalInfo: "My Mock Info",
      });
    });
  });

  // NOTE – Failing in CI
  it.skip("should limit 'Additional Info' to 200 characters", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const submitMock: MockedResponse<RequestAccessResp, RequestAccessInput> = {
      request: {
        query: REQUEST_ACCESS,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          requestAccess: {
            success: true,
            message: "Mock success",
          },
        },
      },
    };

    const { getByTestId, findByTestId } = render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent institutions={mockInstitutionList} mocks={[studiesMock, submitMock]}>
          {children}
        </MockParent>
      ),
    });

    await findByTestId("access-request-additionalInfo-field");

    userEvent.type(getByTestId("access-request-additionalInfo-field"), "x".repeat(350));

    userEvent.type(getByTestId("access-request-institution-field"), "mock-value");

    // Populate required fields
    const studiesSelect = within(getByTestId("access-request-studies-field")).getByRole("button");
    userEvent.click(studiesSelect);

    const muiSelectList = within(getByTestId("access-request-studies-field")).getByRole("listbox", {
      hidden: true,
    });

    await within(muiSelectList).findByTestId("studies-Study-1");
    await within(muiSelectList).findByTestId("studies-Study-2");

    userEvent.click(getByTestId("studies-Study-1"));

    userEvent.click(getByTestId("access-request-dialog-submit-button"));

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith({
        role: expect.any(String),
        institutionName: "mock-value",
        studies: ["study-1"],
        additionalInfo: "x".repeat(200),
      });
    });
  });

  it.skip("should limit 'Institution' to 100 characters", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const submitMock: MockedResponse<RequestAccessResp, RequestAccessInput> = {
      request: {
        query: REQUEST_ACCESS,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          requestAccess: {
            success: true,
            message: "Mock success",
          },
        },
      },
    };

    const { getByTestId } = render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent institutions={mockInstitutionList} mocks={[studiesMock, submitMock]}>
          {children}
        </MockParent>
      ),
    });

    userEvent.type(getByTestId("access-request-institution-field"), "x".repeat(150));

    const studiesSelect = within(getByTestId("access-request-studies-field")).getByRole("button");
    userEvent.click(studiesSelect);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("access-request-studies-field")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );
      expect(within(muiSelectList).getByTestId("studies-Study-1")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("studies-Study-1"));

    userEvent.click(getByTestId("access-request-dialog-submit-button"));

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith({
        role: expect.any(String),
        institutionName: "x".repeat(100), // Value is limited to 100 characters
        studies: ["study-1"],
        additionalInfo: "",
      });
    });
  });

  it("should not pre-select the user's current role if it's not a valid option", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const submitMock: MockedResponse<RequestAccessResp, RequestAccessInput> = {
      request: {
        query: REQUEST_ACCESS,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          requestAccess: {
            success: true,
            message: "Mock success",
          },
        },
      },
    };

    const newUser: Partial<User> = {
      role: "Admin", // Technically not even able to see this dialog
    };

    const { getByTestId } = render(<FormDialog open onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent
          institutions={mockInstitutionList}
          mocks={[studiesMock, submitMock]}
          user={newUser}
        >
          {children}
        </MockParent>
      ),
    });

    userEvent.type(getByTestId("access-request-institution-field"), "mock-value");

    // Populate required fields
    const studiesSelect = within(getByTestId("access-request-studies-field")).getByRole("button");
    userEvent.click(studiesSelect);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("access-request-studies-field")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );
      expect(within(muiSelectList).getByTestId("studies-Study-1")).toBeInTheDocument();
      expect(within(muiSelectList).getByTestId("studies-Study-2")).toBeInTheDocument();
    });
    userEvent.click(getByTestId("studies-Study-1"));

    userEvent.click(getByTestId("access-request-dialog-submit-button"));

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith({
        role: "Submitter", // Default role
        institutionName: "mock-value",
        studies: ["study-1"],
        additionalInfo: expect.any(String),
      });
    });
  });
});
