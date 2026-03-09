import { BrowserRouter } from "react-router-dom";
import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import FooterDesktop from "./FooterDesktop";

describe("Accessibility", () => {
  it("should not have any accessibility violations", async () => {
    const { container } = render(<FooterDesktop />, {
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
      render(<FooterDesktop />, {
        wrapper: (p) => (
          <BrowserRouter {...p} future={{ v7_startTransition: true, v7_relativeSplatPath: true }} />
        ),
      })
    ).not.toThrow();
  });
});
