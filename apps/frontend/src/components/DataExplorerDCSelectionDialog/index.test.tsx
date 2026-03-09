import { render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import DataExplorerDCSelectionDialog from "./index";

describe("Accessibility", () => {
  it("has no accessibility violations when open", async () => {
    const { container } = render(
      <DataExplorerDCSelectionDialog
        open
        dataCommons={["DC1", "DC2"]}
        onSubmitForm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations when closed", async () => {
    const { container } = render(
      <DataExplorerDCSelectionDialog
        open={false}
        dataCommons={["DC1", "DC2"]}
        onSubmitForm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("DataExplorerDCSelectionDialog", () => {
  const dataCommons = ["DC1", "DC2", "DC3"];
  const setup = (props = {}) => {
    const onSubmitForm = vi.fn();
    const onClose = vi.fn();
    const utils = render(
      <DataExplorerDCSelectionDialog
        open
        dataCommons={dataCommons}
        onSubmitForm={onSubmitForm}
        onClose={onClose}
        {...props}
      />
    );

    return { ...utils, onSubmitForm, onClose };
  };

  it("renders dialog and all required elements", async () => {
    const { getByTestId, findByTestId } = setup();

    expect(getByTestId("data-commons-selection-dialog")).toBeVisible();
    expect(getByTestId("data-commons-selection-dialog-header")).toHaveTextContent(
      "Multiple Data Commons"
    );
    expect(getByTestId("dataCommon-dialog-body")).toBeInTheDocument();
    expect(getByTestId("dataCommon-field")).toBeInTheDocument();
    expect(getByTestId("data-commons-selection-dialog-cancel-button")).toBeInTheDocument();
    expect(getByTestId("data-commons-selection-dialog-submit-button")).toBeInTheDocument();
    expect(getByTestId("data-commons-selection-dialog-close-icon")).toBeInTheDocument();

    const select = within(getByTestId("dataCommon-field")).getByRole("button");
    userEvent.click(select);

    await findByTestId(`dataCommon-option-${dataCommons[0]}`);

    dataCommons.forEach((dc) => {
      expect(getByTestId(`dataCommon-option-${dc}`)).toBeInTheDocument();
    });
  });

  it("calls onClose when close icon is clicked", async () => {
    const { getByTestId, onClose } = setup();

    userEvent.click(getByTestId("data-commons-selection-dialog-close-icon"));

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Cancel button is clicked", async () => {
    const { getByTestId, onClose } = setup();

    userEvent.click(getByTestId("data-commons-selection-dialog-cancel-button"));

    expect(onClose).toHaveBeenCalled();
  });

  it("shows validation error if no Data Commons is selected and Confirm is clicked", async () => {
    const { getByTestId, findByText } = setup();

    userEvent.click(getByTestId("data-commons-selection-dialog-submit-button"));

    expect(await findByText("This field is required")).toBeInTheDocument();
  });

  it("calls onSubmitForm with selected Data Commons and Confirm is clicked", async () => {
    const { getByTestId, onSubmitForm, findByTestId } = setup();

    const select = within(getByTestId("dataCommon-field")).getByRole("button");
    userEvent.click(select);

    await findByTestId(`dataCommon-option-${dataCommons[1]}`);

    userEvent.click(getByTestId(`dataCommon-option-${dataCommons[1]}`));

    userEvent.click(getByTestId("data-commons-selection-dialog-submit-button"));

    await waitFor(() => {
      expect(onSubmitForm).toHaveBeenCalledWith({ dataCommon: "DC2" });
    });
  });

  it("resets the form after submission", async () => {
    const { getByTestId, findByTestId } = setup();
    const select = within(getByTestId("dataCommon-field")).getByRole("button");
    userEvent.click(select);

    await findByTestId(`dataCommon-option-${dataCommons[1]}`);

    userEvent.click(getByTestId("dataCommon-option-DC3"));
    userEvent.click(getByTestId("data-commons-selection-dialog-submit-button"));

    await waitFor(() => {
      expect(getByTestId("dataCommon-input")).toHaveValue("");
    });
  });

  it("renders nothing if open is false", () => {
    const { queryByTestId } = setup({ open: false });

    expect(queryByTestId("data-commons-selection-dialog")).not.toBeInTheDocument();
  });

  it("disables Confirm button while submitting", async () => {
    const { getByTestId } = setup();

    expect(getByTestId("data-commons-selection-dialog-submit-button")).not.toBeDisabled();
  });
});
