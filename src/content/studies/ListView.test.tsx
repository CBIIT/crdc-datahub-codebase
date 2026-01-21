import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import React, { FC } from "react";
import { MemoryRouterProps } from "react-router-dom";
import { axe } from "vitest-axe";

import { OrganizationProvider } from "@/components/Contexts/OrganizationListContext";
import { SearchParamsProvider } from "@/components/Contexts/SearchParamsContext";
import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import {
  LIST_APPROVED_STUDIES,
  ListApprovedStudiesResp,
  ListApprovedStudiesInput,
  ListOrgsInput,
  ListOrgsResp,
  LIST_ORGS,
} from "@/graphql";
import { TestRouter, act, render, waitFor } from "@/test-utils";

import ListView from "./ListView";

const programMocks: MockedResponse<ListOrgsResp, ListOrgsInput>[] = [
  {
    request: {
      query: LIST_ORGS,
    },
    variableMatcher: () => true,
    result: {
      data: {
        listPrograms: {
          total: 5,
          programs: organizationFactory.build(5, (index) => ({
            id: `Program-${index + 1}`,
            name: `Test Program ${index + 1}`,
          })),
        },
      },
    },
  },
];

type ParentProps = {
  mocks?: MockedResponse[];
  initialEntries?: MemoryRouterProps["initialEntries"];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  mocks = [],
  initialEntries = ["/"],
  children,
}: ParentProps) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <TestRouter initialEntries={initialEntries}>
      <OrganizationProvider preload>
        <SearchParamsProvider>{children}</SearchParamsProvider>
      </OrganizationProvider>
    </TestRouter>
  </MockedProvider>
);

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should have no accessibility violations", async () => {
    const studies = [approvedStudyFactory.build({ studyAbbreviation: "ABC" })];
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
            studies,
            total: 1,
          },
        },
      },
    };

    const { container, getByText } = render(
      <TestParent mocks={[listApprovedStudiesMock, ...programMocks]}>
        <ListView />
      </TestParent>
    );
    await waitFor(() => {
      expect(getByText("ABC")).toBeInTheDocument();
    });

    await act(async () => {
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});

describe("Basic Functionality", () => {
  it("should not crash when no studies are returned", async () => {
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
            studies: [],
            total: 0,
          },
        },
      },
    };

    const { container } = render(
      <TestParent mocks={[listApprovedStudiesMock, ...programMocks]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });
  it("should not crash when studies are returned", async () => {
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
            studies: approvedStudyFactory.build(10),
            total: 10,
          },
        },
      },
    };

    const { container } = render(
      <TestParent mocks={[listApprovedStudiesMock, ...programMocks]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should render asterisk and correct tooltip for pending dbGaPID condition", async () => {
    const studies = [
      approvedStudyFactory.build({
        studyAbbreviation: "ABC",
        controlledAccess: true,
        dbGaPID: "",
        pendingModelChange: false,
      }),
    ];
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
            studies,
            total: 1,
          },
        },
      },
    };

    const { getByText, getByTestId, findByText } = render(
      <TestParent mocks={[listApprovedStudiesMock, ...programMocks]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("ABC")).toBeInTheDocument();
    });

    const asterisk = getByTestId("asterisk-ABC");
    expect(asterisk).toBeInTheDocument();

    userEvent.hover(asterisk);

    const dbGaPIDTooltip = await findByText("Data submission is Pending on dbGaPID Registration.");
    expect(dbGaPIDTooltip).toBeInTheDocument();
  });

  it("should render asterisk and correct tooltip for pending model change condition", async () => {
    const studies = [
      approvedStudyFactory.build({
        studyAbbreviation: "XYZ",
        controlledAccess: false,
        dbGaPID: "phs123456",
        pendingModelChange: true,
      }),
    ];
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
            studies,
            total: 1,
          },
        },
      },
    };

    const { getByText, getByTestId, findByText } = render(
      <TestParent mocks={[listApprovedStudiesMock, ...programMocks]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("XYZ")).toBeInTheDocument();
    });

    const asterisk = getByTestId("asterisk-XYZ");
    expect(asterisk).toBeInTheDocument();

    userEvent.hover(asterisk);

    const modelReviewTooltip = await findByText("Data submission is Pending on Data Model Update.");
    expect(modelReviewTooltip).toBeInTheDocument();
  });

  it("should render asterisk and correct tooltip for pending GPA condition", async () => {
    const studies = [
      approvedStudyFactory.build({
        studyAbbreviation: "ABC",
        controlledAccess: true,
        dbGaPID: "phs-001",
        pendingModelChange: false,
        GPAName: "",
        isPendingGPA: true,
      }),
    ];
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
            studies,
            total: 1,
          },
        },
      },
    };

    const { getByText, getByTestId, findByText } = render(
      <TestParent mocks={[listApprovedStudiesMock, ...programMocks]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("ABC")).toBeInTheDocument();
    });

    const asterisk = getByTestId("asterisk-ABC");
    expect(asterisk).toBeInTheDocument();

    userEvent.hover(asterisk);

    const gpaTooltip = await findByText("Data submission is Pending on GPA info.");
    expect(gpaTooltip).toBeInTheDocument();
  });

  it("should render asterisk and all tooltips when all pending conditions are true", async () => {
    const studies = [
      approvedStudyFactory.build({
        studyAbbreviation: "ALL",
        controlledAccess: true,
        dbGaPID: "",
        pendingModelChange: true,
        GPAName: "",
        isPendingGPA: true,
      }),
    ];
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
            studies,
            total: 1,
          },
        },
      },
    };

    const { getByText, getByTestId, findByText } = render(
      <TestParent mocks={[listApprovedStudiesMock, ...programMocks]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("ALL")).toBeInTheDocument();
    });

    const asterisk = getByTestId("asterisk-ALL");
    expect(asterisk).toBeInTheDocument();

    userEvent.hover(asterisk);

    const dbGaPIDTooltip = await findByText("Data submission is Pending on dbGaPID Registration.");
    const modelReviewTooltip = await findByText("Data submission is Pending on Data Model Update.");
    const gpaTooltip = await findByText("Data submission is Pending on GPA info.");

    expect(dbGaPIDTooltip).toBeInTheDocument();
    expect(modelReviewTooltip).toBeInTheDocument();
    expect(gpaTooltip).toBeInTheDocument();
  });

  it("should not render asterisk when there are no pending conditions", async () => {
    const studies = [
      approvedStudyFactory.build({
        studyAbbreviation: "NONE",
        controlledAccess: false,
        dbGaPID: "phs123456",
        pendingModelChange: false,
      }),
    ];
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
            studies,
            total: 1,
          },
        },
      },
    };

    const { getByText, queryByTestId } = render(
      <TestParent mocks={[listApprovedStudiesMock, ...programMocks]}>
        <ListView />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("NONE")).toBeInTheDocument();
    });

    const asterisk = queryByTestId("asterisk-NONE");
    expect(asterisk).not.toBeInTheDocument();
  });
});
