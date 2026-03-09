import { describe, expect, it } from "vitest";
import { InputBodySchema } from "./api.ts";

describe("InputBodySchema", () => {
  it("should accept alphanumeric text with punctuation in question attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "What is CRDC 2.0, exactly?",
    });

    expect(result.success).toBe(true);
  });

  it("should reject empty value in question attribute", () => {
    const result = InputBodySchema.safeParse({ question: "" });

    expect(result.success).toBe(false);
  });

  it("should reject a question with only whitespace in question attribute", () => {
    expect(InputBodySchema.safeParse({ question: " " }).success).toBe(false);
    expect(InputBodySchema.safeParse({ question: "\t" }).success).toBe(false);
    expect(InputBodySchema.safeParse({ question: "\n" }).success).toBe(false);
    expect(InputBodySchema.safeParse({ question: "\r\n" }).success).toBe(false);
    expect(InputBodySchema.safeParse({ question: " \t \r\n " }).success).toBe(false);
  });

  it("should reject question attribute longer than 5000 characters", () => {
    const result = InputBodySchema.safeParse({
      question: "a".repeat(5_001),
    });

    expect(result.success).toBe(false);
  });

  it("should reject disallowed special symbols in question attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "Can I use emoji 😊 in text?",
    });

    expect(result.success).toBe(false);
  });

  it("should reject HTML tags in question attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "Is <b>bold</b> text allowed?",
    });

    expect(result.success).toBe(false);
  });

  it.each<string>(["\f", "\v"])(
    "should reject form-feed and other disallowed whitespace characters in question attribute (%s)",
    (whitespace) => {
      const result = InputBodySchema.safeParse({
        question: `This is a ${whitespace} character: Do you allow it?`,
      });

      expect(result.success).toBe(false);
    }
  );

  it.each<string>(["\n", "\r", "\t", " ", "\r\n"])(
    "should accept allowed whitespace characters in question attribute (%s)",
    (whitespace) => {
      const result = InputBodySchema.safeParse({
        question: `This is a ${whitespace} character: Do you allow it?`,
      });

      expect(result.success).toBe(true);
    }
  );

  it("should accept a valid UUID in sessionId attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "What is CRDC?",
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(result.success).toBe(true);
  });

  it("should accept null in sessionId attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "What is CRDC?",
      sessionId: null,
    });

    expect(result.success).toBe(true);
  });

  it("should accept omitted sessionId attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "What is CRDC?",
    });

    expect(result.success).toBe(true);
  });

  it("should reject non-UUID values in sessionId attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "What is CRDC?",
      sessionId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("should accept valid entries in conversationHistory attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "What is CRDC?",
      conversationHistory: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("should default conversationHistory attribute to empty array when omitted", () => {
    const result = InputBodySchema.parse({
      question: "What is CRDC?",
    });

    expect(result.conversationHistory).toEqual([]);
  });

  it("should reject invalid role values in conversationHistory attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "What is CRDC?",
      conversationHistory: [{ role: "system", content: "Hello" }],
    });

    expect(result.success).toBe(false);
  });

  it("should reject empty message content in conversationHistory attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "What is CRDC?",
      conversationHistory: [{ role: "user", content: "" }],
    });

    expect(result.success).toBe(false);
  });

  it("should reject message content longer than 10000 characters in conversationHistory attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "What is CRDC?",
      conversationHistory: [{ role: "assistant", content: "a".repeat(10_001) }],
    });

    expect(result.success).toBe(false);
  });

  it("should reject more than 100 messages in conversationHistory attribute", () => {
    const result = InputBodySchema.safeParse({
      question: "What is CRDC?",
      conversationHistory: Array.from({ length: 101 }, () => ({
        role: "user" as const,
        content: "Hello",
      })),
    });

    expect(result.success).toBe(false);
  });
});
