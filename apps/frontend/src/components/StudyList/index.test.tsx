import userEvent from "@testing-library/user-event";
import React from "react";
import { axe } from "vitest-axe";

import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";

import { render, within } from "../../test-utils";

import StudyList from "./index";

describe("Accessibility", () => {
  it.each<[string, Partial<ApprovedStudy>[]]>([
    ["no studies", []],
    ["single study", [{ _id: "mock-1", studyName: "mock-1", studyAbbreviation: "mock-1-abr" }]],
    [
      "multiple studies",
      [
        { _id: "mock-1", studyName: "mock-1", studyAbbreviation: "mock-1-abr" },
        { _id: "mock-2", studyName: "mock-2", studyAbbreviation: "mock-2-abr" },
      ],
    ],
    ["ALL study", [{ _id: "All", studyName: "All", studyAbbreviation: "All" }]],
  ])("should have no violations (%s)", async (_, studies) => {
    const { container } = render(<StudyList studies={studies} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Implementation Requirements", () => {
  it("should render 'All' when the studies prop contains a study with `_id` of 'All'", () => {
    const { getByText } = render(
      <StudyList
        studies={[
          approvedStudyFactory
            .pick(["_id", "studyName", "studyAbbreviation"])
            .build({ _id: "All", studyName: "All" }),
          approvedStudyFactory
            .pick(["_id", "studyName", "studyAbbreviation"])
            .build({ _id: "mock-study", studyName: "Should Not Be Visible" }),
        ]}
      />
    );

    expect(getByText("All")).toBeInTheDocument();
    expect(() => getByText("Should Not Be Visible")).toThrow();
  });

  it("should render 'None.' when the studies prop is an empty array", () => {
    const { getByText } = render(<StudyList studies={[]} />);

    expect(getByText("None.")).toBeInTheDocument();
  });

  it.each([null, undefined])(
    "should render 'None.' when the studies prop is not an array (%s)",
    (studies) => {
      const { getByText } = render(<StudyList studies={studies} />);

      expect(getByText("None.")).toBeInTheDocument();
    }
  );

  it("should render the abbreviation of the first study when only one study is provided", () => {
    const studies = [
      approvedStudyFactory.pick(["_id", "studyName", "studyAbbreviation"]).build({
        _id: "mock-1-id",
        studyName: "mock-1-name",
        studyAbbreviation: "A very nice abbr",
      }),
      approvedStudyFactory.pick(["_id", "studyName", "studyAbbreviation"]).build({
        _id: "mock-2-id",
        studyName: "mock-2-name",
        studyAbbreviation: "not a nice abbr",
      }),
    ];

    const { getByText } = render(<StudyList studies={studies} />);

    expect(getByText(/a very nice abbr/i)).toBeVisible();
  });

  it("should render the name of the first study when the study abbreviation is not available", () => {
    const studies = approvedStudyFactory
      .pick(["_id", "studyName", "studyAbbreviation"])
      .build(2, (index) => ({ _id: `mock-${index + 1}-id`, studyName: `mock-${index + 1}-name` }));

    const { getByText } = render(<StudyList studies={studies} />);

    expect(getByText(/mock-1-name/)).toBeVisible();
  });

  it("should render a tooltip with the full list of studies when there are multiple studies", async () => {
    const studies = approvedStudyFactory
      .pick(["_id", "studyName", "studyAbbreviation"])
      .build(2, (index) => ({
        _id: `mock-${index + 1}-id`,
        studyName: `mock-${index + 1}-name`,
        studyAbbreviation: `mock-${index + 1}-abr`,
      }));

    const { findByRole, getByTestId } = render(<StudyList studies={studies} />);

    userEvent.hover(getByTestId("study-list-other-count"));

    const tooltip = await findByRole("tooltip");

    // NOTE: Only asserting that the study is there
    expect(within(tooltip).getByTestId("mock-1-id")).toBeVisible();
    expect(within(tooltip).getByTestId("mock-2-id")).toBeVisible();
  });

  it("should display the count of studies when there are multiple studies", () => {
    const studies = approvedStudyFactory
      .pick(["_id", "studyName", "studyAbbreviation"])
      .build(10, (index) => ({
        _id: `mock-${index + 1}-id`,
        studyName: `mock-${index + 1}-name`,
      }));

    const { getByTestId } = render(<StudyList studies={studies} />);

    expect(getByTestId("study-list-other-count")).toHaveTextContent("other 9");
  });
});
