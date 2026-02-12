import userEvent from "@testing-library/user-event";
import { Mock } from "vitest";
import { axe } from "vitest-axe";

import { render, within } from "../../test-utils";

import ColumnVisibilityPopper, {
  ColumnVisibilityPopperGroup,
  ColumnVisibilityPopperProps,
} from "./ColumnVisibilityPopper";

type Column = {
  field: string;
  fieldKey?: string;
  label: string;
  hideable?: boolean;
  defaultHidden?: boolean;
};

const columns: Column[] = [
  { field: "name", label: "Name", hideable: false },
  { field: "age", label: "Age", defaultHidden: true },
  { field: "email", label: "Email" },
];

const getColumnKey = (column: Column) => column.fieldKey ?? column.field;
const getColumnLabel = (column: Column) => column.label;

describe("Accessibility", () => {
  let columnVisibilityModel: { [key: string]: boolean };
  let setColumnVisibilityModel: Mock;
  const onClose = vi.fn();

  beforeEach(() => {
    columnVisibilityModel = {
      name: true,
      age: true,
      email: true,
    };
    setColumnVisibilityModel = vi.fn((model) => {
      columnVisibilityModel = model;
    });
    onClose.mockClear();
  });

  it("should not have accessibility violations when open", async () => {
    const { container } = render(
      <ColumnVisibilityPopper
        anchorEl={document.body}
        open
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        getColumnKey={getColumnKey}
        getColumnLabel={getColumnLabel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
        onClose={onClose}
      />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ColumnVisibilityPopper", () => {
  let columnVisibilityModel: { [key: string]: boolean };
  let setColumnVisibilityModel: Mock;
  const onClose = vi.fn();

  beforeEach(() => {
    columnVisibilityModel = {
      name: true,
      age: true,
      email: true,
    };
    setColumnVisibilityModel = vi.fn((model) => {
      columnVisibilityModel = model;
    });
    onClose.mockClear();
  });

  const renderComponent = (props: Partial<ColumnVisibilityPopperProps<Column>> = {}) =>
    render(
      <ColumnVisibilityPopper
        anchorEl={document.body}
        open
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        getColumnKey={getColumnKey}
        getColumnLabel={getColumnLabel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
        onClose={onClose}
        {...props}
      />
    );

  it("renders columns correctly", () => {
    const { getByTestId } = renderComponent();

    const nameCheckbox = getByTestId("checkbox-name") as HTMLInputElement;
    const ageCheckbox = getByTestId("checkbox-age") as HTMLInputElement;
    const emailCheckbox = getByTestId("checkbox-email") as HTMLInputElement;

    expect(nameCheckbox).toBeChecked();
    expect(nameCheckbox).toBeDisabled();

    expect(ageCheckbox).toBeChecked();
    expect(ageCheckbox).not.toBeDisabled();

    expect(emailCheckbox).toBeChecked();
    expect(emailCheckbox).not.toBeDisabled();
  });

  it("should group columns when grouping props are provided", () => {
    const groups: ColumnVisibilityPopperGroup[] = [
      { name: "GROUP-1" },
      { name: "GROUP-2" },
      { name: "GROUP-3" },
    ];

    const getColumnGroup = (column: Column) => {
      switch (column.field) {
        case "name":
          return "GROUP-1";
        case "age":
          return "GROUP-2";
        case "email":
          return "GROUP-3";
        default:
          return "";
      }
    };

    const { getByTestId } = renderComponent({ groups, getColumnGroup });

    expect(
      within(getByTestId("column-group-GROUP-1")).getByTestId("checkbox-name")
    ).toBeInTheDocument();
    expect(
      within(getByTestId("column-group-GROUP-2")).getByTestId("checkbox-age")
    ).toBeInTheDocument();
    expect(
      within(getByTestId("column-group-GROUP-3")).getByTestId("checkbox-email")
    ).toBeInTheDocument();
  });

  it("should render the description tooltip when group has description", () => {
    const getColumnGroup = (column: Column) => {
      switch (column.field) {
        case "name":
          return "GROUP-1";
        case "age":
          return "GROUP-2";
        case "email":
          return "GROUP-3";
        default:
          return "";
      }
    };

    const { getByTestId, getByText } = renderComponent({
      getColumnGroup,
      groups: [
        { name: "GROUP-1", description: "Group 1 Description" },
        { name: "GROUP-2", description: "Group 2 Description" },
        { name: "GROUP-3", description: "Group 3 Description" },
      ],
    });

    expect(
      within(getByTestId("column-group-GROUP-1")).getByTestId("column-group-tooltip")
    ).toBeInTheDocument();
    userEvent.click(
      within(getByTestId("column-group-GROUP-1")).getByTestId("column-group-tooltip")
    );
    expect(getByText("Group 1 Description")).toBeInTheDocument();
    userEvent.click(document.body);

    expect(
      within(getByTestId("column-group-GROUP-2")).getByTestId("column-group-tooltip")
    ).toBeInTheDocument();
    userEvent.click(
      within(getByTestId("column-group-GROUP-2")).getByTestId("column-group-tooltip")
    );
    expect(getByText("Group 2 Description")).toBeInTheDocument();
    userEvent.click(document.body);

    expect(
      within(getByTestId("column-group-GROUP-3")).getByTestId("column-group-tooltip")
    ).toBeInTheDocument();
    userEvent.click(
      within(getByTestId("column-group-GROUP-3")).getByTestId("column-group-tooltip")
    );
    expect(getByText("Group 3 Description")).toBeInTheDocument();
  });

  it("should render a placeholder when a group has no columns", () => {
    const { getByTestId } = renderComponent({
      groups: [{ name: "GROUP-1" }, { name: "GROUP-4" }],
      getColumnGroup: (column) => {
        switch (column.field) {
          default:
            return "GROUP-1"; // Always force to GROUP-1
        }
      },
    });

    expect(within(getByTestId("column-group-GROUP-4")).getByText("N/A")).toBeInTheDocument();
  });

  // NOTE: This isn't necessarily desired behavior, but writing a test to lock it as-is for now.
  it("should not render a column when the group is not provided in the `groups` prop", () => {
    const getColumnGroup = (column: Column) => {
      switch (column.field) {
        case "name":
        case "age":
          return "GROUP-1";
        case "email": // Rendering into a non-existent group
        default:
          return "GROUP-DOES-NOT-EXIST";
      }
    };

    const { getByTestId, queryByTestId } = renderComponent({
      getColumnGroup,
      groups: [{ name: "GROUP-1", description: "Group 1 Description" }],
    });

    // GROUP-1
    expect(getByTestId("checkbox-name")).toBeInTheDocument();
    expect(getByTestId("checkbox-age")).toBeInTheDocument();

    // GROUP-DOES-NOT-EXIST was not provided in groups
    expect(queryByTestId("checkbox-email")).not.toBeInTheDocument();
  });

  it("does not call onColumnVisibilityModelChange when non-hideable column's checkbox is changed", () => {
    const { getByTestId } = renderComponent();

    const nameCheckbox = getByTestId("checkbox-name") as HTMLInputElement;

    // Remove the 'disabled' attribute and allow pointer events temporarily to simulate the click
    nameCheckbox.style.pointerEvents = "all";
    nameCheckbox.disabled = false;
    userEvent.click(nameCheckbox);
    expect(setColumnVisibilityModel).not.toHaveBeenCalled();
    nameCheckbox.style.pointerEvents = "auto";
    nameCheckbox.disabled = true;
  });

  it("returns columns unsorted when sortAlphabetically is false", () => {
    const unorderedColumns: Column[] = [
      { field: "email", label: "Email" },
      { field: "name", label: "Name", hideable: false },
      { field: "age", label: "Age" },
    ];

    const { getAllByTestId } = renderComponent({
      columns: unorderedColumns,
      sortAlphabetically: false,
    });

    // Get all checkboxes for the columns (excluding "Show/Hide All")
    const checkboxes = getAllByTestId(/^checkbox-/);

    const columnKeys = checkboxes.map((checkbox) => {
      const dataTestId = checkbox.getAttribute("data-testid") || "";
      return dataTestId.replace("checkbox-", "");
    });

    // The expected order of keys based on unorderedColumns
    const expectedOrder = unorderedColumns.map(getColumnKey);

    expect(columnKeys).toEqual(expectedOrder);
  });

  it("toggles column visibility", () => {
    const { getByTestId } = renderComponent();

    const ageCheckbox = getByTestId("checkbox-age") as HTMLInputElement;
    userEvent.click(ageCheckbox);

    expect(setColumnVisibilityModel).toHaveBeenCalledWith({
      name: true,
      age: false,
      email: true,
    });
  });

  it("toggles all columns", () => {
    const { getByTestId } = renderComponent();

    const toggleAllCheckbox = getByTestId("toggle-all-checkbox") as HTMLInputElement;
    userEvent.click(toggleAllCheckbox);

    expect(setColumnVisibilityModel).toHaveBeenCalledWith({
      name: true, // Non-hideable remains true
      age: false,
      email: false,
    });
  });

  it("should reset columns back to default", () => {
    columnVisibilityModel = {
      name: false,
      age: true,
      email: false,
    };

    const { getByTestId } = renderComponent();

    const resetButton = getByTestId("reset-button");
    userEvent.click(resetButton);

    expect(setColumnVisibilityModel).toHaveBeenCalledWith({
      name: true,
      age: false, // default hidden
      email: true,
    });
  });

  it("should close the popper when the close button is clicked", () => {
    const { getByTestId } = renderComponent();

    const closeButton = getByTestId("column-visibility-popper-close-button");
    userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });
});
