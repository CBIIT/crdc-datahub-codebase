import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import NotesView from "./NotesView";

describe("Accessibility", () => {
  it("should have no violations (nominal)", async () => {
    const { container } = render(<NotesView md="# Test markdown" />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations (error)", async () => {
    const { container } = render(<NotesView md={null} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() => render(<NotesView md="# Test markdown" />)).not.toThrow();
  });

  it("should render the markdown content", () => {
    const { getByText } = render(<NotesView md="# Test markdown" />);

    expect(getByText("Test markdown")).toBeInTheDocument();
  });

  it("should render an error message when no markdown is provided", () => {
    const { getByText } = render(<NotesView md={null} />);

    expect(getByText("An error occurred while loading the Release Notes")).toBeInTheDocument();
  });
});
