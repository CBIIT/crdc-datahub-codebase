import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { FC, useMemo } from "react";
import { MemoryRouter, MemoryRouterProps } from "react-router-dom";
import { axe } from "vitest-axe";

import { SearchParamsProvider } from "@/components/Contexts/SearchParamsContext";
import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";
import {
  GET_TOOLTIPS,
  GET_USER,
  GetTooltipsInput,
  GetTooltipsResp,
  GetUserInput,
  GetUserResp,
  LIST_APPROVED_STUDIES,
  LIST_INSTITUTIONS,
  ListApprovedStudiesInput,
  ListApprovedStudiesResp,
  ListInstitutionsInput,
  ListInstitutionsResp,
  RETRIEVE_PBAC_DEFAULTS,
  RetrievePBACDefaultsInput,
  RetrievePBACDefaultsResp,
} from "@/graphql";
import { act, render, waitFor } from "@/test-utils";

import {
  Context as AuthContext,
  ContextState as AuthContextState,
} from "../../components/Contexts/AuthContext";

import ProfileView from "./ProfileView";

const getUserMock: MockedResponse<GetUserResp, GetUserInput> = {
  request: {
    query: GET_USER,
  },
  variableMatcher: () => true,
  result: {
    data: {
      getUser: userFactory.build({
        role: "Submitter",
        studies: approvedStudyFactory.pick(["_id", "studyName", "studyAbbreviation"]).build(2),
        institution: institutionFactory.build(),
      }) as GetUserResp["getUser"],
    },
  },
  maxUsageCount: Infinity,
};

const listApprovedStudiesMock: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput> = {
  request: {
    query: LIST_APPROVED_STUDIES,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listApprovedStudies: {
        total: 2,
        studies: approvedStudyFactory.build(2),
      },
    },
  },
  maxUsageCount: Infinity,
};

const listInstitutionsMock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
  request: {
    query: LIST_INSTITUTIONS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listInstitutions: {
        total: 3,
        institutions: [
          institutionFactory.build({ name: "Alpha Cancer Center" }),
          institutionFactory.build({ name: "Beta Oncology Institute" }),
          institutionFactory.build({ name: "Gamma Research Hospital" }),
        ],
      },
    },
  },
  maxUsageCount: Infinity,
};

const retrievePBACDefaults: MockedResponse<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput> = {
  request: {
    query: RETRIEVE_PBAC_DEFAULTS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      retrievePBACDefaults: [],
    },
  },
  maxUsageCount: Infinity,
};

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

type ParentProps = {
  mocks?: MockedResponse[];
  user?: Partial<User>;
  initialEntries?: MemoryRouterProps["initialEntries"];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  mocks = [
    getUserMock,
    listApprovedStudiesMock,
    listInstitutionsMock,
    retrievePBACDefaults,
    getTooltipsMock,
  ],
  user = {},
  initialEntries = ["/"],
  children,
}: ParentProps) => {
  const authCtx: AuthContextState = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        user: userFactory.build({
          permissions: ["access:request", "user:manage"],
          role: "Submitter",
          ...user,
        }),
      }),
    [user]
  );

  return (
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthContext.Provider value={authCtx}>
          <SearchParamsProvider>{children}</SearchParamsProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    </MockedProvider>
  );
};

describe("Accessibility", async () => {
  it("should have no accessibility violations (users)", async () => {
    const { container } = render(
      <TestParent>
        <ProfileView _id="test-id" viewType="users" />
      </TestParent>
    );

    await act(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  it.todo("should have no accessibility violations (profile)");
});

describe("Basic Functionality", () => {
  it("should not crash when rendered", () => {
    const { container } = render(
      <TestParent>
        <ProfileView _id="test-id" viewType="users" />
      </TestParent>
    );

    expect(container).toBeInTheDocument();
  });
});

describe("Implementation Requirements", () => {
  it("should render the institution autocomplete input", async () => {
    const { findByLabelText } = render(
      <TestParent>
        <ProfileView _id="test-id" viewType="users" />
      </TestParent>
    );

    const input = await findByLabelText(/Institution/i);
    expect(input).toBeInTheDocument();
  });

  it("should show institution suggestions as user types (dynamic filtering)", async () => {
    const { findByLabelText, findByText, queryByText } = render(
      <TestParent
        mocks={[getUserMock, listInstitutionsMock, listApprovedStudiesMock, retrievePBACDefaults]}
      >
        <ProfileView _id="test-id" viewType="users" />
      </TestParent>
    );

    const input = await findByLabelText(/Institution/i);
    userEvent.click(input);
    userEvent.clear(input);
    userEvent.type(input, "Beta");

    await waitFor(async () => {
      expect(await findByText("Beta Oncology Institute")).toBeInTheDocument();
      expect(queryByText("Alpha Cancer Center")).not.toBeInTheDocument();
      expect(queryByText("Gamma Research Hospital")).not.toBeInTheDocument();
    });
  });

  it("should allow selecting an institution from the full list if no search input is provided", async () => {
    const { findByLabelText, findByText } = render(
      <TestParent
        mocks={[getUserMock, listInstitutionsMock, listApprovedStudiesMock, retrievePBACDefaults]}
      >
        <ProfileView _id="test-id" viewType="users" />
      </TestParent>
    );

    const input = await findByLabelText(/Institution/i);
    userEvent.click(input);
    userEvent.clear(input);
    userEvent.type(input, "a");
    userEvent.clear(input);

    await waitFor(async () => {
      expect(await findByText("Alpha Cancer Center")).toBeInTheDocument();
      expect(await findByText("Beta Oncology Institute")).toBeInTheDocument();
    });
  });
});
