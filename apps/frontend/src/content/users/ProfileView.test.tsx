import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { FC, useMemo } from "react";
import { MemoryRouterProps } from "react-router-dom";
import { axe } from "vitest-axe";

import { DataModelsContext } from "@/components/Contexts/DataModelsContext";
import { SearchParamsProvider } from "@/components/Contexts/SearchParamsContext";
import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { dataCommonFactory } from "@/factories/data-common/DataCommonFactory";
import { dataModelsCtxStateFactory } from "@/factories/data-common/DataModelsCtxStateFactory";
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
  USER_IS_PRIMARY_CONTACT,
  UserIsPrimaryContactInput,
  UserIsPrimaryContactResp,
} from "@/graphql";
import { TestRouter, act, render, waitFor, within } from "@/test-utils";

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

const mockDataModels: DataCommon[] = [
  dataCommonFactory.build({ name: "CDS", displayName: "GC" }),
  dataCommonFactory.build({ name: "ICDC", displayName: "ICDC" }),
  dataCommonFactory.build({ name: "CCDI", displayName: "Hidden CCDI", isHidden: true }),
];

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
      <TestRouter initialEntries={initialEntries}>
        <AuthContext.Provider value={authCtx}>
          <DataModelsContext.Provider
            value={dataModelsCtxStateFactory.build({ models: mockDataModels })}
          >
            <SearchParamsProvider>{children}</SearchParamsProvider>
          </DataModelsContext.Provider>
        </AuthContext.Provider>
      </TestRouter>
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
        mocks={[
          getUserMock,
          listInstitutionsMock,
          listApprovedStudiesMock,
          retrievePBACDefaults,
          getTooltipsMock,
        ]}
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
        mocks={[
          getUserMock,
          listInstitutionsMock,
          listApprovedStudiesMock,
          retrievePBACDefaults,
          getTooltipsMock,
        ]}
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

  it("should only display active institutions", async () => {
    const activeInstitutionsMock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
      request: {
        query: LIST_INSTITUTIONS,
      },
      variableMatcher: (variables) => variables.status === "Active",
      result: {
        data: {
          listInstitutions: {
            total: 2,
            institutions: [
              institutionFactory.build({ name: "Active Institute A", status: "Active" }),
              institutionFactory.build({ name: "Active Institute B", status: "Active" }),
            ],
          },
        },
      },
      maxUsageCount: Infinity,
    };

    const { findByLabelText, findAllByRole } = render(
      <TestParent
        mocks={[
          getUserMock,
          activeInstitutionsMock,
          listApprovedStudiesMock,
          retrievePBACDefaults,
          getTooltipsMock,
        ]}
      >
        <ProfileView _id="test-id" viewType="users" />
      </TestParent>
    );

    const input = await findByLabelText(/Institution/i);
    userEvent.click(input);
    userEvent.clear(input);
    userEvent.type(input, "a");
    userEvent.clear(input);

    const options = await findAllByRole("option");
    expect(options).toHaveLength(2);
  });

  it("should only fetch active approved studies", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const activeStudiesMock: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput> = {
      request: {
        query: LIST_APPROVED_STUDIES,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          listApprovedStudies: {
            total: 0,
            studies: [],
          },
        },
      },
    };

    render(
      <TestParent
        mocks={[
          getUserMock,
          activeStudiesMock,
          listInstitutionsMock,
          retrievePBACDefaults,
          getTooltipsMock,
        ]}
      >
        <ProfileView _id="test-id" viewType="users" />
      </TestParent>
    );

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith(expect.objectContaining({ statuses: ["Active"] }));
    });
  });

  it("should display the selected Data Commons by display name, excluding hidden Data Models", async () => {
    const dcpUserMock: MockedResponse<GetUserResp, GetUserInput> = {
      ...getUserMock,
      result: {
        data: {
          getUser: userFactory.build({
            role: "Data Commons Personnel",
            dataCommons: ["CDS", "ICDC", "CCDI"],
            studies: [],
            institution: null,
          }) as GetUserResp["getUser"],
        },
      },
    };

    const isPrimaryContactMock: MockedResponse<
      UserIsPrimaryContactResp,
      UserIsPrimaryContactInput
    > = {
      request: {
        query: USER_IS_PRIMARY_CONTACT,
      },
      variableMatcher: () => true,
      result: {
        data: {
          userIsPrimaryContact: false,
        },
      },
      maxUsageCount: Infinity,
    };

    const { container } = render(
      <TestParent
        mocks={[
          dcpUserMock,
          isPrimaryContactMock,
          listApprovedStudiesMock,
          listInstitutionsMock,
          retrievePBACDefaults,
          getTooltipsMock,
        ]}
      >
        <ProfileView _id="test-id" viewType="users" />
      </TestParent>
    );

    const field = await waitFor(() => {
      const label = container.querySelector("#userDataCommons");
      expect(label).toBeInTheDocument();
      return label.parentElement;
    });
    const select = await within(field).findByRole("button");

    await waitFor(() => expect(select).toHaveTextContent("GC, ICDC"));
    expect(select).not.toHaveTextContent("Hidden CCDI");
  });
});
