import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { render, waitFor } from "../../test-utils";

import CustomTick from "./CustomTick";

const mockTitleCase = vi.fn();
vi.mock("../../utils", async () => ({
  ...(await vi.importActual("../../utils")),
  titleCase: (...args) => mockTitleCase(...args),
}));

const originalTitleCase = (await vi.importActual<typeof import("../../utils")>("../../utils"))
  .titleCase;
beforeEach(async () => {
  mockTitleCase.mockImplementation(originalTitleCase);
});

const TestParent = ({ children }) => <svg>{children}</svg>;

describe("Accessibility", () => {
  it("should not have any accessibility violations", async () => {
    const { container } = render(<CustomTick x={0} y={25} payload={{ value: "node456" }} />, {
      wrapper: TestParent,
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("renders without crashing", () => {
    const { container } = render(<CustomTick x={0} y={25} payload={{ value: "" }} />, {
      wrapper: TestParent,
    });
    expect(container).toBeInTheDocument();
  });

  it("renders without crashing (null payload)", () => {
    const { container } = render(<CustomTick x={0} y={25} payload={null} />, {
      wrapper: TestParent,
    });
    expect(container).toBeInTheDocument();
  });
});

describe("Implementation Requirements", () => {
  it.each<[input: string, expected: string]>([
    ["node_name", "node name"],
    ["", ""],
    [" long node name ", "long node name"],
    ["genomic_info", "genomic info"],
    ["multiple_under_scores", "multiple under scores"],
    [null, ""],
  ])("should call titleCase after reformatting %p to %p", (input, output) => {
    render(<CustomTick x={0} y={25} payload={{ value: input }} angled />, {
      wrapper: TestParent,
    });

    expect(mockTitleCase).toHaveBeenCalledWith(output);
  });

  it("should render the tick label with the correct text", async () => {
    const { findByText } = render(<CustomTick x={0} y={25} payload={{ value: "node1" }} />, {
      wrapper: TestParent,
    });

    expect(await findByText("Node1")).toBeInTheDocument();
  });

  it.each<[input: string, expected: string, maxLen: number]>([
    // Default label lengths
    ["node1", "Node1", 8],
    ["sample", "Sample", 8],
    ["genomic_info", "Genomic...", 8],
    ["multiple_under_scores", "Multiple...", 8],
    // Non-default label lengths
    ["hello world", "Hello...", 5],
    ["long node name", "Long Node Name", 20],
  ])(
    "should render the original tick label %p as %p if it exceeds the label length of %p",
    async (input, expected, maxLength) => {
      const { findByText } = render(
        <CustomTick x={0} y={25} payload={{ value: input }} labelLength={maxLength} angled />,
        {
          wrapper: TestParent,
        }
      );

      expect(await findByText(expected)).toBeInTheDocument();
    }
  );

  it("should rotate the tick label by 65 degrees if `angled` is specified", async () => {
    const { container } = render(<CustomTick x={0} y={25} payload={{ value: "node1" }} angled />, {
      wrapper: TestParent,
    });

    const text = container.querySelector("text");
    expect(text.parentElement).toHaveAttribute("transform", "rotate(65)");
  });

  it("should not rotate the tick label if `angled` is not specified", async () => {
    const { container } = render(<CustomTick x={0} y={25} payload={{ value: "node1" }} />, {
      wrapper: TestParent,
    });

    const text = container.querySelector("text");
    expect(text.parentElement).not.toHaveAttribute("transform");
  });

  it("should break the tick label into multiple lines if `angled` is not specified", async () => {
    const { container } = render(
      <CustomTick x={0} y={25} payload={{ value: "long node name" }} />,
      {
        wrapper: TestParent,
      }
    );

    const text = container.querySelector("text");
    expect(text.children).toHaveLength(3);
  });

  it("should call onMouseEnter when the mouse enters the tick label", async () => {
    const handleMouseEnter = vi.fn();
    const { container } = render(
      <CustomTick
        x={226}
        y={19}
        payload={{ value: "my node" }}
        handleMouseEnter={handleMouseEnter}
      />,
      {
        wrapper: TestParent,
      }
    );

    const g = container.querySelector("g");
    userEvent.hover(g);

    await waitFor(() => {
      expect(handleMouseEnter).toHaveBeenCalledWith(
        expect.objectContaining({ label: "My Node", x: 226, y: 19 })
      );
    });
  });

  it("should call onMouseLeave when the mouse leaves the tick label", async () => {
    const handleMouseLeave = vi.fn();
    const { container } = render(
      <CustomTick
        x={226}
        y={19}
        payload={{ value: "my node" }}
        handleMouseLeave={handleMouseLeave}
      />,
      {
        wrapper: TestParent,
      }
    );

    const g = container.querySelector("g");
    userEvent.unhover(g);

    await waitFor(() => {
      expect(handleMouseLeave).toHaveBeenCalled();
    });
  });
});
