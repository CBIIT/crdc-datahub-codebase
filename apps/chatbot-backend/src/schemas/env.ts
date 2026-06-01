import { z } from "zod";

export const envSchema = z
  .object({
    /**
     * The AWS region where the services are hosted
     *
     * @example "us-west-2"
     */
    AWS_REGION: z.string().min(1),
    /**
     * The ID of the Bedrock Knowledge Base to use for RAG
     *
     * @example "kb-1234567890abcdef"
     */
    KNOWLEDGE_BASE_ID: z.string().min(1),
    /**
     * The AWS Bedrock model ARN to use for generating responses
     *
     * @example "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-v1"
     */
    MODEL_ARN: z.string().min(1),
    /**
     * The ID of the Bedrock Guardrail to apply to the model responses
     */
    GUARDRAIL_ID: z.string().default(""),
    /**
     * The release version of the Bedrock Guardrail to use
     *
     * @example "v5"
     */
    GUARDRAIL_VERSION: z.string().default(""),
    /**
     * The Bedrock reranking model ARN for Knowledge Base retrieval
     * If not provided, retrieval results will not be reranked
     *
     * @example "arn:aws:bedrock:us-west-2::foundation-model/amazon.rerank-v1"
     */
    RERANK_MODEL_ARN: z.string().default(""),
    /**
     * The deployment environment the app is running in
     */
    NODE_ENV: z.enum(["test", "development", "production"]).default("production"),
    /**
     * The port number the server listens on
     *
     * @example "3000"
     */
    PORT: z.string().regex(/^\d+$/, "PORT must be a number").default("3000"),
    /**
     * The currently deployed tier of the application, used for telemetry and logging purposes.
     * This can help differentiate between different environments or versions of the app in monitoring tools.
     */
    DEV_TIER: z.string().default(""),
    /**
     * The current version of the service, following semantic versioning (e.g., "3.6.0.233").
     */
    SERVICE_VERSION: z.preprocess(
      (value) => (typeof value === "string" && /^(\d{1,4}\.\d{1,4}\.\d{1,4}).*/.test(value) ? value : undefined),
      z.string().default("")
    ),
    /**
     * The Arize Phoenix collector endpoint URL for telemetry data collection.
     *
     * @example "http://localhost:6006"
     */
    PHOENIX_COLLECTOR_ENDPOINT: z.union([z.url(), z.literal(""), z.literal(undefined)]).default(""),
    /**
     * The Arize Phoenix API key for authentication.
     *
     * @note Required if `PHOENIX_COLLECTOR_ENDPOINT` is provided.
     */
    PHOENIX_API_KEY: z.string().default(""),
    /**
     * The Arize Phoenix project name to associate telemetry data with.
     *
     * @note Required if `PHOENIX_COLLECTOR_ENDPOINT` is provided.
     */
    PHOENIX_PROJECT_NAME: z.string().default(""),
  })
  .loose()
  .superRefine((env, ctx) => {
    if (env.PHOENIX_COLLECTOR_ENDPOINT && !env.PHOENIX_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["PHOENIX_API_KEY"],
        message: "PHOENIX_API_KEY is required when PHOENIX_COLLECTOR_ENDPOINT is provided",
      });
    }
    if (env.PHOENIX_COLLECTOR_ENDPOINT && !env.PHOENIX_PROJECT_NAME) {
      ctx.addIssue({
        code: "custom",
        path: ["PHOENIX_PROJECT_NAME"],
        message: "PHOENIX_PROJECT_NAME is required when PHOENIX_COLLECTOR_ENDPOINT is provided",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;
