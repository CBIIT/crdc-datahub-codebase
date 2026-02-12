import userEvent from "@testing-library/user-event";
import { FC } from "react";
import { axe } from "vitest-axe";

import { TestRouter, render, waitFor } from "../../../test-utils";

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
        <Dialog open errors={[]} />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations (with errors)", async () => {
    const { container } = render(
      <TestParent>
        <Dialog open errors={["Error description 1", "Error description 2"]} />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={[]} />
      </TestParent>
    );

    expect(getByTestId("error-details-dialog")).toBeVisible();
  });

  it("should close the dialog when the 'Close' button is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={[]} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("error-details-close-button"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the 'X' icon is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={[]} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("error-details-close-icon"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the backdrop is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={[]} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("error-details-dialog").firstChild as HTMLElement);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should handle the 'onClose' prop being undefined", async () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={[]} />
      </TestParent>
    );

    expect(() => userEvent.click(getByTestId("error-details-close-button"))).not.toThrow();
  });
});

describe("Implementation Requirements", () => {
  it("should render the dialog with the correct header", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={[]} header="Error Details Header" />
      </TestParent>
    );

    expect(getByTestId("error-details-header")).toHaveTextContent(/Error Details Header/i);
  });

  it("should render the dialog with the correct title", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={[]} title="Error Details" />
      </TestParent>
    );

    expect(getByTestId("error-details-title")).toHaveTextContent(/Error Details/i);
  });

  it("should render the dialog with the correct close button text", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={[]} closeText="Dismiss" />
      </TestParent>
    );

    expect(getByTestId("error-details-close-button")).toHaveTextContent("Dismiss");
  });

  it("should render the dialog with the custom error count specified", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={[]} errorCount="custom error count" />
      </TestParent>
    );

    expect(getByTestId("error-details-error-count")).toHaveTextContent(/custom error count/);
  });

  it("should render the dialog with the automatically-calculated error count", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={["Error description 1", "Error description 2"]} />
      </TestParent>
    );

    expect(getByTestId("error-details-error-count")).toHaveTextContent(/2 errors/i);
  });

  it.each<[number, string]>([
    [0, "0 ERRORS"],
    [1, "1 ERROR"],
    [2, "2 ERRORS"],
  ])(
    "should use the correct pluralization for the automatic error count of %p",
    (count, expected) => {
      const { getByTestId } = render(
        <TestParent>
          <Dialog open errors={new Array(count).fill("description")} />
        </TestParent>
      );

      expect(getByTestId("error-details-error-count")).toHaveTextContent(expected);
    }
  );

  it("should render the node info if provided", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={[]} nodeInfo="Node Info" />
      </TestParent>
    );

    expect(getByTestId("error-details-node-info")).toHaveTextContent(/Node Info/i);
  });

  it("should render and format the uploadedDate as 'M/D/YYYY' if provided", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open errors={[]} uploadedDate="2024-06-26T17:57:56.671Z" />
      </TestParent>
    );

    expect(getByTestId("error-details-upload-date")).toHaveTextContent("Uploaded on 6/26/2024");
  });
});
