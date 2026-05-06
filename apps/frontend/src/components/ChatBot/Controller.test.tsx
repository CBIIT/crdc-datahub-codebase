import { render } from "@/test-utils";

vi.mock("./ChatBotView", () => ({
  default: () => <div data-testid="chatbot-view" />,
}));

vi.mock("./context/ChatBotContext", () => ({
  ChatBotProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./context/ChatConversationContext", () => ({
  ChatConversationProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    { value: "https://example.com/api/chat", description: "a valid URL" },
    { value: "/api/chat", description: "a relative path" },
  ])("should render ChatBot when VITE_CHATBOT_API_BASE_URL is $description", async ({ value }) => {
    vi.doMock("@/env", () => ({
      default: { VITE_CHATBOT_API_BASE_URL: value },
    }));

    const { default: Controller } = await import("./Controller");

    const { getByTestId } = render(<Controller label="Help" />);

    expect(getByTestId("chatbot-view")).toBeInTheDocument();
  });

  it("should use default props when not provided", async () => {
    vi.doMock("@/env", () => ({
      default: {
        VITE_CHATBOT_API_BASE_URL: "https://example.com/api/chat",
      },
    }));

    const { default: Controller } = await import("./Controller");

    const { getByTestId } = render(<Controller />);

    expect(getByTestId("chatbot-view")).toBeInTheDocument();
  });
});
