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
    GUARDRAIL_ID: z.string().min(1),
    /**
     * The release version of the Bedrock Guardrail to use
     *
     * @example "v5"
     */
    GUARDRAIL_VERSION: z.string().min(1),
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
  })
  .loose();

export type AppEnv = z.infer<typeof envSchema>;
