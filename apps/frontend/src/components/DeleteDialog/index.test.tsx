import userEvent from "@testing-library/user-event";
import { FC } from "react";
import { axe } from "vitest-axe";

import { TestRouter, render, waitFor } from "../../test-utils";

import Dialog from "./index";

type ParentProps = {
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ children }) => (
  <TestRouter basename="">{children}</TestRouter>
);

describe("Accessibility", () => {
  it("should have no violations (no errors)", async () => {
    const { container } = render(
      <TestParent>
        <Dialog open onConfirm={vi.fn()} onClose={vi.fn()} />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open onConfirm={vi.fn()} onClose={vi.fn()} />
      </TestParent>
    );

    expect(getByTestId("delete-dialog")).toBeVisible();
  });

  it("should call the 'onClose' callback when the close button is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <Dialog open onConfirm={vi.fn()} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("delete-dialog-cancel-button"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should call the 'onClose' when the close icon is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <Dialog open onConfirm={vi.fn()} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("delete-dialog-close-icon-button"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the backdrop is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <Dialog open onConfirm={vi.fn()} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("delete-dialog").firstChild as HTMLElement);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should call the 'onConfirm' callback when the confirm button is clicked", async () => {
    const mockOnConfirm = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <Dialog open onConfirm={mockOnConfirm} onClose={vi.fn()} />
      </TestParent>
    );

    expect(mockOnConfirm).not.toHaveBeenCalled();

    userEvent.click(getByTestId("delete-dialog-confirm-button"));

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it("should forward button props to the close button", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open onConfirm={vi.fn()} onClose={vi.fn()} closeButtonProps={{ disabled: true }} />
      </TestParent>
    );

    expect(getByTestId("delete-dialog-cancel-button")).toBeDisabled();
  });

  it("should forward button props to the confirm button", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog
          open
          onConfirm={vi.fn()}
          onClose={vi.fn()}
          confirmButtonProps={{ disabled: true }}
        />
      </TestParent>
    );

    expect(getByTestId("delete-dialog-confirm-button")).toBeDisabled();
  });

  it("should forward the header props to the header element", () => {
    const mockOnHeaderClick = vi.fn();

    const { getByTestId } = render(
      <TestParent>
        <Dialog
          open
          onConfirm={vi.fn()}
          onClose={vi.fn()}
          headerProps={{ className: "xyz-custom-prop", onClick: mockOnHeaderClick }}
        />
      </TestParent>
    );

    expect(getByTestId("delete-dialog-header")).toHaveClass("xyz-custom-prop");

    userEvent.click(getByTestId("delete-dialog-header"));

    expect(mockOnHeaderClick).toHaveBeenCalledTimes(1);
  });
});

describe("Implementation Requirements", () => {
  it("should render the dialog with the correct header", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open onConfirm={vi.fn()} onClose={vi.fn()} header="custom header" />
      </TestParent>
    );

    expect(getByTestId("delete-dialog-header")).toHaveTextContent(/custom header/i);
  });

  it("should render the dialog with the correct description", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open onConfirm={vi.fn()} onClose={vi.fn()} description="custom description" />
      </TestParent>
    );

    expect(getByTestId("delete-dialog-description")).toHaveTextContent(/custom description/i);
  });

  it("should render the dialog with the correct close button text", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open onConfirm={vi.fn()} onClose={vi.fn()} closeText="custom dismiss" />
      </TestParent>
    );

    expect(getByTestId("delete-dialog-cancel-button")).toHaveTextContent("custom dismiss");
  });

  it("should render the dialog with the correct confirm button text", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open onConfirm={vi.fn()} onClose={vi.fn()} confirmText="custom confirm" />
      </TestParent>
    );

    expect(getByTestId("delete-dialog-confirm-button")).toHaveTextContent("custom confirm");
  });
});
