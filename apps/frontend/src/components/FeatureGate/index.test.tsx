import React, { FC, useMemo } from "react";

import {
  FeatureFlagsContext,
  FeatureFlagsCtxState,
} from "@/components/Contexts/FeatureFlagsContext";
import { DEFAULT_FEATURE_FLAGS, FeatureFlags } from "@/config/FeatureFlags";
import { render } from "@/test-utils";

import FeatureGate from "./index";

type Props = {
  flags?: Partial<FeatureFlags>;
  children: React.ReactNode;
};

const TestParent: FC<Props> = ({ flags = {}, children }: Props) => {
  const value = useMemo<FeatureFlagsCtxState>(
    () => ({ status: "LOADED", flags: { ...DEFAULT_FEATURE_FLAGS, ...flags } }),
    [flags]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};

describe("Basic Functionality", () => {
  it("should render its children when the flag is on", () => {
    const { getByText } = render(
      <TestParent flags={{ isChatBotEnabled: true }}>
        <FeatureGate flag="isChatBotEnabled">
          <p>ChatBot</p>
        </FeatureGate>
      </TestParent>
    );

    expect(getByText("ChatBot")).toBeInTheDocument();
  });

  it("should render nothing when the flag is off", () => {
    const { queryByText } = render(
      <TestParent flags={{ isChatBotEnabled: false }}>
        <FeatureGate flag="isChatBotEnabled">
          <p>ChatBot</p>
        </FeatureGate>
      </TestParent>
    );

    expect(queryByText("ChatBot")).not.toBeInTheDocument();
  });
});

describe("Implementation Requirements", () => {
  it("should only check the flag it is given", () => {
    const { queryByText } = render(
      <TestParent flags={{ isChatBotEnabled: false, isNetriasEnabled: true }}>
        <FeatureGate flag="isChatBotEnabled">
          <p>ChatBot</p>
        </FeatureGate>
      </TestParent>
    );

    expect(queryByText("ChatBot")).not.toBeInTheDocument();
  });

  it("should render the fallback instead when the flag is off", () => {
    const { getByText, queryByText } = render(
      <TestParent flags={{ isChatBotEnabled: false }}>
        <FeatureGate flag="isChatBotEnabled" fallback={<p>ChatBot is unavailable</p>}>
          <p>ChatBot</p>
        </FeatureGate>
      </TestParent>
    );

    expect(getByText("ChatBot is unavailable")).toBeInTheDocument();
    expect(queryByText("ChatBot")).not.toBeInTheDocument();
  });
});
