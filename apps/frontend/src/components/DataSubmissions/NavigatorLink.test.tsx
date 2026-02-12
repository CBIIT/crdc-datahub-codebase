import React from "react";
import { axe } from "vitest-axe";

import { TestRouter, render } from "../../test-utils";

import NavigatorLink, { NavigatorLinkProps } from "./NavigatorLink";

type TestParentProps = {
  children: React.ReactNode;
};

const TestParent: React.FC<TestParentProps> = ({ children }) => <TestRouter>{children}</TestRouter>;

describe("Accessibility", () => {
  it("should not have any violations", async () => {
    const { container, getByTestId } = render(
      <NavigatorLink
        submission={{ status: "New", dataCommonsDisplayName: "test", modelVersion: "1.0.0" }}
      />,
      {
        wrapper: TestParent,
      }
    );

    expect(getByTestId("navigator-link")).toBeInTheDocument(); // Sanity check
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have any violations when disabled", async () => {
    const { container, getByTestId } = render(
      <NavigatorLink
        submission={{ status: "Canceled", dataCommonsDisplayName: "", modelVersion: "" }}
      />, // Disabled by invalid status and empty props
      {
        wrapper: TestParent,
      }
    );

    expect(getByTestId("navigator-link-disabled")).toBeInTheDocument(); // Sanity check
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should prepend a 'v' to the version if it is missing", () => {
    const { getByText } = render(
      <NavigatorLink
        submission={{ status: "New", dataCommonsDisplayName: "test", modelVersion: "1.0.0" }}
      />,
      {
        wrapper: TestParent,
      }
    );

    expect(getByText("v1.0.0")).toBeInTheDocument();
  });

  it("should not prepend a 'v' to the version if it is present already", () => {
    const { getByText } = render(
      <NavigatorLink
        submission={{ status: "New", dataCommonsDisplayName: "test", modelVersion: "v1.0.0" }}
      />,
      {
        wrapper: TestParent,
      }
    );

    expect(getByText("v1.0.0")).toBeInTheDocument();
  });

  it("should not crash when the submission object is null", () => {
    expect(() =>
      render(<NavigatorLink submission={null as NavigatorLinkProps["submission"]} />, {
        wrapper: TestParent,
      })
    ).not.toThrow();
  });

  it("should not generate a link with invalid dependent props", () => {
    const { getByTestId, rerender } = render(
      <NavigatorLink
        submission={{ status: "New", dataCommonsDisplayName: "", modelVersion: "1.0.0" }}
      />,
      {
        wrapper: TestParent,
      }
    );

    expect(getByTestId("navigator-link-disabled")).toBeInTheDocument(); // Bad DC

    rerender(
      <NavigatorLink
        submission={{ status: "In Progress", dataCommonsDisplayName: "valid", modelVersion: "" }}
      />
    );

    expect(getByTestId("navigator-link-disabled")).toBeInTheDocument(); // Bad Version
  });
});

describe("Implementation Requirements", () => {
  it("should render a hyperlink with the correct href", () => {
    const { getByTestId } = render(
      <NavigatorLink
        submission={{ status: "New", dataCommonsDisplayName: "test", modelVersion: "1.0.0" }}
      />,
      {
        wrapper: TestParent,
      }
    );

    expect(getByTestId("navigator-link")).toHaveAttribute("href", "/model-navigator/test/1.0.0");
  });

  it("should render a hyperlink with a target of '_blank'", () => {
    const { getByTestId } = render(
      <NavigatorLink
        submission={{ status: "New", dataCommonsDisplayName: "test", modelVersion: "1.0.0" }}
      />,
      {
        wrapper: TestParent,
      }
    );

    expect(getByTestId("navigator-link")).toHaveAttribute("target", "_blank");
  });

  it.each<SubmissionStatus>([
    "New",
    "In Progress",
    "Withdrawn",
    "Submitted",
    "Released",
    "Completed",
    "Rejected",
  ])("should be enabled when the status is %s", (status) => {
    const { getByTestId } = render(
      <NavigatorLink
        submission={{ status, dataCommonsDisplayName: "test", modelVersion: "1.0.0" }}
      />,
      {
        wrapper: TestParent,
      }
    );

    expect(getByTestId("navigator-link")).toBeInTheDocument();
  });

  it.each<SubmissionStatus>(["Canceled", "Deleted"])(
    "should be disabled when the status is %s",
    (status) => {
      const { getByTestId } = render(
        <NavigatorLink
          submission={{ status, dataCommonsDisplayName: "test", modelVersion: "1.0.0" }}
        />,
        {
          wrapper: TestParent,
        }
      );

      expect(getByTestId("navigator-link-disabled")).toBeInTheDocument();
    }
  );
});
