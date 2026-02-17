import { MockedResponse, MockedProvider } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import { FC } from "react";
import { Route, Routes } from "react-router-dom";

import { IS_MAINTENANCE_MODE, IsMaintenanceModeResponse } from "../../graphql/isMaintenanceMode";
import { TestRouter, render, waitFor } from "../../test-utils";

import MaintenanceGate from "./index";

vi.mock("../../content/status/MaintenancePage", () => ({
  __esModule: true,
  default: () => <p>MOCK-MAINTENANCE-PAGE</p>,
}));

type MockParentProps = {
  mocks?: MockedResponse[];
  initialEntries?: string[];
};

const MockParent: FC<MockParentProps> = ({ mocks, initialEntries = ["/"] }) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <TestRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<MaintenanceGate />}>
          <Route path="/" element={<p>Home Page</p>} />
        </Route>
      </Routes>
    </TestRouter>
  </MockedProvider>
);

const MaintModeOnMock: MockedResponse<IsMaintenanceModeResponse> = {
  request: {
    query: IS_MAINTENANCE_MODE,
  },
  result: {
    data: {
      isMaintenanceMode: true,
    },
  },
};

const MaintModeOffMock: MockedResponse<IsMaintenanceModeResponse> = {
  request: {
    query: IS_MAINTENANCE_MODE,
  },
  result: {
    data: {
      isMaintenanceMode: false,
    },
  },
};

describe("Basic Functionality", () => {
  it("should render without crashing (maintenance mode off)", () => {
    expect(() => render(<MockParent mocks={[MaintModeOffMock]} />)).not.toThrow();
  });

  it("should render without crashing (maintenance mode on)", () => {
    expect(() =>
      render(<MockParent mocks={[MaintModeOnMock]} initialEntries={["/"]} />)
    ).not.toThrow();
  });

  it("should render children when not in maintenance mode", () => {
    const { getByText } = render(<MockParent mocks={[MaintModeOffMock]} initialEntries={["/"]} />);

    expect(getByText("Home Page")).toBeInTheDocument();
  });

  it("should redirect to maintenance page when in maintenance mode", async () => {
    const { getByText } = render(<MockParent mocks={[MaintModeOnMock]} initialEntries={["/"]} />);

    await waitFor(() => {
      expect(getByText("MOCK-MAINTENANCE-PAGE")).toBeInTheDocument();
    });
  });

  it("should handle error when fetching maintenance mode (Network)", () => {
    const errorMock: MockedResponse<IsMaintenanceModeResponse> = {
      request: {
        query: IS_MAINTENANCE_MODE,
      },
      error: new Error("Network error"),
    };

    const { getByText } = render(<MockParent mocks={[errorMock]} initialEntries={["/"]} />);

    // Assume maintenance is DISABLED
    expect(getByText("Home Page")).toBeInTheDocument();
  });

  it("should handle error when fetching maintenance mode (GraphQL)", () => {
    const errorMock: MockedResponse<IsMaintenanceModeResponse> = {
      request: {
        query: IS_MAINTENANCE_MODE,
      },
      result: {
        errors: [new GraphQLError("mock error")],
      },
    };

    const { getByText } = render(<MockParent mocks={[errorMock]} initialEntries={["/"]} />);

    // Assume maintenance is DISABLED
    expect(getByText("Home Page")).toBeInTheDocument();
  });

  it("should handle error when fetching maintenance mode (API)", () => {
    const errorMock: MockedResponse<IsMaintenanceModeResponse> = {
      request: {
        query: IS_MAINTENANCE_MODE,
      },
      result: {
        data: {
          isMaintenanceMode: null,
        },
      },
    };

    const { getByText } = render(<MockParent mocks={[errorMock]} initialEntries={["/"]} />);

    // Assume maintenance is DISABLED
    expect(getByText("Home Page")).toBeInTheDocument();
  });
});
