import { axe } from "vitest-axe";

import { submissionNodeFactory } from "@/factories/submission/SubmissionNodeFactory";

import { RetrieveReleasedDataResp } from "../../graphql";
import { render } from "../../test-utils";

import ComparisonTable from "./ComparisonTable";

const baseNode: RetrieveReleasedDataResp["retrieveReleasedDataByID"][number] = submissionNodeFactory
  .pick(["nodeType", "nodeID", "props"])
  .build({
    nodeType: "",
    nodeID: "",
    props: "{}",
  });

describe("Accessibility", () => {
  it("should have no violations", async () => {
    const { container, getByText } = render(
      <ComparisonTable
        newNode={{ ...baseNode, props: JSON.stringify({ mock_node_data_name: "bar", baz: 1 }) }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify({ mock_node_data_name: "baz", baz: 2 }),
        }}
        loading={false}
      />
    );

    expect(getByText(/mock_node_data_name/i)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations (loading)", async () => {
    const { container } = render(<ComparisonTable newNode={null} existingNode={null} loading />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations (no data)", async () => {
    const { container } = render(
      <ComparisonTable newNode={null} existingNode={null} loading={false} />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() =>
      render(<ComparisonTable newNode={null} existingNode={null} loading={false} />)
    ).not.toThrow();
  });

  it("should show an error message when there is no data (all null)", () => {
    const { getByTestId, getByText } = render(
      <ComparisonTable newNode={null} existingNode={null} loading={false} />
    );

    expect(getByTestId(/node-comparison-error/i)).toBeInTheDocument();
    expect(getByText(/Unable to show comparison of data/i)).toBeInTheDocument();
  });

  it("should show an error message when there is no data (empty props)", () => {
    const { getByTestId, getByText } = render(
      <ComparisonTable
        newNode={{ ...baseNode, props: "{}" }}
        existingNode={{ ...baseNode, props: "{}" }}
        loading={false}
      />
    );

    expect(getByTestId(/node-comparison-error/i)).toBeInTheDocument();
    expect(getByText(/Unable to show comparison of data/i)).toBeInTheDocument();
  });

  it("should show an error message when there is no data (parsing issue 1/2)", () => {
    const { getByTestId, getByText } = render(
      <ComparisonTable
        newNode={{ ...baseNode, props: "NOT JSON" }}
        existingNode={{ ...baseNode, props: "{}" }}
        loading={false}
      />
    );

    expect(getByTestId(/node-comparison-error/i)).toBeInTheDocument();
    expect(getByText(/Unable to show comparison of data/i)).toBeInTheDocument();
  });

  it("should show an error message when there is no data (parsing issue 2/2)", () => {
    const { getByTestId, getByText } = render(
      <ComparisonTable
        newNode={{ ...baseNode, props: "{}" }}
        existingNode={{ ...baseNode, props: "NOT JSON" }}
        loading={false}
      />
    );

    expect(getByTestId(/node-comparison-error/i)).toBeInTheDocument();
    expect(getByText(/Unable to show comparison of data/i)).toBeInTheDocument();
  });

  it("should show a loading skeleton when loading", () => {
    const { getAllByTestId } = render(
      <ComparisonTable newNode={null} existingNode={null} loading />
    );

    expect(getAllByTestId("node-comparison-table-header-skeleton")).toHaveLength(5);
  });

  it("should rerender if a dependency changes", () => {
    const { rerender, getByText, queryByText } = render(
      <ComparisonTable
        newNode={{
          ...baseNode,
          props: JSON.stringify({ mock_node_data_name: "example 01", baz: 1 }),
        }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify({ mock_node_data_name: "example 02", baz: 2 }),
        }}
        loading={false}
      />
    );

    expect(getByText(/example 01/i)).toBeInTheDocument();
    expect(getByText(/example 02/i)).toBeInTheDocument();

    rerender(
      <ComparisonTable
        newNode={{
          ...baseNode,
          props: JSON.stringify({ mock_node_data_name: "example 03", baz: 1 }),
        }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify({ mock_node_data_name: "example 04", baz: 2 }),
        }}
        loading={false}
      />
    );

    expect(queryByText(/example 01/i)).not.toBeInTheDocument();
    expect(queryByText(/example 02/i)).not.toBeInTheDocument();
    expect(getByText(/example 03/i)).toBeInTheDocument();
    expect(getByText(/example 04/i)).toBeInTheDocument();
  });

  it.each<boolean>([true, false])("should render the boolean %s value correctly", (value) => {
    const { getAllByText } = render(
      <ComparisonTable
        newNode={{
          ...baseNode,
          props: JSON.stringify({ mock_node_data_name: "example 01", baz: value }),
        }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify({ mock_node_data_name: "example 02", baz: value }),
        }}
        loading={false}
      />
    );

    expect(getAllByText(value.toString())).toHaveLength(2);
    expect(getAllByText(value.toString())[0]).toBeInTheDocument();
    expect(getAllByText(value.toString())[1]).toBeInTheDocument();
  });

  it.each<number>([0, 900, 10.5, -99999999])(
    "should render the number %s value correctly",
    (value) => {
      const { getAllByText } = render(
        <ComparisonTable
          newNode={{
            ...baseNode,
            props: JSON.stringify({ mock_node_data_name: "example 01", baz: value }),
          }}
          existingNode={{
            ...baseNode,
            props: JSON.stringify({ mock_node_data_name: "example 02", baz: value }),
          }}
          loading={false}
        />
      );

      expect(getAllByText(value.toString())).toHaveLength(2);
      expect(getAllByText(value.toString())[0]).toBeInTheDocument();
      expect(getAllByText(value.toString())[1]).toBeInTheDocument();
    }
  );
});

describe("Implementation Requirements", () => {
  it("should show a table with the correct number of columns", () => {
    const { getByTestId } = render(
      <ComparisonTable
        newNode={{
          ...baseNode,
          props: JSON.stringify({ mock_node_data_name: "example 01", baz: 1 }),
        }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify({ mock_node_data_name: "example 02", baz: 2 }),
        }}
        loading={false}
      />
    );

    expect(getByTestId("node-comparison-table")).toBeInTheDocument();
    expect(getByTestId("node-comparison-table").querySelectorAll("th")).toHaveLength(2);
  });

  it("should contain all of the header cells for each property", () => {
    const dataset = {
      mock_node_data_name: "example 01",
      another_property: "example 02",
      "property.with.dots": "yes",
    };

    const { getByText } = render(
      <ComparisonTable
        newNode={{
          ...baseNode,
          props: JSON.stringify(dataset),
        }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify(dataset),
        }}
        loading={false}
      />
    );

    expect(getByText(/mock_node_data_name/i)).toBeInTheDocument();
    expect(getByText(/another_property/i)).toBeInTheDocument();
    expect(getByText(/property.with.dots/i)).toBeInTheDocument();
  });

  // NOTE: this should never happen, but covering for completeness
  it("should aggregate all of the properties from both nodes", () => {
    const { getByText } = render(
      <ComparisonTable
        newNode={{
          ...baseNode,
          props: JSON.stringify({ mock_data_01: "example 01", another_md_02: 1 }),
        }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify({ mock_data_02: "example 02", another_md_03: 2 }),
        }}
        loading={false}
      />
    );

    // new
    expect(getByText(/mock_data_01/i)).toBeInTheDocument();
    expect(getByText(/another_md_02/i)).toBeInTheDocument();

    // existing
    expect(getByText(/mock_data_02/i)).toBeInTheDocument();
    expect(getByText(/another_md_03/i)).toBeInTheDocument();
  });

  it("should NEW highlight columns where the values differ (data difference)", () => {
    const { getByTestId } = render(
      <ComparisonTable
        newNode={{
          ...baseNode,
          props: JSON.stringify({
            mock_node_data_name: "example 01",
            no_change: "no",
            baz: 1,
            booleanDifference: false,
          }),
        }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify({
            mock_node_data_name: "example 02",
            no_change: "no",
            baz: 2,
            booleanDifference: true,
          }),
        }}
        loading={false}
      />
    );

    const newStyle: React.CSSProperties = {
      fontWeight: "700",
      color: "#CA4F1A",
    };

    const defaultStyle: React.CSSProperties = {
      fontWeight: "400",
      color: "#083A50",
    };

    // Data changes - NEW value
    expect(getByTestId("node-comparison-table-new-mock_node_data_name")).toHaveStyle({
      ...newStyle,
    });
    expect(getByTestId("node-comparison-table-new-baz")).toHaveStyle({
      ...newStyle,
    });
    expect(getByTestId("node-comparison-table-new-booleanDifference")).toHaveStyle({
      ...newStyle,
    });

    // Data changes - EXISTING value
    expect(getByTestId("node-comparison-table-existing-mock_node_data_name")).toHaveStyle({
      ...defaultStyle,
    });
    expect(getByTestId("node-comparison-table-existing-baz")).toHaveStyle({
      ...defaultStyle,
    });
    expect(getByTestId("node-comparison-table-existing-booleanDifference")).toHaveStyle({
      ...defaultStyle,
    });

    // No data changes in the other columns
    expect(getByTestId("node-comparison-table-existing-no_change")).toHaveStyle({
      ...defaultStyle,
      backgroundColor: "#F2F6FA",
    });
    expect(getByTestId("node-comparison-table-new-no_change")).toHaveStyle({
      ...defaultStyle,
      backgroundColor: "#F2F6FA",
    });
  });

  it("should highlight NEW columns where the values differ ('<delete>' present)", () => {
    const { getByTestId } = render(
      <ComparisonTable
        newNode={{
          ...baseNode,
          props: JSON.stringify({
            hasDelete: "<delete>",
            nothing_here: "xyz",
            deleteValInData: "<delete>",
          }),
        }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify({
            hasDelete: "example 02",
            nothing_here: "xyz",
            deleteValInData: "<delete>",
          }),
        }}
        loading={false}
      />
    );

    const newStyle: React.CSSProperties = {
      fontWeight: "700",
      color: "#CA4F1A",
    };

    const defaultStyle: React.CSSProperties = {
      fontWeight: "400",
      color: "#083A50",
    };

    // Data changes - NEW value
    expect(getByTestId("node-comparison-table-new-hasDelete")).toHaveStyle({
      ...newStyle,
    });

    // Data changes - EXISTING value
    expect(getByTestId("node-comparison-table-existing-hasDelete")).toHaveStyle({
      ...defaultStyle,
    });

    // No data changes in the other columns
    expect(getByTestId("node-comparison-table-existing-nothing_here")).toHaveStyle({
      ...defaultStyle,
      backgroundColor: "#F2F6FA",
    });
    expect(getByTestId("node-comparison-table-new-nothing_here")).toHaveStyle({
      ...defaultStyle,
      backgroundColor: "#F2F6FA",
    });
  });

  // NOTE: This is just a sanity check. The other tests also cover this.
  it("should gray out columns where the values are the same", () => {
    const { getByTestId } = render(
      <ComparisonTable
        newNode={{
          ...baseNode,
          props: JSON.stringify({
            sameVal1: "same",
            xyzSame: true,
            emptySame: "",
            booleanSame: false,
            numericSame: 0,
          }),
        }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify({
            sameVal1: "same",
            xyzSame: true,
            emptySame: "",
            booleanSame: false,
            numericSame: 0,
          }),
        }}
        loading={false}
      />
    );

    const unchangedStyle: React.CSSProperties = {
      fontWeight: "400",
      backgroundColor: "#F2F6FA",
      color: "#083A50",
    };

    // No data changes anywhere
    expect(getByTestId("node-comparison-table-existing-sameVal1")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-new-sameVal1")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-existing-xyzSame")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-new-xyzSame")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-existing-emptySame")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-new-emptySame")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-existing-booleanSame")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-new-booleanSame")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-existing-numericSame")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-new-numericSame")).toHaveStyle({
      ...unchangedStyle,
    });
  });

  it("should gray out columns where the NEW value is empty", () => {
    const { getByTestId } = render(
      <ComparisonTable
        newNode={{
          ...baseNode,
          props: JSON.stringify({ emptyVal: "", xyzEmpty: "", emptySame: "" }),
        }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify({ emptyVal: "wont", xyzEmpty: "be", emptySame: "changed" }),
        }}
        loading={false}
      />
    );

    const unchangedStyle: React.CSSProperties = {
      fontWeight: "400",
      color: "#083A50",
      backgroundColor: "#F2F6FA",
    };

    // No data changes anywhere
    expect(getByTestId("node-comparison-table-existing-emptyVal")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-new-emptyVal")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-existing-xyzEmpty")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-new-xyzEmpty")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-existing-emptySame")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-new-emptySame")).toHaveStyle({
      ...unchangedStyle,
    });
  });

  it("should gray out columns where the NEW value is NULL", () => {
    const { getByTestId } = render(
      <ComparisonTable
        newNode={{
          ...baseNode,
          props: JSON.stringify({ emptyVal: null, xyzEmpty: null, emptySame: null }),
        }}
        existingNode={{
          ...baseNode,
          props: JSON.stringify({ emptyVal: "wont", xyzEmpty: "be", emptySame: "changed" }),
        }}
        loading={false}
      />
    );

    const unchangedStyle: React.CSSProperties = {
      fontWeight: "400",
      color: "#083A50",
      backgroundColor: "#F2F6FA",
    };

    // No data changes anywhere
    expect(getByTestId("node-comparison-table-existing-emptyVal")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-new-emptyVal")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-existing-xyzEmpty")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-new-xyzEmpty")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-existing-emptySame")).toHaveStyle({
      ...unchangedStyle,
    });
    expect(getByTestId("node-comparison-table-new-emptySame")).toHaveStyle({
      ...unchangedStyle,
    });
  });
});

describe("Snapshots", () => {
  it("should match the loading state snapshot", () => {
    const { container } = render(<ComparisonTable newNode={null} existingNode={null} loading />);

    expect(container).toMatchSnapshot("loading table");
  });
});
