import { FC, ReactNode } from "react";
import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import EditorLeaf from "./EditorLeaf";

const baseProps = {
  attributes: { "data-slate-leaf": true } as never,
  text: { text: "" },
};

const TestParent: FC<{ children: ReactNode; leaf?: Record<string, unknown> }> = ({
  children,
  leaf = {},
}) => (
  <EditorLeaf {...baseProps} leaf={{ text: "", ...leaf }} text={{ text: "" }}>
    {children}
  </EditorLeaf>
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

  it("should render plain text without marks", () => {
    const { container } = render(<TestParent>Hello</TestParent>);

    expect(container.querySelector("strong")).not.toBeInTheDocument();
    expect(container.querySelector("em")).not.toBeInTheDocument();
    expect(container.querySelector("u")).not.toBeInTheDocument();
    expect(container).toHaveTextContent("Hello");
  });

  it("should wrap text in <strong> when bold is true", () => {
    const { container } = render(<TestParent leaf={{ bold: true }}>Hello</TestParent>);

    expect(container.querySelector("strong")).toBeInTheDocument();
  });

  it("should wrap text in <em> when italic is true", () => {
    const { container } = render(<TestParent leaf={{ italic: true }}>Hello</TestParent>);

    expect(container.querySelector("em")).toBeInTheDocument();
  });

  it("should wrap text in <u> when underline is true", () => {
    const { container } = render(<TestParent leaf={{ underline: true }}>Hello</TestParent>);

    expect(container.querySelector("u")).toBeInTheDocument();
  });

  it("should nest all marks when bold, italic, and underline are true", () => {
    const { container } = render(
      <TestParent leaf={{ bold: true, italic: true, underline: true }}>Hello</TestParent>
    );

    expect(container.querySelector("strong")).toBeInTheDocument();
    expect(container.querySelector("em")).toBeInTheDocument();
    expect(container.querySelector("u")).toBeInTheDocument();
    expect(container).toHaveTextContent("Hello");
  });
});
