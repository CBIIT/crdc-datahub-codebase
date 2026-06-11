import { axe } from "vitest-axe";

import { render, waitFor } from "../../test-utils";

import RichTextViewer from "./index";

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<RichTextViewer content="**hello**" />);

    await waitFor(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() => render(<RichTextViewer content="**hello**" />)).not.toThrow();
  });

  it("should render markdown content", () => {
    const { getByText } = render(<RichTextViewer content="**hello**" />);

    expect(getByText("hello")).toBeInTheDocument();
  });

  it("should not render when content is empty", () => {
    const { container } = render(<RichTextViewer content="   " />);

    expect(container).toBeEmptyDOMElement();
  });
});
