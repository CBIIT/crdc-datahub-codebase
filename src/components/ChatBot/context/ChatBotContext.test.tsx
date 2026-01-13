import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render } from "@/test-utils";

import { ChatBotProvider, useChatBotContext } from "./ChatBotContext";

describe("ChatBotContext > ChatBotProvider", () => {
  it("should render children without crashing", () => {
    const { getByText } = render(
      <ChatBotProvider>
        <div>Test Child</div>
      </ChatBotProvider>
    );

    expect(getByText("Test Child")).toBeInTheDocument();
  });

  it("should render with default props", () => {
    const { result } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => <ChatBotProvider>{children}</ChatBotProvider>,
    });

    expect(result.current.title).toBe("Chat");
    expect(result.current.label).toBe("Chat");
    expect(result.current.knowledgeBaseUrl).toBe("");
  });

  it("should render with custom title", () => {
    const { result } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => <ChatBotProvider title="Support Chat">{children}</ChatBotProvider>,
    });

    expect(result.current.title).toBe("Support Chat");
    expect(result.current.label).toBe("Chat");
    expect(result.current.knowledgeBaseUrl).toBe("");
  });

  it("should render with custom label", () => {
    const { result } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => <ChatBotProvider label="Help Center">{children}</ChatBotProvider>,
    });

    expect(result.current.title).toBe("Chat");
    expect(result.current.label).toBe("Help Center");
    expect(result.current.knowledgeBaseUrl).toBe("");
  });

  it("should render with custom knowledgeBaseUrl", () => {
    const { result } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => (
        <ChatBotProvider knowledgeBaseUrl="https://api.example.com/chat">
          {children}
        </ChatBotProvider>
      ),
    });

    expect(result.current.title).toBe("Chat");
    expect(result.current.label).toBe("Chat");
    expect(result.current.knowledgeBaseUrl).toBe("https://api.example.com/chat");
  });

  it("should render with all custom props", () => {
    const { result } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => (
        <ChatBotProvider
          title="Customer Support"
          label="Support"
          knowledgeBaseUrl="https://api.example.com/kb"
        >
          {children}
        </ChatBotProvider>
      ),
    });

    expect(result.current.title).toBe("Customer Support");
    expect(result.current.label).toBe("Support");
    expect(result.current.knowledgeBaseUrl).toBe("https://api.example.com/kb");
  });

  it("should update context when props change", () => {
    const { result, rerender } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => <ChatBotProvider title="First Title">{children}</ChatBotProvider>,
    });

    expect(result.current.title).toBe("First Title");

    rerender();

    const { result: result2 } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => <ChatBotProvider title="Second Title">{children}</ChatBotProvider>,
    });

    expect(result2.current.title).toBe("Second Title");
  });
});

describe("ChatBotContext > useChatBotContext", () => {
  it("should throw error when used outside provider", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useChatBotContext());
    }).toThrow("useChatBotContext must be used within ChatBotProvider");

    consoleErrorSpy.mockRestore();
  });

  it("should return context value when used inside provider", () => {
    const { result } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => (
        <ChatBotProvider title="Test Title" label="Test Label" knowledgeBaseUrl="https://test.com">
          {children}
        </ChatBotProvider>
      ),
    });

    expect(result.current).toEqual({
      title: "Test Title",
      label: "Test Label",
      knowledgeBaseUrl: "https://test.com",
    });
  });

  it("should return same object reference when props don't change", () => {
    const { result, rerender } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => (
        <ChatBotProvider title="Same Title" label="Same Label" knowledgeBaseUrl="https://same.com">
          {children}
        </ChatBotProvider>
      ),
    });

    const firstValue = result.current;
    rerender();
    const secondValue = result.current;

    expect(firstValue).toBe(secondValue);
  });

  it("should return new object reference when title changes", () => {
    const Wrapper = ({ title, children }: { title: string; children: React.ReactNode }) => (
      <ChatBotProvider title={title}>{children}</ChatBotProvider>
    );

    const { result, rerender } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => <Wrapper title="First">{children}</Wrapper>,
      initialProps: { title: "First" },
    });

    const firstValue = result.current;

    rerender({ title: "Second" });

    const { result: result2 } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => <Wrapper title="Second">{children}</Wrapper>,
    });

    expect(firstValue).not.toBe(result2.current);
    expect(result2.current.title).toBe("Second");
  });

  it("should return new object reference when label changes", () => {
    const Wrapper = ({ label, children }: { label: string; children: React.ReactNode }) => (
      <ChatBotProvider label={label}>{children}</ChatBotProvider>
    );

    const { result } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => <Wrapper label="First">{children}</Wrapper>,
    });

    const firstValue = result.current;

    const { result: result2 } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => <Wrapper label="Second">{children}</Wrapper>,
    });

    expect(firstValue).not.toBe(result2.current);
    expect(result2.current.label).toBe("Second");
  });

  it("should return new object reference when knowledgeBaseUrl changes", () => {
    const Wrapper = ({ url, children }: { url: string; children: React.ReactNode }) => (
      <ChatBotProvider knowledgeBaseUrl={url}>{children}</ChatBotProvider>
    );

    const { result } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => <Wrapper url="https://first.com">{children}</Wrapper>,
    });

    const firstValue = result.current;

    const { result: result2 } = renderHook(() => useChatBotContext(), {
      wrapper: ({ children }) => <Wrapper url="https://second.com">{children}</Wrapper>,
    });

    expect(firstValue).not.toBe(result2.current);
    expect(result2.current.knowledgeBaseUrl).toBe("https://second.com");
  });
});
