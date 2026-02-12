import React, { FC } from "react";

import { DataCommons } from "../../config/DataCommons";
import { render, waitFor } from "../../test-utils";

import { useDataCommonContext, Status as DCStatus, DataCommonProvider } from "./DataCommonContext";

const TestChild: FC = () => {
  const { status, error } = useDataCommonContext();

  if (status === DCStatus.LOADING) {
    return null;
  }

  return (
    <>
      <div data-testid="status">{status}</div>
      <div data-testid="error-message">{error?.message}</div>
    </>
  );
};

type Props = {
  dc: string;
  children?: React.ReactNode;
};

const TestParent: FC<Props> = ({ dc, children }: Props) => (
  <DataCommonProvider displayName={dc}>{children ?? <TestChild />}</DataCommonProvider>
);

vi.mock("../../utils", async () => ({
  ...(await vi.importActual("../../utils")),
  fetchManifest: async () =>
    new Promise((r) => {
      r({});
    }),
}));

describe("DataCommonContext > useDataCommonContext Tests", () => {
  it("should throw an exception when used outside of a DataCommonProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestChild />)).toThrow(
      "useDataCommonContext cannot be used outside of the DataCommonProvider component"
    );
    vi.spyOn(console, "error").mockRestore();
  });
});

describe("DataCommonContext > DataCommonProvider Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  it("should render without crashing", () => {
    const { container } = render(<TestParent dc="XYZ" />);
    expect(container).toBeInTheDocument();
  });

  it("should set a error state if the DataCommon is not supported", () => {
    const { getByTestId } = render(<TestParent dc="XYZ-this-dc-does-not-exist" />);
    expect(getByTestId("status")).toHaveTextContent(DCStatus.ERROR);
  });

  const invalidDataCommons = ["", null, undefined];
  it.each(invalidDataCommons)("should set a error state if the DataCommon is %p", (dc) => {
    const { getByTestId } = render(<TestParent dc={dc} />);
    expect(getByTestId("status")).toHaveTextContent(DCStatus.ERROR);
    expect(getByTestId("error-message")).toHaveTextContent(
      "The provided Data Common is not supported"
    );
  });

  it("should set a error state if the manifest cannot be fetched", async () => {
    const { getByTestId } = render(<TestParent dc={DataCommons?.[0].displayName} />);
    await waitFor(() => expect(getByTestId("status")).toHaveTextContent(DCStatus.ERROR));
    expect(getByTestId("error-message")).toHaveTextContent(
      `Unable to fetch manifest for ${DataCommons?.[0].name}`
    );
  });
});
