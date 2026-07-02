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

  it("should strip style attributes from allowed elements", () => {
    const { container } = render(
      <RichTextViewer content='<u style="background:red;color:red">text</u>' />
    );

    expect(container.querySelector("u")).toBeInTheDocument();
    expect(container.querySelector("u")).not.toHaveAttribute("style");
  });

  it("should strip event handler attributes from allowed elements", () => {
    const { container } = render(<RichTextViewer content='<p onmouseover="alert(1)">text</p>' />);

    const p = container.querySelector("p");

    expect(p).toBeInTheDocument();
    expect(p?.getAttribute("onmouseover")).toBeNull();
  });

  it("should strip class attributes from allowed elements", () => {
    const { container } = render(<RichTextViewer content='<p class="injected">text</p>' />);

    expect(container.querySelector("p")).not.toHaveAttribute("class");
  });

  it("should render a single dash as text, not as a bullet list item", () => {
    const { getByText, container } = render(<RichTextViewer content="-" />);

    expect(getByText("-")).toBeInTheDocument();
    expect(container.querySelector("li")).not.toBeInTheDocument();
  });

  it("should render a double dash as text", () => {
    const { getByText } = render(<RichTextViewer content="--" />);

    expect(getByText("--")).toBeInTheDocument();
  });

  it("should render a triple dash as text and not disappear", () => {
    const { getByText, container } = render(<RichTextViewer content="---" />);

    expect(getByText("---")).toBeInTheDocument();
    expect(container.querySelector("hr")).not.toBeInTheDocument();
  });

  it("should render four or more dashes as text and not disappear", () => {
    const { getByText } = render(<RichTextViewer content="----" />);

    expect(getByText("----")).toBeInTheDocument();
  });

  it("should still render a list item as a bullet", () => {
    const { container } = render(<RichTextViewer content="- item" />);

    expect(container.querySelector("li")).toBeInTheDocument();
    expect(container.querySelector("li")).toHaveTextContent("item");
  });
});
