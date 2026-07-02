import { createEditor } from "slate";
import { withHistory } from "slate-history";
import { withReact } from "slate-react";

import { render } from "../../test-utils";

import Controller from "./Controller";

const mockReset = vi.fn();

vi.mock("./hooks/useRichTextEditor", () => ({
  useRichTextEditor: () => ({
    editor: withHistory(withReact(createEditor())),
    initialValue: [{ type: "paragraph", children: [{ text: "" }] }],
    handleChange: vi.fn(),
    handleKeyDown: vi.fn(),
    renderElement: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    renderLeaf: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    reset: mockReset,
  }),
}));

vi.mock("./Toolbar", () => ({
  default: () => <div data-testid="toolbar" />,
}));

describe("RichTextEditor Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render without crashing", () => {
    expect(() => render(<Controller value="" onChange={vi.fn()} />)).not.toThrow();
  });

  it("should render the toolbar when not disabled", () => {
    const { getByTestId } = render(<Controller value="" onChange={vi.fn()} />);

    expect(getByTestId("toolbar")).toBeInTheDocument();
  });

  it("should not render the toolbar when disabled", () => {
    const { queryByTestId } = render(<Controller value="" onChange={vi.fn()} disabled />);

    expect(queryByTestId("toolbar")).not.toBeInTheDocument();
  });

  it("should apply aria-label to the editable area", () => {
    const { getByRole } = render(
      <Controller value="" onChange={vi.fn()} aria-label="Comment input" />
    );

    expect(getByRole("textbox", { name: "Comment input" })).toBeInTheDocument();
  });

  it("should set the editable to read-only when disabled", () => {
    const { getByLabelText } = render(
      <Controller value="" onChange={vi.fn()} disabled aria-label="Comment input" />
    );

    expect(getByLabelText("Comment input")).toHaveAttribute("contenteditable", "false");
  });
});
