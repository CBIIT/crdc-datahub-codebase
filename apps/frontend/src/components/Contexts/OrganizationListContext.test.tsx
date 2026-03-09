import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import React, { FC } from "react";

import { organizationFactory } from "@/factories/auth/OrganizationFactory";

import { LIST_ORGS, ListOrgsInput, ListOrgsResp } from "../../graphql";
import { render, waitFor } from "../../test-utils";

import {
  OrganizationProvider,
  Status as OrgStatus,
  useOrganizationListContext,
} from "./OrganizationListContext";

type Props = {
  mocks?: MockedResponse[];
  preload?: boolean;
  children?: React.ReactNode;
};

const TestChild: FC = () => {
  const { status, data, activeOrganizations } = useOrganizationListContext();

  if (status === OrgStatus.LOADING) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div data-testid="status">{status}</div>
      <ul data-testid="organization-list">
        {data?.map((org, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={`organization-${index}`} data-testid={`organization-${index}`}>
            {org.name}
          </li>
        ))}
      </ul>
      <ul data-testid="active-organization-list">
        {activeOrganizations?.map((org, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={`active-organization-${index}`} data-testid={`active-organization-${index}`}>
            {org.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

const TestParent: FC<Props> = ({ mocks, preload = true, children }: Props) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <OrganizationProvider preload={preload}>{children ?? <TestChild />}</OrganizationProvider>
  </MockedProvider>
);

describe("OrganizationListContext > useOrganizationListContext Tests", () => {
  it("should throw an exception when used outside of the OrganizationProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestChild />)).toThrow(
      "OrganizationListContext cannot be used outside of the OrganizationProvider component"
    );
    vi.spyOn(console, "error").mockRestore();
  });
});

describe("OrganizationListContext > OrganizationProvider Tests", () => {
  const emptyMocks: MockedResponse<ListOrgsResp, ListOrgsInput>[] = [
    {
      request: {
        query: LIST_ORGS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listPrograms: {
            total: 0,
            programs: [],
          },
        },
      },
    },
  ];

  it("should render without crashing", () => {
    expect(() => render(<TestParent mocks={emptyMocks} />)).not.toThrow();
  });

  it("should handle loading state correctly", async () => {
    const { getByText } = render(<TestParent mocks={emptyMocks} />);
    expect(getByText("Loading...")).toBeInTheDocument();
  });

  it("should load and display organization data", async () => {
    const orgData = [
      organizationFactory.build({ name: "Org One", status: "Active" }),
      organizationFactory.build({ name: "Org Two", status: "Active" }),
    ];

    const mocks: MockedResponse<ListOrgsResp, ListOrgsInput>[] = [
      {
        request: {
          query: LIST_ORGS,
        },
        variableMatcher: () => true,
        result: {
          data: {
            listPrograms: {
              total: orgData.length,
              programs: orgData as ListOrgsResp["listPrograms"]["programs"],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    await waitFor(() => {
      expect(getByTestId("status").textContent).toEqual(OrgStatus.LOADED);
      expect(getByTestId("organization-0").textContent).toEqual("Org One");
      expect(getByTestId("organization-1").textContent).toEqual("Org Two");
    });
  });

  it("should handle errors when failing to load organizations", async () => {
    const mocks: MockedResponse<ListOrgsResp, ListOrgsInput>[] = [
      {
        request: {
          query: LIST_ORGS,
        },
        variableMatcher: () => true,
        result: {
          errors: [new GraphQLError("Failed to fetch")],
        },
      },
    ];

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    await waitFor(() => {
      expect(getByTestId("status").textContent).toEqual(OrgStatus.ERROR);
    });
  });

  it("should only show active organizations in the activeOrganizations list", async () => {
    const orgData = [
      organizationFactory.build({ name: "Active Org", status: "Active" }),
      organizationFactory.build({ name: "Inactive Org", status: "Inactive" }),
    ];

    const mocks: MockedResponse<ListOrgsResp, ListOrgsInput>[] = [
      {
        request: {
          query: LIST_ORGS,
        },
        variableMatcher: () => true,
        result: {
          data: {
            listPrograms: {
              total: orgData.length,
              programs: orgData as ListOrgsResp["listPrograms"]["programs"],
            },
          },
        },
      },
    ];

    const FilteredTestParent: FC = () => (
      <MockedProvider mocks={mocks} addTypename={false}>
        <OrganizationProvider preload>
          <TestChild />
        </OrganizationProvider>
      </MockedProvider>
    );

    const { getByTestId } = render(<FilteredTestParent />);

    await waitFor(() => {
      expect(getByTestId("organization-list").textContent).toContain("Active Org");
      expect(getByTestId("organization-list").textContent).toContain("Inactive Org");
      expect(getByTestId("active-organization-list").textContent).not.toContain("Inactive Org");
    });
  });

  it("should not execute query when preload is false", async () => {
    const { queryByText } = render(
      <TestParent mocks={[]} preload={false}>
        <TestChild />
      </TestParent>
    );

    await waitFor(() => {
      expect(queryByText("Loading...")).not.toBeInTheDocument();
    });
  });

  it("should correctly update all consumers when state changes", async () => {
    const orgData = [organizationFactory.build({ name: "Org Multi", status: "Active" })];

    const mocks: MockedResponse<ListOrgsResp, ListOrgsInput>[] = [
      {
        request: { query: LIST_ORGS },
        variableMatcher: () => true,
        result: {
          data: {
            listPrograms: {
              total: orgData.length,
              programs: orgData as ListOrgsResp["listPrograms"]["programs"],
            },
          },
        },
      },
    ];

    const DoubleConsumer: FC = () => (
      <MockedProvider mocks={mocks} addTypename={false}>
        <OrganizationProvider preload>
          <TestChild />
          <TestChild />
        </OrganizationProvider>
      </MockedProvider>
    );

    const { getAllByTestId } = render(<DoubleConsumer />);

    await waitFor(() => {
      const statuses = getAllByTestId("status");
      expect(statuses[0].textContent).toEqual(OrgStatus.LOADED);
      expect(statuses[1].textContent).toEqual(OrgStatus.LOADED);
    });
  });

  it("should handle partial data without crashing", async () => {
    const partialDataMocks: MockedResponse<ListOrgsResp, ListOrgsInput>[] = [
      {
        request: { query: LIST_ORGS },
        variableMatcher: () => true,

        result: {
          data: {
            listPrograms: {
              total: 1,
              programs: [{ name: "Org Partial" }] as ListOrgsResp["listPrograms"]["programs"], // Missing "status"
            },
          },
        },
      },
    ];

    const { getByTestId } = render(<TestParent mocks={partialDataMocks} />);

    await waitFor(() => {
      expect(getByTestId("status").textContent).toEqual(OrgStatus.LOADED);
      expect(getByTestId("organization-0").textContent).toEqual("Org Partial");
    });
  });
});
