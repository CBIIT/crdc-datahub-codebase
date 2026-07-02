import { axe } from "vitest-axe";

import { render, waitFor } from "../../test-utils";

import RichTextEditor from "./index";

vi.mock("./Controller", () => ({
  default: () => <div data-testid="rich-text-editor-controller">Controller</div>,
}));

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<RichTextEditor value="" onChange={vi.fn()} />);

    await waitFor(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() => render(<RichTextEditor value="" onChange={vi.fn()} />)).not.toThrow();
  });

  it("should render the Controller component", () => {
    const { getByTestId } = render(<RichTextEditor value="" onChange={vi.fn()} />);

    expect(getByTestId("rich-text-editor-controller")).toBeInTheDocument();
  });
});
