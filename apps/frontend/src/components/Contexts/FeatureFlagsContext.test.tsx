import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import React, { FC } from "react";

import { FeatureFlagKey } from "@/config/FeatureFlags";
import { GET_FEATURE_FLAGS, Response as GetFeatureFlagsResp } from "@/graphql/getFeatureFlags";
import { render, waitFor } from "@/test-utils";
import { Logger } from "@/utils/logger";

import { FeatureFlagsProvider, useFeatureFlag, useFeatureFlags } from "./FeatureFlagsContext";

vi.mock("@/utils/logger", () => ({
  Logger: {
    error: vi.fn(),
  },
}));

const allFlagsOnMock: MockedResponse<GetFeatureFlagsResp> = {
  request: { query: GET_FEATURE_FLAGS },
  result: {
    data: {
      getFeatureFlags: { isMaintenanceMode: true, isChatBotEnabled: true, isNetriasEnabled: true },
    },
  },
};

const onlyChatBotOnMock: MockedResponse<GetFeatureFlagsResp> = {
  request: { query: GET_FEATURE_FLAGS },
  result: {
    data: {
      getFeatureFlags: {
        isMaintenanceMode: false,
        isChatBotEnabled: true,
        isNetriasEnabled: false,
      },
    },
  },
};

const noFlagsMock: MockedResponse<GetFeatureFlagsResp> = {
  request: { query: GET_FEATURE_FLAGS },
  result: { data: { getFeatureFlags: null } },
};

const networkErrorMock: MockedResponse<GetFeatureFlagsResp> = {
  request: { query: GET_FEATURE_FLAGS },
  error: new Error("Network error"),
};

const FlagChild: FC<{ flag: FeatureFlagKey }> = ({ flag }) => {
  const isEnabled = useFeatureFlag(flag);

  return <div data-testid="ctx-flag">{String(isEnabled)}</div>;
};

type Props = {
  mocks?: MockedResponse[];
  children?: React.ReactNode;
};

const TestChild: FC = () => {
  const { status, flags } = useFeatureFlags();

  return (
    <>
      <div data-testid="ctx-status">{status}</div>
      <div data-testid="ctx-maintenance-mode">{String(flags.isMaintenanceMode)}</div>
      <div data-testid="ctx-chatbot">{String(flags.isChatBotEnabled)}</div>
      <div data-testid="ctx-netrias">{String(flags.isNetriasEnabled)}</div>
    </>
  );
};

const TestParent: FC<Props> = ({ mocks = [], children }: Props) => (
  <MockedProvider mocks={mocks}>
    <FeatureFlagsProvider>{children ?? <TestChild />}</FeatureFlagsProvider>
  </MockedProvider>
);

describe("useFeatureFlags", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw an exception when used outside of a FeatureFlagsProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestChild />)).toThrow(
      "useFeatureFlags cannot be used outside of the FeatureFlagsProvider component"
    );
  });

  it("should keep every flag off while the flags are loading", () => {
    const { getByTestId } = render(<TestParent mocks={[allFlagsOnMock]} />);

    expect(getByTestId("ctx-status")).toHaveTextContent("LOADING");
    expect(getByTestId("ctx-maintenance-mode")).toHaveTextContent("false");
    expect(getByTestId("ctx-chatbot")).toHaveTextContent("false");
    expect(getByTestId("ctx-netrias")).toHaveTextContent("false");
  });

  it("should use the flags returned by the API", async () => {
    const { getByTestId } = render(<TestParent mocks={[allFlagsOnMock]} />);

    await waitFor(() => expect(getByTestId("ctx-status")).toHaveTextContent("LOADED"));
    expect(getByTestId("ctx-maintenance-mode")).toHaveTextContent("true");
    expect(getByTestId("ctx-chatbot")).toHaveTextContent("true");
    expect(getByTestId("ctx-netrias")).toHaveTextContent("true");
  });

  it("should keep every flag off when the request fails", async () => {
    const { getByTestId } = render(<TestParent mocks={[networkErrorMock]} />);

    await waitFor(() => expect(getByTestId("ctx-status")).toHaveTextContent("ERROR"));
    expect(getByTestId("ctx-maintenance-mode")).toHaveTextContent("false");
    expect(getByTestId("ctx-chatbot")).toHaveTextContent("false");
    expect(getByTestId("ctx-netrias")).toHaveTextContent("false");
  });

  it("should keep every flag off when the API returns no flags", async () => {
    const { getByTestId } = render(<TestParent mocks={[noFlagsMock]} />);

    await waitFor(() => expect(getByTestId("ctx-status")).toHaveTextContent("ERROR"));
    expect(getByTestId("ctx-maintenance-mode")).toHaveTextContent("false");
    expect(getByTestId("ctx-chatbot")).toHaveTextContent("false");
    expect(getByTestId("ctx-netrias")).toHaveTextContent("false");
  });

  it("should log an error when the request fails", async () => {
    const { getByTestId } = render(<TestParent mocks={[networkErrorMock]} />);

    await waitFor(() => expect(getByTestId("ctx-status")).toHaveTextContent("ERROR"));
    expect(Logger.error).toHaveBeenCalledWith(
      "FeatureFlagsProvider: Unable to fetch feature flags. Using defaults.",
      expect.any(Error)
    );
  });
});

describe("useFeatureFlag", () => {
  it("should return the value of the requested flag", async () => {
    const { getByTestId } = render(
      <TestParent mocks={[onlyChatBotOnMock]}>
        <FlagChild flag="isChatBotEnabled" />
      </TestParent>
    );

    await waitFor(() => expect(getByTestId("ctx-flag")).toHaveTextContent("true"));
  });
});
