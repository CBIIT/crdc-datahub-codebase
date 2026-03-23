import { axe } from "vitest-axe";

import { render, waitFor } from "@/test-utils";

import ChatBot from "./index";

vi.mock("./Controller", () => ({
  default: () => <div data-testid="chat-controller">Chat Controller</div>,
}));

describe("Accessibility", async () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<ChatBot />);

    await waitFor(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() => render(<ChatBot />)).not.toThrow();
  });

  it("should export ChatController component", () => {
    const { getByTestId } = render(<ChatBot />);

    expect(getByTestId("chat-controller")).toBeInTheDocument();
  });
});
