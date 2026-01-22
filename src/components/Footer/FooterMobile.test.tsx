import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { axe } from "vitest-axe";

import { render, within } from "../../test-utils";

import FooterMobile from "./FooterMobile";

describe("Accessibility", () => {
  it("should not have any accessibility violations", async () => {
    const { container } = render(<FooterMobile />, {
      wrapper: (p) => (
        <BrowserRouter {...p} future={{ v7_startTransition: true, v7_relativeSplatPath: true }} />
      ),
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() =>
      render(<FooterMobile />, {
        wrapper: (p) => (
          <BrowserRouter {...p} future={{ v7_startTransition: true, v7_relativeSplatPath: true }} />
        ),
      })
    ).not.toThrow();
  });

  it("should toggle the expand of sections on click", () => {
    const { getAllByTestId } = render(<FooterMobile />, {
      wrapper: (p) => (
        <BrowserRouter {...p} future={{ v7_startTransition: true, v7_relativeSplatPath: true }} />
      ),
    });

    const allGroups = getAllByTestId("dropdown-section-group");

    userEvent.click(within(allGroups[0]).getByRole("button"));

    expect(within(allGroups[0]).getByTestId("dropdown-section-content")).toBeVisible();

    userEvent.click(within(allGroups[0]).getByRole("button"));

    expect(within(allGroups[0]).getByTestId("dropdown-section-content")).not.toBeVisible();
  });
});
