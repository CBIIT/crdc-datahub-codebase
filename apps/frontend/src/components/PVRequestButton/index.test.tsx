import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { useMemo } from "react";
import { axe } from "vitest-axe";

import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { RequestPVResponse, RequestPVInput, REQUEST_PV } from "@/graphql";
import { act, fireEvent, render, waitFor, within } from "@/test-utils";

import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../Contexts/SubmissionContext";

import Button from "./index";

type TestParentProps = {
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const TestParent: React.FC<TestParentProps> = ({ mocks = [], children }) => {
  const submissionContextState = useMemo<SubmissionCtxState>(
    () => ({
      data: {
        getSubmission: submissionFactory.build({
          _id: "mock-submission-id",
        }),
        submissionStats: null,
        getSubmissionAttributes: null,
      },
      status: SubmissionCtxStatus.LOADED,
      error: null,
    }),
    []
  );

  return (
    <MockedProvider mocks={mocks} showWarnings>
      <SubmissionContext.Provider value={submissionContextState}>
        {children}
      </SubmissionContext.Provider>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  it("should have no violations for the button", async () => {
    const { container, getByTestId } = render(
      <Button nodeName="mock-node" offendingProperty="mock-prop" offendingValue="mock-val" />,
      {
        wrapper: TestParent,
      }
    );

    expect(getByTestId("request-pv-button")).toBeEnabled(); // Sanity check for enabled button
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations for the button (disabled)", async () => {
    const { container, getByTestId } = render(
      <Button
        nodeName="mock-node"
        offendingProperty="mock-prop"
        offendingValue="mock-val"
        disabled
      />,
      {
        wrapper: TestParent,
      }
    );

    expect(getByTestId("request-pv-button")).toBeDisabled(); // Sanity check for disabled
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", async () => {
    expect(() =>
      render(
        <Button nodeName="mock-node" offendingProperty="mock-prop" offendingValue="mock-val" />,
        { wrapper: TestParent }
      )
    ).not.toThrow();
  });

  it("should show a snackbar when the PV request operation fails (GraphQL Error)", async () => {
    const mockRequestError: MockedResponse<RequestPVResponse, RequestPVInput> = {
      request: {
        query: REQUEST_PV,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("GraphQL error occurred")],
      },
    };

    const { getByRole } = render(
      <Button nodeName="mock-node" offendingProperty="mock-prop" offendingValue="mock-val" />,
      {
        wrapper: ({ children }) => <TestParent mocks={[mockRequestError]}>{children}</TestParent>,
      }
    );

    const button = getByRole("button", { name: /Request New PV/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(getByRole("dialog")).toBeInTheDocument();
    });

    const commentInput = within(getByRole("dialog")).queryByTestId("request-pv-description");

    userEvent.type(commentInput, "a mock value");
    fireEvent.blur(commentInput); // trigger validation

    await waitFor(() => {
      expect(within(getByRole("dialog")).getByRole("button", { name: /submit/i })).toBeEnabled();
    });

    userEvent.click(within(getByRole("dialog")).getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Oops! Unable to submit the PV request.", {
        variant: "error",
      });
    });
  });

  it("should show a snackbar when the PV request operation fails (Network Error)", async () => {
    const mockRequestError: MockedResponse<RequestPVResponse, RequestPVInput> = {
      request: {
        query: REQUEST_PV,
      },
      variableMatcher: () => true,
      error: new Error("Network error"),
    };

    const { getByRole } = render(
      <Button nodeName="mock-node" offendingProperty="mock-prop" offendingValue="mock-val" />,
      {
        wrapper: ({ children }) => <TestParent mocks={[mockRequestError]}>{children}</TestParent>,
      }
    );

    const button = getByRole("button", { name: /Request New PV/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(getByRole("dialog")).toBeInTheDocument();
    });

    const commentInput = within(getByRole("dialog")).queryByTestId("request-pv-description");

    userEvent.type(commentInput, "a mock value");
    fireEvent.blur(commentInput); // trigger validation

    await waitFor(() => {
      expect(within(getByRole("dialog")).getByRole("button", { name: /submit/i })).toBeEnabled();
    });

    userEvent.click(within(getByRole("dialog")).getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Oops! Unable to submit the PV request.", {
        variant: "error",
      });
    });
  });

  it("should show a snackbar when the PV request operation fails (API Error)", async () => {
    const mockRequestError: MockedResponse<RequestPVResponse, RequestPVInput> = {
      request: {
        query: REQUEST_PV,
      },
      variableMatcher: () => true,
      result: {
        data: {
          requestPV: {
            success: false,
            message: "Something went wrong!",
          },
        },
      },
    };

    const { getByRole } = render(
      <Button nodeName="mock-node" offendingProperty="mock-prop" offendingValue="mock-val" />,
      {
        wrapper: ({ children }) => <TestParent mocks={[mockRequestError]}>{children}</TestParent>,
      }
    );

    const button = getByRole("button", { name: /Request New PV/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(getByRole("dialog")).toBeInTheDocument();
    });

    const commentInput = within(getByRole("dialog")).queryByTestId("request-pv-description");

    userEvent.type(commentInput, "a mock value");
    fireEvent.blur(commentInput); // trigger validation

    await waitFor(() => {
      expect(within(getByRole("dialog")).getByRole("button", { name: /submit/i })).toBeEnabled();
    });

    userEvent.click(within(getByRole("dialog")).getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Oops! Unable to submit the PV request.", {
        variant: "error",
      });
    });
  });

  it("should call the onSubmit callback when the operation is successful", async () => {
    const mockOnSubmit = vi.fn();

    const mockSuccess: MockedResponse<RequestPVResponse, RequestPVInput> = {
      request: {
        query: REQUEST_PV,
      },
      variableMatcher: () => true,
      result: {
        data: {
          requestPV: {
            success: true,
            message: "",
          },
        },
      },
    };

    const { getByRole } = render(
      <Button
        nodeName="mock-node"
        offendingProperty="a mock prop"
        offendingValue="a mock value"
        onSubmit={mockOnSubmit}
      />,
      {
        wrapper: ({ children }) => <TestParent mocks={[mockSuccess]}>{children}</TestParent>,
      }
    );

    const button = getByRole("button", { name: /Request New PV/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(getByRole("dialog")).toBeInTheDocument();
    });

    const commentInput = within(getByRole("dialog")).queryByTestId("request-pv-description");

    userEvent.type(commentInput, "a mock value");
    fireEvent.blur(commentInput); // trigger validation

    await waitFor(() => {
      expect(within(getByRole("dialog")).getByRole("button", { name: /submit/i })).toBeEnabled();
    });

    userEvent.click(within(getByRole("dialog")).getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    expect(mockOnSubmit).toHaveBeenCalledWith("a mock prop", "a mock value");
  });

  it("should not call the onSubmit callback when the PV request operation fails", async () => {
    const mockOnSubmit = vi.fn();

    const mockSuccess: MockedResponse<RequestPVResponse, RequestPVInput> = {
      request: {
        query: REQUEST_PV,
      },
      variableMatcher: () => true,
      result: {
        data: {
          requestPV: {
            success: false,
            message: "",
          },
        },
      },
    };

    const { getByRole } = render(
      <Button
        nodeName="mock-node"
        offendingProperty="a mock prop"
        offendingValue="a mock value"
        onSubmit={mockOnSubmit}
      />,
      {
        wrapper: ({ children }) => <TestParent mocks={[mockSuccess]}>{children}</TestParent>,
      }
    );

    const button = getByRole("button", { name: /Request New PV/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(getByRole("dialog")).toBeInTheDocument();
    });

    const commentInput = within(getByRole("dialog")).queryByTestId("request-pv-description");

    userEvent.type(commentInput, "a mock value");
    fireEvent.blur(commentInput); // trigger validation

    await waitFor(() => {
      expect(within(getByRole("dialog")).getByRole("button", { name: /submit/i })).toBeEnabled();
    });

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      userEvent.click(within(getByRole("dialog")).getByRole("button", { name: /submit/i }));
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});

describe("Implementation Requirements", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should have a button labeled with 'Request New PV'", () => {
    const { getByRole } = render(
      <Button nodeName="mock-node" offendingProperty="a mock prop" offendingValue="a mock value" />,
      { wrapper: TestParent }
    );

    expect(getByRole("button", { name: /Request New PV/i })).toBeInTheDocument();
  });

  it("should have a tooltip only when the button is disabled", async () => {
    const { getByTestId, findByRole } = render(
      <Button
        nodeName="mock-node"
        offendingProperty="a mock prop"
        offendingValue="a mock value"
        disabled
      />,
      { wrapper: TestParent }
    );

    userEvent.hover(getByTestId("request-pv-button").parentElement); // Hover the span

    const tooltip = await findByRole("tooltip");

    expect(tooltip).toBeVisible();
    expect(tooltip).toHaveTextContent(
      "A request has already been submitted for this permissible value in this data submission."
    );

    userEvent.unhover(getByTestId("request-pv-button").parentElement);

    await waitFor(() => {
      expect(tooltip).not.toBeVisible();
    });
  });

  it("should display a success message when the request is successful", async () => {
    const mockSuccess: MockedResponse<RequestPVResponse, RequestPVInput> = {
      request: {
        query: REQUEST_PV,
      },
      variableMatcher: () => true,
      result: {
        data: {
          requestPV: {
            success: true,
            message: "",
          },
        },
      },
    };

    const { getByRole } = render(
      <Button nodeName="mock-node" offendingProperty="a mock prop" offendingValue="a mock value" />,
      {
        wrapper: ({ children }) => <TestParent mocks={[mockSuccess]}>{children}</TestParent>,
      }
    );

    const button = getByRole("button", { name: /Request New PV/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(getByRole("dialog")).toBeInTheDocument();
    });

    const commentInput = within(getByRole("dialog")).queryByTestId("request-pv-description");

    userEvent.type(commentInput, "a mock value");
    fireEvent.blur(commentInput); // trigger validation

    await waitFor(() => {
      expect(within(getByRole("dialog")).getByRole("button", { name: /submit/i })).toBeEnabled();
    });

    userEvent.click(within(getByRole("dialog")).getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Your request for a new permissible value has been submitted successfully.",
        { variant: "success" }
      );
    });
  });

  it("should label the dialog buttons as 'Cancel' and 'Submit'", async () => {
    const { getByRole } = render(
      <Button nodeName="mock-node" offendingProperty="a mock prop" offendingValue="a mock value" />,
      {
        wrapper: TestParent,
      }
    );

    const button = getByRole("button", { name: /Request New PV/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(getByRole("dialog")).toBeInTheDocument();
    });

    expect(within(getByRole("dialog")).getByRole("button", { name: /Cancel/ })).toBeInTheDocument();
    expect(within(getByRole("dialog")).getByRole("button", { name: /Submit/ })).toBeInTheDocument();
  });

  it("should require that the comment field is not empty", async () => {
    const { getByRole } = render(
      <Button nodeName="mock-node" offendingProperty="a mock prop" offendingValue="a mock value" />,
      {
        wrapper: TestParent,
      }
    );

    const button = getByRole("button", { name: /Request New PV/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(getByRole("dialog")).toBeInTheDocument();
    });

    expect(within(getByRole("dialog")).getByRole("button", { name: /Submit/ })).toBeDisabled();

    const commentInput = within(getByRole("dialog")).queryByTestId("request-pv-description");

    userEvent.type(commentInput, "a mock value");
    fireEvent.blur(commentInput); // trigger validation

    await waitFor(() => {
      expect(within(getByRole("dialog")).getByRole("button", { name: /Submit/ })).toBeEnabled();
    });
  });

  it("should display the property and term in the dialog", async () => {
    const { getByRole } = render(
      <Button
        nodeName="mock-node"
        offendingProperty="this_property_has_the_value"
        offendingValue="this_is_the_bad_value"
      />,
      {
        wrapper: TestParent,
      }
    );

    const button = getByRole("button", { name: /Request New PV/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(getByRole("dialog")).toBeInTheDocument();
    });

    expect(within(getByRole("dialog")).getByRole("textbox", { name: /Property/ })).toHaveValue(
      "this_property_has_the_value"
    );
    expect(within(getByRole("dialog")).getByRole("textbox", { name: /Term/ })).toHaveValue(
      "this_is_the_bad_value"
    );
  });

  it("should disable the property and term inputs in the dialog", async () => {
    const { getByRole } = render(
      <Button
        nodeName="mock-node"
        offendingProperty="this_property_has_the_value"
        offendingValue="this_is_the_bad_value"
      />,
      {
        wrapper: TestParent,
      }
    );

    const button = getByRole("button", { name: /Request New PV/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(getByRole("dialog")).toBeInTheDocument();
    });

    expect(within(getByRole("dialog")).getByRole("textbox", { name: /Property/ })).toHaveAttribute(
      "readonly"
    );
    expect(within(getByRole("dialog")).getByRole("textbox", { name: /Term/ })).toHaveAttribute(
      "readonly"
    );
  });

  it("should close the dialog when Cancel is pressed", async () => {
    const { getByRole, queryByRole } = render(
      <Button nodeName="mock-node" offendingProperty="a mock prop" offendingValue="a mock value" />,
      {
        wrapper: TestParent,
      }
    );

    const button = getByRole("button", { name: /Request New PV/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(getByRole("dialog")).toBeInTheDocument();
    });

    const cancelButton = within(getByRole("dialog")).getByRole("button", { name: /Cancel/ });
    userEvent.click(cancelButton);

    await waitFor(() => {
      expect(queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
