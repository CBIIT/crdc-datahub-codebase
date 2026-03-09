import { axe } from "vitest-axe";

import { breadcrumbEntryFactory } from "@/factories/navigation/BreadcrumbEntryFactory";

import { TestRouter, render } from "../../test-utils";

import NavigationBreadcrumbs, { BreadcrumbEntry } from "./index";

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const entries: BreadcrumbEntry[] = [
      breadcrumbEntryFactory.build({ label: "link item", to: "/link-item" }),
      breadcrumbEntryFactory.build({ label: "non-link" }),
    ];

    const { container } = render(<NavigationBreadcrumbs entries={entries} />, {
      wrapper: TestRouter,
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() =>
      render(<NavigationBreadcrumbs entries={[]} />, {
        wrapper: TestRouter,
      })
    ).not.toThrow();
  });

  it("should render the correct number of breadcrumbs", () => {
    const entries: BreadcrumbEntry[] = [
      breadcrumbEntryFactory.build({ label: "Home", to: "/" }),
      breadcrumbEntryFactory.build({ label: "Data Explorer", to: "/data-explorer" }),
      breadcrumbEntryFactory.build({ label: "Study View", to: "/data-explorer/study-view" }),
      breadcrumbEntryFactory.build({
        label: "Metadata Details",
        to: "/data-explorer/study-view/metadata-details",
      }),
    ];

    const { getAllByTestId } = render(<NavigationBreadcrumbs entries={entries} />, {
      wrapper: TestRouter,
    });

    expect(getAllByTestId(/breadcrumb-entry/i)).toHaveLength(4);
  });

  it("should support entries that are not links", async () => {
    const entries: BreadcrumbEntry[] = [
      breadcrumbEntryFactory.build({ label: "Home" }),
      breadcrumbEntryFactory.build({ label: "Products" }),
      breadcrumbEntryFactory.build({ label: "Electronics" }),
    ];

    const { queryAllByRole } = render(<NavigationBreadcrumbs entries={entries} />, {
      wrapper: TestRouter,
    });

    expect(queryAllByRole("link")).toHaveLength(0);
  });

  it("should style links correctly", () => {
    const entries: BreadcrumbEntry[] = [
      breadcrumbEntryFactory.build({ label: "Some Page", to: "/some-page" }),
    ];

    const { getByTestId } = render(<NavigationBreadcrumbs entries={entries} />, {
      wrapper: TestRouter,
    });

    expect(getByTestId("breadcrumb-entry-0")).toHaveStyle("color: #005EA2");
  });

  it("should style non-link items correctly", () => {
    const entries: BreadcrumbEntry[] = [breadcrumbEntryFactory.build({ label: "Non-Link Item" })];

    const { getByTestId } = render(<NavigationBreadcrumbs entries={entries} />, {
      wrapper: TestRouter,
    });

    expect(getByTestId("breadcrumb-entry-0")).toHaveStyle("color: #1B1B1B");
  });

  it("should support rerendering with different entries", () => {
    const initialEntries: BreadcrumbEntry[] = [breadcrumbEntryFactory.build({ label: "Initial" })];
    const newEntries: BreadcrumbEntry[] = [breadcrumbEntryFactory.build({ label: "Updated" })];

    const { rerender, getByTestId } = render(<NavigationBreadcrumbs entries={initialEntries} />, {
      wrapper: TestRouter,
    });

    expect(getByTestId("breadcrumb-entry-0")).toHaveTextContent("Initial");

    rerender(<NavigationBreadcrumbs entries={newEntries} />);

    expect(getByTestId("breadcrumb-entry-0")).toHaveTextContent("Updated");
  });
});

describe("Snapshots", () => {
  it("should match the snapshot", () => {
    const entries: BreadcrumbEntry[] = [
      breadcrumbEntryFactory.build({ label: "Home", to: "/" }),
      breadcrumbEntryFactory.build({ label: "Data Explorer", to: "/data-explorer" }),
      breadcrumbEntryFactory.build({ label: "Study View", to: "/data-explorer/study-view" }),
      breadcrumbEntryFactory.build({
        label: "Metadata Details",
        to: "/data-explorer/study-view/metadata-details",
      }),
    ];

    const { container } = render(<NavigationBreadcrumbs entries={entries} />, {
      wrapper: TestRouter,
    });

    expect(container).toMatchSnapshot();
  });
});
