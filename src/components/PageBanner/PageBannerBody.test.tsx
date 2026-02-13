import userEvent from "@testing-library/user-event";
import React from "react";
import { axe } from "vitest-axe";

import { TestRouter, render } from "../../test-utils";

import PageBannerBody from "./PageBannerBody";

type Props = {
  children: React.ReactNode;
};
const TestParent: React.FC<Props> = ({ children }) => <TestRouter>{children}</TestRouter>;

describe("Accessibility", () => {
  const label = "Click Here";
  const to = "/target";

  it("has no accessibility violations", async () => {
    const { container } = render(
      <TestParent>
        <PageBannerBody label={label} to={to} />
      </TestParent>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("PageBannerBody Component", () => {
  const label = "Click Here";
  const to = "/target";

  it("renders the button with the provided label", () => {
    const { getByTestId } = render(
      <TestParent>
        <PageBannerBody label={label} to={to} />
      </TestParent>
    );

    const button = getByTestId("page-banner-body-link");
    expect(button).toBeInTheDocument();
  });

  it("renders a link with the correct href attribute", () => {
    const { getByTestId } = render(
      <TestParent>
        <PageBannerBody label={label} to={to} />
      </TestParent>
    );

    const linkElement = getByTestId("page-banner-body-link");
    expect(linkElement).toHaveAttribute("href", to);
  });

  it("navigates when clicked", async () => {
    const { getByTestId } = render(
      <TestParent>
        <PageBannerBody label={label} to={to} />
      </TestParent>
    );

    const linkElement = getByTestId("page-banner-body-link");
    userEvent.click(linkElement);
    expect(linkElement).toHaveAttribute("href", to);
  });
});
