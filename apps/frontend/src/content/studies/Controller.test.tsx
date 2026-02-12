import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import React, { FC, useMemo } from "react";
import { Routes, Route } from "react-router-dom";

import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import {
  Context as AuthContext,
  ContextState as AuthContextState,
  Status as AuthContextStatus,
} from "../../components/Contexts/AuthContext";
import { OrganizationProvider } from "../../components/Contexts/OrganizationListContext";
import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import {
  GET_APPROVED_STUDY,
  GetApprovedStudyInput,
  GetApprovedStudyResp,
  LIST_ACTIVE_DCPS,
  LIST_APPROVED_STUDIES,
  LIST_ORGS,
  ListActiveDCPsResp,
  ListApprovedStudiesInput,
  ListApprovedStudiesResp,
  ListOrgsInput,
  ListOrgsResp,
} from "../../graphql";
import { TestRouter, render, waitFor } from "../../test-utils";

import StudiesController from "./Controller";

const listActiveDCPsMock: MockedResponse<ListActiveDCPsResp> = {
  request: {
    query: LIST_ACTIVE_DCPS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listActiveDCPs: [
        {
          userID: "dcp-1",
          firstName: "John",
          lastName: "Doe",
          createdAt: "",
          updateAt: "",
        },
        {
          userID: "dcp-2",
          firstName: "James",
          lastName: "Smith",
          createdAt: "",
          updateAt: "",
        },
      ],
    },
  },
};

const listOrgMocks: MockedResponse<ListOrgsResp, ListOrgsInput>[] = [
  {
    request: {
      query: LIST_ORGS,
    },
    variableMatcher: () => true,
    result: {
      data: {
        listPrograms: {
          total: 1,
          programs: organizationFactory.build(1),
        },
      },
    },
    maxUsageCount: Infinity,
  },
];

type ParentProps = {
  role: UserRole;
  permissions?: AuthPermissions[];
  initialEntry?: string;
  mocks?: MockedResponse[];
  ctxStatus?: AuthContextStatus;
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  role,
  permissions = ["study:manage"],
  initialEntry = "/studies",
  mocks = [],
  ctxStatus = AuthContextStatus.LOADED,
  children,
}: ParentProps) => {
  const baseAuthCtx: AuthContextState = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        status: ctxStatus,
        isLoggedIn: role !== null,
        user: userFactory.build({ _id: "current-user", role, permissions }),
      }),
    [role, ctxStatus]
  );

  return (
    <MockedProvider mocks={[...listOrgMocks, ...mocks]} showWarnings>
      <TestRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/studies/:studyId?"
            element={
              <AuthContext.Provider value={baseAuthCtx}>
                <OrganizationProvider preload>
                  <SearchParamsProvider>{children}</SearchParamsProvider>
                </OrganizationProvider>
              </AuthContext.Provider>
            }
          />
          <Route path="/" element={<div>Root Page</div>} />
        </Routes>
      </TestRouter>
    </MockedProvider>
  );
};

describe("StudiesController", () => {
  it("should render the page without crashing", async () => {
    const listApprovedStudiesMock: MockedResponse<
      ListApprovedStudiesResp,
      ListApprovedStudiesInput
    > = {
      request: {
        query: LIST_APPROVED_STUDIES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listApprovedStudies: {
            total: 1,
            studies: approvedStudyFactory.build(1),
          },
        },
      },
    };

    const { getByTestId } = render(
      <TestParent
        role="Admin"
        ctxStatus={AuthContextStatus.LOADED}
        mocks={[listActiveDCPsMock, listApprovedStudiesMock]}
      >
        <StudiesController />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("list-studies-container")).toBeInTheDocument();
    });
  });

  it("should show a loading spinner when the AuthCtx is loading", async () => {
    const { getByTestId } = render(
      <TestParent role="Admin" ctxStatus={AuthContextStatus.LOADING}>
        <StudiesController />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("studies-suspense-loader")).toBeInTheDocument();
    });
  });

  it("should redirect the user missing the required permissions to the home page", async () => {
    const { getByText } = render(
      <TestParent role="Admin" permissions={[]}>
        <StudiesController />
      </TestParent>
    );

    expect(getByText("Root Page")).toBeInTheDocument();
  });

  it("should render the StudyView when a studyId param is provided", async () => {
    const studyId = "study-id-1";

    const getApprovedStudyMock: MockedResponse<GetApprovedStudyResp, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: approvedStudyFactory.build({
            _id: studyId,
            studyName: "Study Name 1",
            studyAbbreviation: "SN1",
          }),
        },
      },
    };

    const { getByTestId } = render(
      <TestParent
        role="Admin"
        ctxStatus={AuthContextStatus.LOADED}
        mocks={[listActiveDCPsMock, getApprovedStudyMock]}
        initialEntry={`/studies/${studyId}`}
      >
        <StudiesController />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("study-view-container")).toBeInTheDocument();
    });
  });
});
