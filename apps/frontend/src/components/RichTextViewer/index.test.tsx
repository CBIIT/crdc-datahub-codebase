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
});
