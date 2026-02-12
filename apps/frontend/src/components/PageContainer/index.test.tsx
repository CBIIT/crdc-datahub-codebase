import React from "react";
import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import PageContainer, { PageContainerProps } from "./index";

const defaultProps: Pick<PageContainerProps, "background" | "children"> = {
  background: "mock-background.jpg",
  children: <div data-testid="page-content">Page Content</div>,
};

describe("Accessibility", () => {
  it("has no accessibility violations (title)", async () => {
    const { container } = render(<PageContainer {...defaultProps} title="mock title" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations (title, suffix, description)", async () => {
    const { container } = render(
      <PageContainer
        {...defaultProps}
        title="mock title here"
        titleSuffix="Suffix"
        description="This is a description"
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render the title", () => {
    const { getByTestId } = render(<PageContainer {...defaultProps} title="Test Title" />);

    expect(getByTestId("page-container-header-title")).toHaveTextContent("Test Title");
  });

  it("should render the title suffix if provided", () => {
    const { getByTestId } = render(
      <PageContainer {...defaultProps} title="A Title - " titleSuffix="Suffix" />
    );

    expect(getByTestId("page-container-header-suffix")).toHaveTextContent("Suffix");
  });

  it("does not render the title suffix if not provided", () => {
    const { queryByTestId } = render(<PageContainer {...defaultProps} title="No Suffix" />);

    expect(queryByTestId("page-container-header-suffix")).not.toBeInTheDocument();
  });

  it("should render the description if provided", () => {
    const { getByTestId } = render(
      <PageContainer {...defaultProps} title="Title for Desc" description="This is a description" />
    );

    expect(getByTestId("page-container-header-description")).toHaveTextContent(
      "This is a description"
    );
  });

  it("does not render the description if not provided", () => {
    const { queryByTestId } = render(<PageContainer {...defaultProps} title="No Desc" />);

    expect(queryByTestId("page-container-header-description")).toBeNull();
  });

  it("should render children", () => {
    const { getByTestId, getByText } = render(
      <PageContainer {...defaultProps} title="some title" />
    );

    expect(getByTestId("page-content")).toBeInTheDocument();
    expect(getByText("Page Content")).toBeVisible();
  });

  it("applies the background image", () => {
    const { getByTestId } = render(<PageContainer {...defaultProps} title="has a BG" />);

    expect(getByTestId("page-container-wrapper")).toHaveStyle({
      backgroundImage: `url(${defaultProps.background})`,
    });
  });
});
