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

  it("should have no accessibility violations when rendering links", async () => {
    const { container } = render(<RichTextViewer content="visit [Google](https://google.com)" />);

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

  it("should render a markdown link as an anchor", () => {
    const { getByRole } = render(<RichTextViewer content="visit [Google](https://google.com)" />);

    expect(getByRole("link", { name: "Google" })).toHaveAttribute("href", "https://google.com/");
  });

  it("should open links in a new tab without leaking the opener", () => {
    const { getByRole } = render(<RichTextViewer content="[Google](https://google.com)" />);

    const link = getByRole("link", { name: "Google" });

    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("should render links inside list items alongside other formatting", () => {
    const { container, getByRole } = render(
      <RichTextViewer content="- **see** [g](https://g.co)" />
    );

    expect(container.querySelector("li strong")).toHaveTextContent("see");
    expect(getByRole("link", { name: "g" })).toBeInTheDocument();
  });

  it("should keep percent-encoded characters in the link URL", () => {
    const { getByRole } = render(<RichTextViewer content="[g](https://g.co/a%281%29)" />);

    expect(getByRole("link", { name: "g" })).toHaveAttribute("href", "https://g.co/a%281%29");
  });

  it("should render link text without a link when the URL uses an unsafe scheme", () => {
    const { getByText, queryByRole } = render(
      <RichTextViewer content="[click](javascript:alert(1)) me" />
    );

    expect(getByText(/click/)).toBeInTheDocument();
    expect(queryByRole("link")).not.toBeInTheDocument();
  });

  it("should render link text without a link when the URL is relative", () => {
    const { getByText, queryByRole } = render(<RichTextViewer content="[report](/admin/report)" />);

    expect(getByText("report")).toBeInTheDocument();
    expect(queryByRole("link")).not.toBeInTheDocument();
  });

  it("should neutralize raw HTML anchors with an unsafe href", () => {
    const { getByText, queryByRole } = render(
      <RichTextViewer content='<a href="javascript:alert(1)">raw</a> text' />
    );

    expect(getByText(/raw/)).toBeInTheDocument();
    expect(queryByRole("link")).not.toBeInTheDocument();
  });

  it("should strip event handler and style attributes from raw HTML anchors", () => {
    const { getByRole } = render(
      <RichTextViewer content='<a href="https://g.co" onclick="alert(1)" style="color:red">raw</a>' />
    );

    const link = getByRole("link", { name: "raw" });

    expect(link).not.toHaveAttribute("style");
    expect(link.getAttribute("onclick")).toBeNull();
  });

  it("should not treat escaped brackets as a link", () => {
    const { getByText, queryByRole } = render(
      <RichTextViewer content="literal \\[brackets\\] here" />
    );

    expect(getByText("literal \\[brackets\\] here")).toBeInTheDocument();
    expect(queryByRole("link")).not.toBeInTheDocument();
  });
});
