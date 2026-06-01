import { describe, expect, it } from "vitest";
import { envSchema } from "./env.ts";

// Core required environment variables
const baseEnv = {
  AWS_REGION: "us-west-2",
  KNOWLEDGE_BASE_ID: "kb-1234567890abcdef",
  MODEL_ARN: "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-v1",
};

describe("envSchema", () => {
  it("applies default values for optional environment variables", () => {
    const result = envSchema.parse(baseEnv);

    expect(result).toMatchObject({
      ...baseEnv,
      GUARDRAIL_ID: "",
      GUARDRAIL_VERSION: "",
      RERANK_MODEL_ARN: "",
      NODE_ENV: "production",
      PORT: "3000",
      DEV_TIER: "",
      SERVICE_VERSION: "",
      PHOENIX_COLLECTOR_ENDPOINT: "",
      PHOENIX_API_KEY: "",
      PHOENIX_PROJECT_NAME: "",
    });
  });

  it("accepts a semantically formatted service version", () => {
    const result = envSchema.parse({
      ...baseEnv,
      SERVICE_VERSION: "3.7.0.123",
    });

    expect(result.SERVICE_VERSION).toBe("3.7.0.123");
  });

  it("rejects a service version that is not semantically formatted", () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      SERVICE_VERSION: "version-3",
    });

    expect(result.success).toBe(false);
  });

  it("requires Phoenix API key and project name when the collector endpoint is provided", () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      PHOENIX_COLLECTOR_ENDPOINT: "http://localhost:6006",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["PHOENIX_API_KEY"],
            message: "PHOENIX_API_KEY is required when PHOENIX_COLLECTOR_ENDPOINT is provided",
          }),
          expect.objectContaining({
            path: ["PHOENIX_PROJECT_NAME"],
            message: "PHOENIX_PROJECT_NAME is required when PHOENIX_COLLECTOR_ENDPOINT is provided",
          }),
        ])
      );
    }
  });

  it("accepts a complete Phoenix configuration", () => {
    const result = envSchema.parse({
      ...baseEnv,
      PHOENIX_COLLECTOR_ENDPOINT: "http://localhost:6006",
      PHOENIX_API_KEY: "phoenix-api-key",
      PHOENIX_PROJECT_NAME: "chatbot-backend",
    });

    expect(result).toMatchObject({
      PHOENIX_COLLECTOR_ENDPOINT: "http://localhost:6006",
      PHOENIX_API_KEY: "phoenix-api-key",
      PHOENIX_PROJECT_NAME: "chatbot-backend",
    });
  });
});
