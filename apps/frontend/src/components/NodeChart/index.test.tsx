import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { pieSectorDataItemFactory } from "@/factories/statistics/PieSectorDataItemFactory";

import { render, waitFor, within } from "../../test-utils";

import NodeChart from "./index";

const mockData: PieSectorDataItem[] = [
  pieSectorDataItemFactory.build({ label: "New", value: 50, color: "#000000" }),
  pieSectorDataItemFactory.build({ label: "Passed", value: 25, color: "#ffffff" }),
  pieSectorDataItemFactory.build({ label: "Error", value: 25, color: "#3b3b3b" }),
];

describe("Accessibility", () => {
  it("should not have any accessibility violations", async () => {
    const { container } = render(<NodeChart label="Test Chart" centerCount={3} data={mockData} />);

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should trim the chart label if it exceeds 14 characters", () => {
    const { getByText, rerender } = render(
      <NodeChart label="This Is A Very Long Label" centerCount={3} data={mockData} />
    );

    expect(getByText("This Is A Very...")).toBeInTheDocument();

    rerender(<NodeChart label="Short Label" centerCount={3} data={mockData} />);

    expect(getByText("Short Label")).toBeInTheDocument();
  });

  it("should replace underscores with spaces in the chart label", () => {
    const { getByText } = render(
      <NodeChart label="Test_Label_1" centerCount={3} data={mockData} />
    );

    expect(getByText("Test Label 1")).toBeInTheDocument();
  });

  it("should perform a title case transformation on the chart label if it contains spaces", async () => {
    const { getByText, getByRole } = render(
      <NodeChart label="principal investigator" centerCount={3} data={mockData} />
    );

    expect(getByText("Principal Inve...")).toBeInTheDocument();

    userEvent.hover(getByText("Principal Inve..."));

    await waitFor(() => {
      expect(getByRole("tooltip")).toBeVisible();
    });

    // NOTE: We're asserting that the same transformation is applied to the tooltip
    expect(within(getByRole("tooltip")).getByText("Principal Investigator")).toBeInTheDocument();
  });

  // NOTE: Since we're splitting at underscores, let's individually test this too
  it("should perform title case transformation on the chart label if it would contain spaces", () => {
    const { getByText } = render(
      <NodeChart label="principal_investigator" centerCount={3} data={mockData} />
    );

    expect(getByText("Principal Inve...")).toBeInTheDocument();
  });

  it("should persist existing casing if the label does not contain spaces", () => {
    const { getByText } = render(
      <NodeChart label="NonDICOMCTimages" centerCount={3} data={mockData} />
    );

    expect(getByText("NonDICOMCTimag...")).toBeInTheDocument();
  });

  it.each([null, "", undefined])("should not crash if the label is %s", (value) => {
    expect(() => render(<NodeChart label={value} centerCount={3} data={mockData} />)).not.toThrow();
  });
});
