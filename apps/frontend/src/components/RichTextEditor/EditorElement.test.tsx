import { FC, ReactNode } from "react";
import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import EditorElement from "./EditorElement";

const baseAttributes = { "data-slate-node": "element" } as never;

const TestParent: FC<{ children: ReactNode; type?: string }> = ({
  children,
  type = "paragraph",
}) => (
  <EditorElement attributes={baseAttributes} element={{ type, children: [] } as never}>
    {children}
  </EditorElement>
);

describe("Accessibility", () => {
  it("should not have any accessibility violations", async () => {
    const { container } = render(<TestParent>Hello</TestParent>);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", () => {
    expect(() => render(<TestParent>Hello</TestParent>)).not.toThrow();
  });

  it("should render a paragraph by default", () => {
    const { container } = render(<TestParent>Hello</TestParent>);

    expect(container.querySelector("p")).toBeInTheDocument();
    expect(container).toHaveTextContent("Hello");
  });

  it("should render a <ul> for bulleted-list", () => {
    const { container } = render(<TestParent type="bulleted-list">Item</TestParent>);

    expect(container.querySelector("ul")).toBeInTheDocument();
  });

  it("should render an <ol> for numbered-list", () => {
    const { container } = render(<TestParent type="numbered-list">Item</TestParent>);

    expect(container.querySelector("ol")).toBeInTheDocument();
  });

  it("should render an <li> for list-item", () => {
    const { container } = render(
      <ul>
        <TestParent type="list-item">Item</TestParent>
      </ul>
    );

    expect(container.querySelector("li")).toBeInTheDocument();
  });

  it("should fall back to a paragraph for an unknown type", () => {
    const { container } = render(<TestParent type={"unknown" as never}>Hello</TestParent>);

    expect(container.querySelector("p")).toBeInTheDocument();
    expect(container).toHaveTextContent("Hello");
  });
});
