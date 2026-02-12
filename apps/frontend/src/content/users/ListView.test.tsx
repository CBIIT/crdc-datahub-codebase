import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FC, useMemo } from "react";
import { MemoryRouterProps } from "react-router-dom";
import { axe } from "vitest-axe";

import {
  Context as AuthContext,
  ContextState as AuthContextState,
} from "@/components/Contexts/AuthContext";
import {
  SearchParamsProvider,
  useSearchParamsContext,
} from "@/components/Contexts/SearchParamsContext";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { LIST_USERS, ListUsersResp } from "@/graphql";
import { TestRouter, act, render, waitFor } from "@/test-utils";

import ListView from "./ListView";

const listUsersMock: MockedResponse<ListUsersResp> = {
  request: {
    query: LIST_USERS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listUsers: userFactory.build(100, (index) => ({
        _id: `user-${index + 1}`,
        name: `User ${index + 1}`,
        firstName: `First ${index + 1}`,
        lastName: `Last ${index + 1}`,
        email: `user${index + 1}@example.com`,
        role: index === 10 ? "Federal Lead" : "Submitter",
      })),
    },
  },
  maxUsageCount: Infinity,
};

type ParentProps = {
  mocks?: MockedResponse[];
  user?: Partial<User>;
  initialEntries?: MemoryRouterProps["initialEntries"];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  mocks = [listUsersMock],
  user = {},
  initialEntries = ["/"],
  children,
}: ParentProps) => {
  const authCtx: AuthContextState = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        user: userFactory.build({ _id: "user-1", permissions: ["user:manage"], ...user }),
      }),
    [user]
  );

  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      <TestRouter initialEntries={initialEntries}>
        <AuthContext.Provider value={authCtx}>
          <SearchParamsProvider>{children}</SearchParamsProvider>
        </AuthContext.Provider>
      </TestRouter>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should have no violations", async () => {
    const { container, queryByTestId } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    await act(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders without crashing", async () => {
    const { getByTestId } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("list-view-container")).toBeInTheDocument();
    });
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should render all filters", () => {
    const { getByLabelText, getByPlaceholderText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    expect(getByLabelText("User")).toBeInTheDocument();
    expect(getByPlaceholderText("Enter User Name or Email")).toBeInTheDocument();
    expect(getByLabelText("Role")).toBeInTheDocument();
    expect(getByLabelText("Status")).toBeInTheDocument();
  });

  it("should not filter until at least 3 characters are entered", async () => {
    const { getByPlaceholderText, queryByTestId, getByTestId } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    const input = getByPlaceholderText("Enter User Name or Email");
    userEvent.type(input, "Us");

    expect(
      within(getByTestId("generic-table-body")).getAllByTestId("generic-table-row").length
    ).toBeGreaterThan(0);
  });

  it("should filter users by email (case-insensitive, partial)", async () => {
    const { getByPlaceholderText, queryByTestId, getByTestId } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    const input = getByPlaceholderText("Enter User Name or Email");
    userEvent.clear(input);
    userEvent.type(input, "user1@example.com");

    expect(
      within(getByTestId("generic-table-body")).getAllByTestId("generic-table-row").length
    ).toBeGreaterThan(0);
  });

  it("should filter users by firstName (case-insensitive, partial)", async () => {
    const { getByPlaceholderText, queryByTestId, getByTestId } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    const input = getByPlaceholderText("Enter User Name or Email");
    userEvent.clear(input);
    userEvent.type(input, "first 1");

    expect(
      within(getByTestId("generic-table-body")).getAllByTestId("generic-table-row").length
    ).toBeGreaterThan(0);
  });

  it("should filter users by lastName (case-insensitive, partial)", async () => {
    const { getByPlaceholderText, queryByTestId, getByTestId } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    const input = getByPlaceholderText("Enter User Name or Email");
    userEvent.clear(input);
    userEvent.type(input, "Last 1");

    expect(
      within(getByTestId("generic-table-body")).getAllByTestId("generic-table-row").length
    ).toBeGreaterThan(0);
  });

  it('should filter users by "lastName, firstName" format', async () => {
    const { getByPlaceholderText, queryByTestId, getByTestId } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    const input = getByPlaceholderText("Enter User Name or Email");
    userEvent.clear(input);
    userEvent.type(input, "Last 1, First 1");

    expect(
      within(getByTestId("generic-table-body")).getAllByTestId("generic-table-row").length
    ).toBeGreaterThan(0);
  });

  it('should filter users by "firstName lastName" format', async () => {
    const { getByPlaceholderText, queryByTestId, getByTestId } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    const input = getByPlaceholderText("Enter User Name or Email");
    userEvent.clear(input);
    userEvent.type(input, "First 1 Last 1");

    expect(
      within(getByTestId("generic-table-body")).getAllByTestId("generic-table-row").length
    ).toBeGreaterThan(0);
  });

  it('should filter users by "lastName firstName" format', async () => {
    const { getByPlaceholderText, queryByTestId, getByTestId } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    const input = getByPlaceholderText("Enter User Name or Email");
    userEvent.clear(input);
    userEvent.type(input, "Last 1 First 1");

    expect(
      within(getByTestId("generic-table-body")).getAllByTestId("generic-table-row").length
    ).toBeGreaterThan(0);
  });

  it("should show empty state when no users match", async () => {
    const { getByPlaceholderText, findByText, queryByTestId } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    const input = getByPlaceholderText("Enter User Name or Email");
    userEvent.clear(input);
    userEvent.type(input, "notarealuser@example.com");

    expect(await findByText("No users found matching your search criteria.")).toBeInTheDocument();
  });

  it("should update results in real-time as user types", async () => {
    const { getByPlaceholderText, queryByTestId, getByTestId, findByText } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    const input = getByPlaceholderText("Enter User Name or Email");
    userEvent.clear(input);
    userEvent.type(input, "user1@example.com");

    expect(
      within(getByTestId("generic-table-body")).getAllByTestId("generic-table-row").length
    ).toBeGreaterThan(0);

    userEvent.clear(input);
    userEvent.type(input, "notarealuser@example.com");

    expect(await findByText("No users found matching your search criteria.")).toBeInTheDocument();
  });

  it("should combine User filter with Role and Status filters", async () => {
    const { getByPlaceholderText, getByLabelText, getByTestId, queryByTestId } = render(
      <TestParent>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    const input = getByPlaceholderText("Enter User Name or Email");
    const roleSelect = getByLabelText("Role");
    const statusSelect = getByLabelText("Status");

    userEvent.clear(input);
    userEvent.type(input, "user");

    fireEvent.change(roleSelect, { target: { value: "Federal Lead" } });
    fireEvent.change(statusSelect, { target: { value: "Active" } });

    expect(
      within(getByTestId("generic-table-body")).getAllByTestId("generic-table-row").length
    ).toBe(1);
  });

  it("updates search params in the URL correctly when filters are changed", async () => {
    const ShowSearchParams = () => {
      const { searchParams } = useSearchParamsContext();
      return <div data-testid="search-params">{searchParams?.toString()}</div>;
    };

    const { getByPlaceholderText, getByLabelText, getByTestId, queryByTestId } = render(
      <TestParent initialEntries={["/users"]}>
        <ListView />
        <ShowSearchParams />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("list-view-container")).toBeInTheDocument();
      expect(queryByTestId("generic-table-suspense-loader")).not.toBeInTheDocument();
    });

    const input = getByPlaceholderText("Enter User Name or Email");
    const roleSelect = getByLabelText("Role");
    const statusSelect = getByLabelText("Status");
    const searchParamsDiv = getByTestId("search-params");

    // Should not set user param until 3+ chars
    userEvent.clear(input);
    userEvent.type(input, "Us");
    await waitFor(() => {
      expect(searchParamsDiv.textContent).not.toContain("user=");
    });

    // Should set user param when 3+ chars
    userEvent.type(input, "e");
    await waitFor(() => {
      expect(searchParamsDiv.textContent).toContain("user=Use");
    });

    // Should set role param
    fireEvent.change(roleSelect, { target: { value: "Federal Lead" } });
    await waitFor(() => {
      expect(searchParamsDiv.textContent).toContain("role=Federal+Lead");
    });

    // Should set status param
    fireEvent.change(statusSelect, { target: { value: "Active" } });
    await waitFor(() => {
      expect(searchParamsDiv.textContent).toContain("status=Active");
    });

    // Should remove user param when cleared
    userEvent.clear(input);
    userEvent.tab(); // blur
    await waitFor(() => {
      expect(searchParamsDiv.textContent).not.toContain("user=");
    });

    // Should remove role param when set to All
    fireEvent.change(roleSelect, { target: { value: "All" } });
    await waitFor(() => {
      expect(searchParamsDiv.textContent).not.toContain("role=");
    });

    // Should remove status param when set to All
    fireEvent.change(statusSelect, { target: { value: "All" } });
    await waitFor(() => {
      expect(searchParamsDiv.textContent).not.toContain("status=");
    });
  });
});
