import { MockedResponse, MockedProvider } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import { FC } from "react";

import { Logger } from "@/utils/logger";

import { IS_CHATBOT_ENABLED, IsChatBotEnabledResp } from "../../graphql";
import { render, waitFor } from "../../test-utils";

import ChatBotGate from "./index";

vi.mock("@/env", () => ({
  default: { VITE_CHATBOT_API_BASE_URL: "https://example.com/chatbot" },
}));

vi.mock("@/utils/logger", () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const ChatBotEnabledMock: MockedResponse<IsChatBotEnabledResp> = {
  request: {
    query: IS_CHATBOT_ENABLED,
  },
  result: {
    data: {
      isChatBotEnabled: true,
    },
  },
};

const ChatBotDisabledMock: MockedResponse<IsChatBotEnabledResp> = {
  request: {
    query: IS_CHATBOT_ENABLED,
  },
  result: {
    data: {
      isChatBotEnabled: false,
    },
  },
};

type MockParentProps = {
  mocks?: MockedResponse[];
};

const MockParent: FC<MockParentProps> = ({ mocks }) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <ChatBotGate>
      <p>MOCK-CHATBOT</p>
    </ChatBotGate>
  </MockedProvider>
);

describe("Basic Functionality", () => {
  it("should render without crashing (ChatBot enabled)", () => {
    expect(() => render(<MockParent mocks={[ChatBotEnabledMock]} />)).not.toThrow();
  });

  it("should render without crashing (ChatBot disabled)", () => {
    expect(() => render(<MockParent mocks={[ChatBotDisabledMock]} />)).not.toThrow();
  });

  it("should render children when ChatBot is enabled", async () => {
    const { getByText } = render(<MockParent mocks={[ChatBotEnabledMock]} />);

    await waitFor(() => {
      expect(getByText("MOCK-CHATBOT")).toBeInTheDocument();
    });
  });

  it("should not render children when ChatBot is disabled", async () => {
    const { queryByText } = render(<MockParent mocks={[ChatBotDisabledMock]} />);

    await waitFor(() => {
      expect(queryByText("MOCK-CHATBOT")).not.toBeInTheDocument();
    });
  });

  it("should not render children before the query resolves", () => {
    const { queryByText } = render(<MockParent mocks={[ChatBotEnabledMock]} />);

    expect(queryByText("MOCK-CHATBOT")).not.toBeInTheDocument();
  });

  it("should handle error when fetching ChatBot enabled status (Network)", async () => {
    const errorMock: MockedResponse<IsChatBotEnabledResp> = {
      request: {
        query: IS_CHATBOT_ENABLED,
      },
      error: new Error("Network error"),
    };

    const { queryByText } = render(<MockParent mocks={[errorMock]} />);

    await waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        "Unable to fetch ChatBot enabled status. Assuming disabled.",
        expect.any(Error)
      );
    });

    expect(queryByText("MOCK-CHATBOT")).not.toBeInTheDocument();
  });

  it("should handle error when fetching ChatBot enabled status (GraphQL)", async () => {
    const errorMock: MockedResponse<IsChatBotEnabledResp> = {
      request: {
        query: IS_CHATBOT_ENABLED,
      },
      result: {
        errors: [new GraphQLError("mock error")],
      },
    };

    const { queryByText } = render(<MockParent mocks={[errorMock]} />);

    await waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        "Unable to fetch ChatBot enabled status. Assuming disabled.",
        expect.any(Error)
      );
    });

    expect(queryByText("MOCK-CHATBOT")).not.toBeInTheDocument();
  });

  it("should handle null response for ChatBot enabled status", () => {
    const errorMock: MockedResponse<IsChatBotEnabledResp> = {
      request: {
        query: IS_CHATBOT_ENABLED,
      },
      result: {
        data: {
          isChatBotEnabled: null,
        },
      },
    };

    const { queryByText } = render(<MockParent mocks={[errorMock]} />);

    expect(queryByText("MOCK-CHATBOT")).not.toBeInTheDocument();
  });

  it.each([
    { value: undefined, description: "undefined" },
    { value: null, description: "null" },
    { value: "", description: "an empty string" },
    { value: "   ", description: "whitespace only" },
  ])(
    "should not render children when VITE_CHATBOT_API_BASE_URL is $description",
    async ({ value }) => {
      let mockEnv: Record<string, unknown> = {};
      if (value === null) {
        mockEnv = { VITE_CHATBOT_API_BASE_URL: null };
      } else if (value !== undefined) {
        mockEnv = { VITE_CHATBOT_API_BASE_URL: value };
      }

      vi.doMock("@/env", () => ({
        default: mockEnv,
      }));

      const { default: Gate } = await import("./index");

      const { queryByText } = render(
        <MockedProvider mocks={[ChatBotEnabledMock]} addTypename={false}>
          <Gate>
            <p>MOCK-CHATBOT</p>
          </Gate>
        </MockedProvider>
      );

      await waitFor(() => {
        expect(queryByText("MOCK-CHATBOT")).not.toBeInTheDocument();
      });
    }
  );

  it("should not render children when env is not defined", async () => {
    vi.doMock("@/env", () => ({
      default: undefined,
    }));

    const { default: Gate } = await import("./index");

    const { queryByText } = render(
      <MockedProvider mocks={[ChatBotEnabledMock]} addTypename={false}>
        <Gate>
          <p>MOCK-CHATBOT</p>
        </Gate>
      </MockedProvider>
    );

    await waitFor(() => {
      expect(queryByText("MOCK-CHATBOT")).not.toBeInTheDocument();
    });
  });
});
