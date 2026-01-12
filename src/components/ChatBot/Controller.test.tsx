import { render } from "@/test-utils";

vi.mock("./ChatBotView", () => ({
  default: () => <div data-testid="chatbot-view" />,
}));

vi.mock("./context/ChatBotContext", () => ({
  ChatBotProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./context/ChatDrawerContext", () => ({
  ChatDrawerProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

    const { getByTestId } = render(<Controller title="Test Chat" label="Help" />);

    expect(getByTestId("chatbot-view")).toBeInTheDocument();
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

    const { queryByTestId } = render(<Controller title="Test Chat" label="Help" />);

    expect(queryByTestId("chatbot-view")).not.toBeInTheDocument();
  });

  it("should use default props when not provided", async () => {
    vi.doMock("@/env", () => ({
      default: {
        VITE_CHATBOT_ENABLED: "true",
      },
    }));

    const { default: Controller } = await import("./Controller");

    const { getByTestId } = render(<Controller />);

    expect(getByTestId("chatbot-view")).toBeInTheDocument();
  });
});
