import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import React, { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import {
  Status as AuthStatus,
  Context as AuthContext,
  ContextState as AuthContextState,
} from "../../components/Contexts/AuthContext";
import { OrganizationProvider } from "../../components/Contexts/OrganizationListContext";
import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import { LIST_ORGS, ListOrgsResp } from "../../graphql";
import { TestRouter, act, render, waitFor } from "../../test-utils";

import ListView from "./ListView";

const mockUsePageTitle = vi.fn();
vi.mock("../../hooks/usePageTitle", async () => ({
  ...(await vi.importActual("../../hooks/usePageTitle")),
  default: (p) => mockUsePageTitle(p),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const mockPrograms: ListOrgsResp["listPrograms"]["programs"] = [
  organizationFactory.build({
    _id: "program-1",
    name: "Biology Research Program",
    abbreviation: "BIO",
    studies: [
      approvedStudyFactory.build({
        _id: "study-1",
        studyName: "Cancer Biology Study",
        studyAbbreviation: "CBS",
      }),
    ],
  }),
  organizationFactory.build({
    _id: "program-2",
    name: "Medical Research Initiative",
    abbreviation: "MRI",
    studies: [
      approvedStudyFactory.build({
        _id: "study-2",
        studyName: "Heart Disease Study",
        studyAbbreviation: "HDS",
      }),
    ],
  }),
  organizationFactory.build({
    _id: "program-3",
    name: "Biomedical Sciences Program",
    abbreviation: "BSP",
    studies: [],
  }),
];

const defaultMocks: MockedResponse[] = [
  {
    request: {
      query: LIST_ORGS,
    },
    variableMatcher: () => true,
    result: {
      data: {
        listPrograms: {
          total: 3,
          programs: mockPrograms,
        },
      },
    },
  },
];

type ParentProps = {
  mocks?: MockedResponse[];
  role?: UserRole | null;
  permissions?: AuthPermissions[];
  initialEntries?: string[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  mocks = defaultMocks,
  role = "Admin",
  permissions = ["program:manage"],
  initialEntries = ["/programs"],
  children,
}: ParentProps) => {
  const baseAuthCtx: AuthContextState = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        status: AuthStatus.LOADED,
        isLoggedIn: role !== null,
        user: userFactory.build({ _id: "current-user", role, permissions }),
      }),
    [role, permissions]
  );

  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      <TestRouter initialEntries={initialEntries}>
        <AuthContext.Provider value={baseAuthCtx}>
          <SearchParamsProvider>
            <OrganizationProvider preload>{children}</OrganizationProvider>
          </SearchParamsProvider>
        </AuthContext.Provider>
      </TestRouter>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container, getByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Manage Programs")).toBeInTheDocument();
    });

    await act(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    const { getByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Manage Programs")).toBeInTheDocument();
    });
  });

  it("sets the page title correctly", () => {
    render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    expect(mockUsePageTitle).toHaveBeenCalledWith("Manage Programs");
  });

  it("renders the Add Program button", async () => {
    const { getByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Add Program")).toBeInTheDocument();
    });
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters programs by name (case-insensitive)", async () => {
    const { getByPlaceholderText, getByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
      expect(getByText("Medical Research Initiative")).toBeInTheDocument();
    });

    const programFilter = getByPlaceholderText("Enter a Program");
    userEvent.type(programFilter, "biology");

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
      expect(() => getByText("Medical Research Initiative")).toThrow();
    });
  });

  it("filters programs by abbreviation (case-insensitive)", async () => {
    const { getByPlaceholderText, getByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
      expect(getByText("Medical Research Initiative")).toBeInTheDocument();
    });

    const programFilter = getByPlaceholderText("Enter a Program");
    userEvent.type(programFilter, "bio");

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
      expect(getByText("Biomedical Sciences Program")).toBeInTheDocument();
      expect(() => getByText("Medical Research Initiative")).toThrow();
    });
  });

  it("filters programs by partial name match", async () => {
    const { getByPlaceholderText, getByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
      expect(getByText("Medical Research Initiative")).toBeInTheDocument();
    });

    const programFilter = getByPlaceholderText("Enter a Program");
    userEvent.type(programFilter, "research");

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
      expect(getByText("Medical Research Initiative")).toBeInTheDocument();
    });
  });

  it("filters programs by partial abbreviation match", async () => {
    const { getByPlaceholderText, getByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Medical Research Initiative")).toBeInTheDocument();
      expect(getByText("Biology Research Program")).toBeInTheDocument();
    });

    const programFilter = getByPlaceholderText("Enter a Program");
    userEvent.type(programFilter, "mri");

    await waitFor(() => {
      expect(getByText("Medical Research Initiative")).toBeInTheDocument();
      expect(() => getByText("Biology Research Program")).toThrow();
    });
  });

  it("shows no results when filter doesn't match any program", async () => {
    const { getByPlaceholderText, getByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
    });

    const programFilter = getByPlaceholderText("Enter a Program");
    userEvent.type(programFilter, "nonexistent");

    await waitFor(() => {
      expect(() => getByText("Biology Research Program")).toThrow();
      expect(() => getByText("Medical Research Initiative")).toThrow();
    });
  });

  it("shows all programs when filter is cleared", async () => {
    const { getByPlaceholderText, getByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
    });

    const programFilter = getByPlaceholderText("Enter a Program");
    userEvent.type(programFilter, "bio");

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
    });

    userEvent.clear(programFilter);

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
      expect(getByText("Medical Research Initiative")).toBeInTheDocument();
    });
  });

  it("handles empty/whitespace-only filter input", async () => {
    const { getByPlaceholderText, getByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
    });

    const programFilter = getByPlaceholderText("Enter a Program");
    userEvent.type(programFilter, "   ");

    await waitFor(() => {
      expect(getByText("Biology Research Program")).toBeInTheDocument();
      expect(getByText("Medical Research Initiative")).toBeInTheDocument();
    });
  });
});
