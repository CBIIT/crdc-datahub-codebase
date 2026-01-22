import { BrowserRouter } from "react-router-dom";
import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import FooterTablet from "./FooterTablet";

describe("Accessibility", () => {
  it("should not have any accessibility violations", async () => {
    const { container } = render(<FooterTablet />, {
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
      render(<FooterTablet />, {
        wrapper: (p) => (
          <BrowserRouter {...p} future={{ v7_startTransition: true, v7_relativeSplatPath: true }} />
        ),
      })
    ).not.toThrow();
  });
});
