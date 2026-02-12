import userEvent from "@testing-library/user-event";
import { Mock } from "vitest";
import { axe } from "vitest-axe";

import { render, waitFor } from "../../test-utils";

import ColumnVisibilityButton from "./ColumnVisibilityButton";

const columns: Column[] = [
  { field: "name", label: "Name", hideable: false },
  { field: "age", label: "Age" },
  { field: "email", label: "Email" },
];

const getColumnKey = (column: Column) => column.fieldKey ?? column.field;
const getColumnLabel = (column: Column) => column.label;

let columnVisibilityModel: { [key: string]: boolean };
let setColumnVisibilityModel: Mock;

type Column = {
  field: string;
  fieldKey?: string;
  label: string;
  hideable?: boolean;
};

describe("Accessibility", () => {
  beforeEach(() => {
    columnVisibilityModel = {
      name: true,
      age: true,
      email: true,
    };
    setColumnVisibilityModel = vi.fn((model) => {
      columnVisibilityModel = model;
    });
  });

  it("should not have accessibility violations when closed", async () => {
    const { container } = render(
      <ColumnVisibilityButton
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        getColumnKey={getColumnKey}
        getColumnLabel={getColumnLabel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
      />
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have accessibility violations when open", async () => {
    const { container, getByTestId } = render(
      <ColumnVisibilityButton
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        getColumnKey={getColumnKey}
        getColumnLabel={getColumnLabel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
      />
    );

    userEvent.click(getByTestId("column-visibility-button"), null, { skipHover: true });

    await waitFor(() => {
      expect(getByTestId("column-visibility-popper")).toBeVisible();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ColumnVisibilityButton", () => {
  beforeEach(() => {
    columnVisibilityModel = {
      name: true,
      age: true,
      email: true,
    };
    setColumnVisibilityModel = vi.fn((model) => {
      columnVisibilityModel = model;
    });
  });

  it("renders without crashing", () => {
    const { getByTestId } = render(
      <ColumnVisibilityButton
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        getColumnKey={getColumnKey}
        getColumnLabel={getColumnLabel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
      />
    );

    const button = getByTestId("column-visibility-button");
    expect(button).toBeInTheDocument();
  });

  it("renders with a custom icon", () => {
    const CustomIcon = () => <div data-testid="custom-icon">Custom Icon</div>;

    const { getByTestId } = render(
      <ColumnVisibilityButton
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        icon={<CustomIcon />}
        getColumnKey={getColumnKey}
        getColumnLabel={getColumnLabel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
      />
    );

    const customIcon = getByTestId("custom-icon");
    expect(customIcon).toBeInTheDocument();
  });

  it("opens and closes the popper when clicked", () => {
    const { getByTestId, queryByTestId } = render(
      <ColumnVisibilityButton
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        getColumnKey={getColumnKey}
        getColumnLabel={getColumnLabel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
      />
    );

    const button = getByTestId("column-visibility-button");
    userEvent.click(button);

    const popper = getByTestId("column-visibility-popper");
    expect(popper).toBeVisible();

    // Close the popper
    const closeButton = getByTestId("column-visibility-popper-close-button");
    userEvent.click(closeButton);

    expect(queryByTestId("column-visibility-popper")).not.toBeInTheDocument();
  });

  it("passes sortAlphabetically prop correctly", () => {
    const unorderedColumns: Column[] = [
      { field: "email", label: "Email" },
      { field: "name", label: "Name", hideable: false },
      { field: "age", label: "Age" },
    ];

    const { getByTestId, getAllByTestId } = render(
      <ColumnVisibilityButton
        columns={unorderedColumns}
        columnVisibilityModel={columnVisibilityModel}
        sortAlphabetically={false}
        getColumnKey={getColumnKey}
        getColumnLabel={getColumnLabel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
      />
    );

    const button = getByTestId("column-visibility-button");
    userEvent.click(button);

    const checkboxes = getAllByTestId(/^checkbox-/);

    const columnKeys = checkboxes.map((checkbox) => {
      const dataTestId = checkbox.getAttribute("data-testid") || "";
      return dataTestId.replace("checkbox-", "");
    });

    const expectedOrder = unorderedColumns.map(getColumnKey);

    expect(columnKeys).toEqual(expectedOrder);
  });

  it("calls onColumnVisibilityModelChange when column visibility changes", () => {
    const { getByTestId } = render(
      <ColumnVisibilityButton
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        getColumnKey={getColumnKey}
        getColumnLabel={getColumnLabel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
      />
    );

    const button = getByTestId("column-visibility-button");
    userEvent.click(button);

    const ageCheckbox = getByTestId("checkbox-age") as HTMLInputElement;
    userEvent.click(ageCheckbox);

    expect(setColumnVisibilityModel).toHaveBeenCalledWith({
      name: true,
      age: false,
      email: true,
    });
  });
});
