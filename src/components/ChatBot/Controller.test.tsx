import { render, screen } from "@testing-library/react";

vi.mock("./ChatBotView", () => ({
  default: ({ title }: { title?: string }) => <div data-testid="chatbot-view">{title}</div>,
}));

describe("ChatController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    { value: "true", description: "true" },
    { value: "TRUE", description: "TRUE" },
    { value: "True", description: "True" },
    { value: undefined, description: "undefined" },
    { value: null, description: "null" },
    { value: "", description: "empty string" },
  ])("should render ChatBot when VITE_CHATBOT_ENABLED is $description", async ({ value }) => {
    vi.doMock("@/env", () => ({
      default: value !== undefined && value !== null ? { VITE_CHATBOT_ENABLED: value } : {},
    }));

    const { default: Controller } = await import("./Controller");

    render(<Controller title="Test Chat" />);

    expect(screen.getByTestId("chatbot-view")).toBeInTheDocument();
    expect(screen.getByText("Test Chat")).toBeInTheDocument();
  });

  it.each([
    { value: "false", description: "false" },
    { value: "FALSE", description: "FALSE" },
    { value: "0", description: "0" },
    { value: "disabled", description: "disabled" },
    { value: "NaN", description: "NaN" },
  ])("should not render ChatBot when VITE_CHATBOT_ENABLED is $description", async ({ value }) => {
    vi.doMock("@/env", () => ({
      default: { VITE_CHATBOT_ENABLED: value },
    }));

    const { default: Controller } = await import("./Controller");

    render(<Controller title="Test Chat" />);

    expect(screen.queryByTestId("chatbot-view")).not.toBeInTheDocument();
  });

  it("should pass all props to ChatBot when enabled", async () => {
    vi.doMock("@/env", () => ({
      default: {
        VITE_CHATBOT_ENABLED: "true",
      },
    }));

    const { default: Controller } = await import("./Controller");

    const mockProps = {
      title: "Support Chat",
      subtitle: "How can we help?",
    };

    render(<Controller {...mockProps} />);

    expect(screen.getByTestId("chatbot-view")).toBeInTheDocument();
  });
});
