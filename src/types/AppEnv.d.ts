export type AppEnv = {
  /**
   * The AWS region where the services are hosted
   *
   * @example "us-west-2"
   */
  AWS_REGION: string;
  /**
   * The ID of the Bedrock Knowledge Base to use for RAG
   *
   * @example "kb-1234567890abcdef"
   */
  KNOWLEDGE_BASE_ID: string;
  /**
   * The AWS Bedrock model ARN to use for generating responses
   *
   * @example "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-v1"
   */
  MODEL_ARN: string;
  /**
   * The ID of the Bedrock Guardrail to apply to the model responses
   */
  GUARDRAIL_ID: string;
  /**
   * The release version of the Bedrock Guardrail to use
   *
   * @example "v5"
   */
  GUARDRAIL_VERSION: string;
  /**
   * The deployment environment the app is running in
   */
  NODE_ENV: "test" | "development" | "production";
  /**
   * The port number the server listens on
   *
   * @example "3000"
   */
  PORT: string;
};
