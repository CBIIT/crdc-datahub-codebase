import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { render, TestRouter, waitFor } from "../../test-utils";

import SRFLink from "./index";

const routerWrapper = ({ children }: { children: React.ReactNode }) => (
  <TestRouter>{children}</TestRouter>
);

describe("Accessibility", () => {
  it("should have no violations when enabled", async () => {
    const { container, getByTestId } = render(<SRFLink appId="mock-app-id" />, {
      wrapper: routerWrapper,
    });

    expect(getByTestId("view-submission-request-form-button")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations when disabled", async () => {
    const { container, getByTestId } = render(<SRFLink appId="mock-app-id" disabled />, {
      wrapper: routerWrapper,
    });

    expect(getByTestId("view-submission-request-form-button")).toBeInTheDocument();
    expect(getByTestId("view-submission-request-form-button")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations when hidden", async () => {
    const { container, queryByTestId } = render(<SRFLink appId="" />, {
      wrapper: routerWrapper,
    });

    expect(queryByTestId("view-submission-request-form-button")).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render nothing when the appId is missing", async () => {
    const { queryByTestId } = render(<SRFLink appId="" />, {
      wrapper: routerWrapper,
    });

    await waitFor(() => {
      expect(queryByTestId("view-submission-request-form-button")).not.toBeInTheDocument();
    });
  });

  it("should render a link that opens in a new tab when enabled", () => {
    const { getByTestId } = render(<SRFLink appId="mock-app-id" />, {
      wrapper: routerWrapper,
    });

    expect(getByTestId("view-submission-request-form-button")).toHaveAttribute(
      "href",
      "/submission-request/mock-app-id"
    );
    expect(getByTestId("view-submission-request-form-button")).toHaveAttribute("target", "_blank");
  });

  it("should set aria-disabled when disabled", () => {
    const { getByTestId } = render(<SRFLink appId="mock-app-id" disabled />, {
      wrapper: routerWrapper,
    });

    expect(getByTestId("view-submission-request-form-button")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});

describe("Implementation Requirements", () => {
  it("should show the enabled tooltip copy on hover", async () => {
    const appId = "mock-app-id";
    const { getByTestId, findByRole } = render(<SRFLink appId={appId} />, {
      wrapper: routerWrapper,
    });

    userEvent.hover(getByTestId(`view-submission-request-form-tooltip-${appId}`));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeVisible();
    expect(tooltip).toHaveTextContent("Click to open the Submission Request Form for this study.");

    userEvent.unhover(getByTestId(`view-submission-request-form-tooltip-${appId}`));

    await waitFor(() => {
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  it("should show the disabled tooltip copy on hover", async () => {
    const appId = "mock-app-id";
    const { getByTestId, findByRole } = render(<SRFLink appId={appId} disabled />, {
      wrapper: routerWrapper,
    });

    userEvent.hover(getByTestId(`view-submission-request-form-tooltip-${appId}`));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeVisible();
    expect(tooltip).toHaveTextContent(
      "You don't have permission to view the Submission Request Form for this study."
    );

    userEvent.unhover(getByTestId(`view-submission-request-form-tooltip-${appId}`));

    await waitFor(() => {
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  it("should hide the icon when no SRF exists", () => {
    const { queryByTestId } = render(<SRFLink appId="" />, {
      wrapper: routerWrapper,
    });

    expect(queryByTestId("view-submission-request-form-button")).not.toBeInTheDocument();
  });
});
