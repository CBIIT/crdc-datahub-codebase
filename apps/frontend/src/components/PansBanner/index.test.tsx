import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import { FC } from "react";
import { axe } from "vitest-axe";

import { RETRIEVE_OMB_DETAILS, RetrieveOMBDetailsResp } from "../../graphql";
import { render, waitFor } from "../../test-utils";

import PansBanner from "./index";

const mockOMBDetails = {
  _id: "mock-id-123",
  OMBNumber: "1234-5678",
  expirationDate: "06/30/2025",
  OMBInfo: [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore",
    "et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip",
    "ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat",
    "nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  ],
};

const successMock: MockedResponse<RetrieveOMBDetailsResp> = {
  request: {
    query: RETRIEVE_OMB_DETAILS,
  },
  result: {
    data: {
      getOMB: mockOMBDetails,
    },
  },
};

const loadingMock: MockedResponse<RetrieveOMBDetailsResp> = {
  request: {
    query: RETRIEVE_OMB_DETAILS,
  },
  result: {
    data: {
      getOMB: null, // Data never resolves
    },
  },
  delay: Infinity,
};

const errorMock: MockedResponse<RetrieveOMBDetailsResp> = {
  request: {
    query: RETRIEVE_OMB_DETAILS,
  },
  error: new GraphQLError("Failed to fetch OMB details"),
};

type MockParentProps = {
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const MockParent: FC<MockParentProps> = ({ mocks = [], children }) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    {children}
  </MockedProvider>
);

describe("Accessibility", () => {
  it("should have no violations when loaded", async () => {
    const { container, getByTestId } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[successMock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(getByTestId("pans-approval-number")).toBeInTheDocument(); // Wait for data to load
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations during loading", async () => {
    const { container, getByTestId } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[loadingMock]}>{children}</MockParent>,
    });

    expect(getByTestId("pans-banner-skeleton")).toBeInTheDocument(); // Sanity check

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it.each<MockedResponse>([successMock, loadingMock, errorMock])(
    "should render the PANS banner without crashing",
    (mock) => {
      expect(() =>
        render(<PansBanner />, {
          wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
        })
      ).not.toThrow();
    }
  );

  it("should show skeleton components while loading", () => {
    const { getByTestId } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[loadingMock]}>{children}</MockParent>,
    });

    expect(getByTestId("pans-approval-number-skeleton")).toBeInTheDocument();
    expect(getByTestId("pans-expiration-skeleton")).toBeInTheDocument();
    expect(getByTestId("pans-content-skeleton")).toBeInTheDocument();
  });

  it("should hide skeleton components after loading", async () => {
    const { getByTestId, queryByTestId } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[successMock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(getByTestId("pans-banner")).toBeInTheDocument();
    });

    expect(queryByTestId("pans-banner-skeleton")).not.toBeInTheDocument();
  });

  it("should render the OMB data returned by the API", async () => {
    const { getByTestId } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[successMock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(getByTestId("pans-approval-number")).toHaveTextContent("OMB No.: 1234-5678");
      expect(getByTestId("pans-expiration")).toHaveTextContent("Expiration Date: 06/30/2025");
    });

    const contentElement = getByTestId("pans-content");
    expect(contentElement).toHaveTextContent(mockOMBDetails.OMBInfo[0]);
    expect(contentElement).toHaveTextContent(mockOMBDetails.OMBInfo[1]);
  });

  it("should render nothing when an API error occurs (GraphQL)", async () => {
    const mock: MockedResponse<RetrieveOMBDetailsResp> = {
      request: {
        query: RETRIEVE_OMB_DETAILS,
      },
      result: {
        errors: [new GraphQLError("mock-error-here")],
      },
    };

    const { container } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("should render nothing when an API error occurs (Network)", async () => {
    const mock: MockedResponse<RetrieveOMBDetailsResp> = {
      request: {
        query: RETRIEVE_OMB_DETAILS,
      },
      error: new Error("mock-error-here"),
    };

    const { container } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("should render nothing when ombNumber is missing", async () => {
    const missingOmbMock: MockedResponse<RetrieveOMBDetailsResp> = {
      request: {
        query: RETRIEVE_OMB_DETAILS,
      },
      result: {
        data: {
          getOMB: {
            _id: "mock-id-123",
            OMBNumber: "",
            expirationDate: "06/30/2025",
            OMBInfo: ["Lorem ipsum content"],
          },
        },
      },
    };

    const { container } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[missingOmbMock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("should render nothing when expirationDate is missing", async () => {
    const missingExpirationMock: MockedResponse<RetrieveOMBDetailsResp> = {
      request: {
        query: RETRIEVE_OMB_DETAILS,
      },
      result: {
        data: {
          getOMB: {
            _id: "mock-id-123",
            OMBNumber: "1234-5678",
            expirationDate: "",
            OMBInfo: ["Lorem ipsum content"],
          },
        },
      },
    };

    const { container } = render(<PansBanner />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[missingExpirationMock]}>{children}</MockParent>
      ),
    });

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("should render nothing when content is missing", async () => {
    const missingContentMock: MockedResponse<RetrieveOMBDetailsResp> = {
      request: {
        query: RETRIEVE_OMB_DETAILS,
      },
      result: {
        data: {
          getOMB: {
            _id: "mock-id-123",
            OMBNumber: "1234-5678",
            expirationDate: "06/30/2025",
            OMBInfo: [],
          },
        },
      },
    };

    const { container } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[missingContentMock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("should format valid ISO date string correctly", async () => {
    const isoDateMock: MockedResponse<RetrieveOMBDetailsResp> = {
      request: {
        query: RETRIEVE_OMB_DETAILS,
      },
      result: {
        data: {
          getOMB: {
            _id: "mock-id-123",
            OMBNumber: "1234-5678",
            expirationDate: "2025-06-30T00:00:00Z",
            OMBInfo: ["Lorem ipsum content"],
          },
        },
      },
    };

    const { getByTestId } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[isoDateMock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(getByTestId("pans-expiration")).toHaveTextContent("Expiration Date: 06/30/2025");
    });
  });

  it("should not offset the time zone for UTC dates", async () => {
    vi.stubEnv("TZ", "America/New_York"); // Set timezone to EST for testing

    const isoDateMock: MockedResponse<RetrieveOMBDetailsResp> = {
      request: {
        query: RETRIEVE_OMB_DETAILS,
      },
      result: {
        data: {
          getOMB: {
            _id: "mock-id-123",
            OMBNumber: "1234-5678",
            expirationDate: "2025-06-30T00:00:00Z", // Translates to 06/29/2025 in EST
            OMBInfo: ["Lorem ipsum content"],
          },
        },
      },
    };

    const { getByTestId } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[isoDateMock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(getByTestId("pans-expiration")).toHaveTextContent("Expiration Date: 06/30/2025");
    });

    vi.unstubAllEnvs();
  });

  it("should format MM/DD/YYYY date string correctly", async () => {
    const usDateMock: MockedResponse<RetrieveOMBDetailsResp> = {
      request: {
        query: RETRIEVE_OMB_DETAILS,
      },
      result: {
        data: {
          getOMB: {
            _id: "mock-id-123",
            OMBNumber: "1234-5678",
            expirationDate: "12/25/2025",
            OMBInfo: ["Lorem ipsum content"],
          },
        },
      },
    };

    const { getByTestId } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[usDateMock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(getByTestId("pans-expiration")).toHaveTextContent("Expiration Date: 12/25/2025");
    });
  });

  it("should show N/A for invalid date string", async () => {
    const invalidDateMock: MockedResponse<RetrieveOMBDetailsResp> = {
      request: {
        query: RETRIEVE_OMB_DETAILS,
      },
      result: {
        data: {
          getOMB: {
            _id: "mock-id-123",
            OMBNumber: "1234-5678",
            expirationDate: "invalid-date-string",
            OMBInfo: ["Lorem ipsum content"],
          },
        },
      },
    };

    const { getByTestId } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[invalidDateMock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(getByTestId("pans-expiration")).toHaveTextContent("Expiration Date: N/A");
    });
  });
});

describe("Implementation Requirements", () => {
  it("should contain the OMB Approval Number", async () => {
    const { container, getByTestId } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[successMock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(container.textContent).toContain("OMB No.:");
    });

    expect(getByTestId("pans-approval-number")).toHaveTextContent(/1234-5678/);
  });

  it("should contain the Expiration Date", async () => {
    const { container, getByTestId } = render(<PansBanner />, {
      wrapper: ({ children }) => <MockParent mocks={[successMock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(container.textContent).toContain("Expiration Date:");
    });

    expect(getByTestId("pans-expiration")).toHaveTextContent(/06\/30\/2025/);
  });
});
