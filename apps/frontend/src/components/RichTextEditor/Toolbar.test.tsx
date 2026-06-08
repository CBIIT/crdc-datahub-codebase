import userEvent from "@testing-library/user-event";
import { FC, ReactNode } from "react";
import { createEditor, Descendant } from "slate";
import { withHistory } from "slate-history";
import { Slate, withReact } from "slate-react";
import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import Toolbar from "./Toolbar";
import { isBlockActive, isMarkActive, toggleBlock, toggleMark } from "./utils/editorTransforms";

vi.mock("./utils/editorTransforms", () => ({
  isMarkActive: vi.fn().mockReturnValue(false),
  isBlockActive: vi.fn().mockReturnValue(false),
  toggleMark: vi.fn(),
  toggleBlock: vi.fn(),
}));

const initialValue: Descendant[] = [{ type: "paragraph", children: [{ text: "" }] }];

const TestParent: FC<{ children: ReactNode }> = ({ children }) => {
  const editor = withHistory(withReact(createEditor()));

  return (
    <Slate editor={editor} initialValue={initialValue}>
      {children}
    </Slate>
  );
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should not have any accessibility violations", async () => {
    const { container } = render(<Toolbar />, { wrapper: TestParent });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", () => {
    const { getByTestId } = render(<Toolbar />, { wrapper: TestParent });

    expect(getByTestId("rich-text-editor-toolbar")).toBeInTheDocument();
  });

  it("should render all mark buttons", () => {
    const { getByRole } = render(<Toolbar />, { wrapper: TestParent });

    expect(getByRole("button", { name: "Bold (Ctrl+B)" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Italic (Ctrl+I)" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Underline (Ctrl+U)" })).toBeInTheDocument();
  });

  it("should render all block buttons", () => {
    const { getByRole } = render(<Toolbar />, { wrapper: TestParent });

    expect(getByRole("button", { name: "Bullet List" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Numbered List" })).toBeInTheDocument();
  });

  it("should render undo and redo buttons", () => {
    const { getByRole } = render(<Toolbar />, { wrapper: TestParent });

    expect(getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Redo" })).toBeInTheDocument();
  });

  it("should disable undo when there is no history", () => {
    const { getByRole } = render(<Toolbar />, { wrapper: TestParent });

    expect(getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("should disable redo when there is no redo history", () => {
    const { getByRole } = render(<Toolbar />, { wrapper: TestParent });

    expect(getByRole("button", { name: "Redo" })).toBeDisabled();
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should call toggleMark with 'bold' when the bold button is clicked", async () => {
    const { getByRole } = render(<Toolbar />, { wrapper: TestParent });

    userEvent.click(getByRole("button", { name: "Bold (Ctrl+B)" }));

    expect(toggleMark).toHaveBeenCalledWith(expect.anything(), "bold");
  });

  it("should call toggleMark with 'italic' when the italic button is clicked", async () => {
    const { getByRole } = render(<Toolbar />, { wrapper: TestParent });

    userEvent.click(getByRole("button", { name: "Italic (Ctrl+I)" }));

    expect(toggleMark).toHaveBeenCalledWith(expect.anything(), "italic");
  });

  it("should call toggleMark with 'underline' when the underline button is clicked", async () => {
    const { getByRole } = render(<Toolbar />, { wrapper: TestParent });

    userEvent.click(getByRole("button", { name: "Underline (Ctrl+U)" }));

    expect(toggleMark).toHaveBeenCalledWith(expect.anything(), "underline");
  });

  it("should call toggleBlock with 'bulleted-list' when the bullet list button is clicked", async () => {
    const { getByRole } = render(<Toolbar />, { wrapper: TestParent });

    userEvent.click(getByRole("button", { name: "Bullet List" }));

    expect(toggleBlock).toHaveBeenCalledWith(expect.anything(), "bulleted-list");
  });

  it("should call toggleBlock with 'numbered-list' when the numbered list button is clicked", async () => {
    const { getByRole } = render(<Toolbar />, { wrapper: TestParent });

    userEvent.click(getByRole("button", { name: "Numbered List" }));

    expect(toggleBlock).toHaveBeenCalledWith(expect.anything(), "numbered-list");
  });

  it("should check if the bold mark is active", () => {
    render(<Toolbar />, { wrapper: TestParent });

    expect(isMarkActive).toHaveBeenCalledWith(expect.anything(), "bold");
  });

  it("should check if the italic mark is active", () => {
    render(<Toolbar />, { wrapper: TestParent });

    expect(isMarkActive).toHaveBeenCalledWith(expect.anything(), "italic");
  });

  it("should check if the underline mark is active", () => {
    render(<Toolbar />, { wrapper: TestParent });

    expect(isMarkActive).toHaveBeenCalledWith(expect.anything(), "underline");
  });

  it("should check if the bulleted-list block is active", () => {
    render(<Toolbar />, { wrapper: TestParent });

    expect(isBlockActive).toHaveBeenCalledWith(expect.anything(), "bulleted-list");
  });

  it("should check if the numbered-list block is active", () => {
    render(<Toolbar />, { wrapper: TestParent });

    expect(isBlockActive).toHaveBeenCalledWith(expect.anything(), "numbered-list");
  });
});
