import { axe } from "vitest-axe";

import { nodeTypeSummaryFactory } from "@/factories/submission/NodeTypeSummaryFactory";
import { render, within } from "@/test-utils";

import SubmitSummaryTable from "./SubmitSummaryTable";

describe("Accessibility", () => {
  it("should have no violations (with data, New/Update)", async () => {
    const rows = nodeTypeSummaryFactory.build(3, (i) => ({
      nodeType: `NodeType ${i + 1}`,
      new: 10 + i,
      updated: 5 + i,
      deleted: 0,
    }));

    const { container, getByText, getByTestId } = render(
      <SubmitSummaryTable intention="New/Update" data={rows} loading={false} />
    );

    expect(getByText("Node Type")).toBeInTheDocument();
    expect(getByText("New Nodes")).toBeInTheDocument();
    expect(getByText("Updated Nodes")).toBeInTheDocument();
    expect(
      within(getByTestId("submit-summary-table-body")).getByText("NodeType 1")
    ).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have no violations (loading skeleton)", async () => {
    const { container, getAllByTestId } = render(
      <SubmitSummaryTable intention={undefined} data={[]} loading />
    );

    expect(getAllByTestId("submit-summary-skeleton").length).toBeGreaterThan(0);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("renders headers for New/Update", () => {
    const rows = nodeTypeSummaryFactory.build(2, (i) => ({
      nodeType: `NodeType ${i + 1}`,
      new: 1 + i,
      updated: 200 + i,
      deleted: 0,
    }));

    const { getByText, getByTestId } = render(
      <SubmitSummaryTable intention="New/Update" data={rows} loading={false} />
    );

    expect(getByText("Node Type")).toBeInTheDocument();
    expect(getByText("New Nodes")).toBeInTheDocument();
    expect(getByText("Updated Nodes")).toBeInTheDocument();

    const tbody = getByTestId("submit-summary-table-body");
    expect(within(tbody).getByText("NodeType 1")).toBeInTheDocument();
    expect(within(tbody).getByText("1")).toBeInTheDocument();
    expect(within(tbody).getByText("200")).toBeInTheDocument();
  });

  it("renders headers for Delete-only", () => {
    const rows = nodeTypeSummaryFactory.build(2, (i) => ({
      nodeType: `NodeType ${i + 1}`,
      new: 0,
      updated: 0,
      deleted: 42 + i,
    }));

    const { getByText, getByTestId } = render(
      <SubmitSummaryTable intention="Delete" data={rows} loading={false} />
    );

    expect(getByText("Node Type")).toBeInTheDocument();
    expect(getByText("Deleted Nodes")).toBeInTheDocument();

    const tbody = getByTestId("submit-summary-table-body");
    expect(within(tbody).getByText("NodeType 1")).toBeInTheDocument();
    expect(within(tbody).getByText("42")).toBeInTheDocument();
  });

  it("shows skeleton rows while loading (body)", () => {
    const { getAllByTestId, getByTestId } = render(
      <SubmitSummaryTable intention="New/Update" data={[]} loading />
    );

    expect(getAllByTestId("submit-summary-skeleton").length).toBeGreaterThan(0);
    const tbody = getByTestId("submit-summary-table-body");
    expect(within(tbody).queryByText("NodeType 1")).toBeNull();
  });

  it.each([null, undefined, "", NaN])(
    "should default values to 0 when values are %s (New/Update)",
    (invalidValue) => {
      const rows = nodeTypeSummaryFactory.build(1, (i) => ({
        nodeType: `NodeType ${i + 1}`,
        new: invalidValue as unknown as number,
        updated: invalidValue as unknown as number,
        deleted: 0,
      }));

      const { getByTestId, getByText } = render(
        <SubmitSummaryTable intention="New/Update" data={rows} loading={false} />
      );

      expect(getByText("Node Type")).toBeInTheDocument();
      expect(getByText("New Nodes")).toBeInTheDocument();
      expect(getByText("Updated Nodes")).toBeInTheDocument();

      const tbody = getByTestId("submit-summary-table-body");
      expect(within(tbody).getByTestId("submit-summary-new")).toHaveTextContent("0");
      expect(within(tbody).getByTestId("submit-summary-updated")).toHaveTextContent("0");
    }
  );

  it.each([null, undefined, "", NaN])(
    "should default values to 0 when values are %s (Delete)",
    (invalidValue) => {
      const rows = nodeTypeSummaryFactory.build(1, (i) => ({
        nodeType: `NodeType ${i + 1}`,
        new: 0,
        updated: 0,
        deleted: invalidValue as unknown as number,
      }));

      const { getByTestId, getByText } = render(
        <SubmitSummaryTable intention="Delete" data={rows} loading={false} />
      );

      expect(getByText("Deleted Nodes")).toBeInTheDocument();

      const tbody = getByTestId("submit-summary-table-body");
      expect(within(tbody).getByTestId("submit-summary-deleted")).toHaveTextContent("0");
    }
  );
});

describe("Implementation Requirements", () => {
  it("renders data rows for New/Update", () => {
    const rows = nodeTypeSummaryFactory.build(3, (i) => ({
      nodeType: `NodeType ${i + 1}`,
      new: 50 + i,
      updated: 7 + i,
      deleted: 0,
    }));

    const { getByTestId } = render(
      <SubmitSummaryTable intention="New/Update" data={rows} loading={false} />
    );

    const tbody = getByTestId("submit-summary-table-body");
    const firstRow = within(tbody).getByText("NodeType 1").closest("tr");
    expect(within(firstRow).getByText("50")).toBeInTheDocument();
    expect(within(firstRow).getByText("7")).toBeInTheDocument();
  });

  it("renders data rows for Delete-only", () => {
    const rows = nodeTypeSummaryFactory.build(2, (i) => ({
      nodeType: `NodeType ${i + 1}`,
      new: 0,
      updated: 0,
      deleted: 99 + i,
    }));

    const { getByTestId, getByText } = render(
      <SubmitSummaryTable intention="Delete" data={rows} loading={false} />
    );

    expect(getByText("Deleted Nodes")).toBeInTheDocument();

    const tbody = getByTestId("submit-summary-table-body");
    const firstRow = within(tbody).getByText("NodeType 1").closest("tr");
    expect(within(firstRow).getByText("99")).toBeInTheDocument();
  });
});
