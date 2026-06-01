import { DiagLogLevel, register } from "@arizeai/phoenix-otel";
import * as bedrockRuntime from "@aws-sdk/client-bedrock-runtime";
import * as bedrockAgentRuntime from "@aws-sdk/client-bedrock-agent-runtime";
import { createRequire } from "node:module";
import type { AppEnv } from "./schemas/env.ts";

const require = createRequire(import.meta.url);

export const createInstrumentation = ({
  PHOENIX_COLLECTOR_ENDPOINT,
  PHOENIX_PROJECT_NAME,
  PHOENIX_API_KEY,
}: Pick<AppEnv, "PHOENIX_COLLECTOR_ENDPOINT" | "PHOENIX_PROJECT_NAME" | "PHOENIX_API_KEY">) => {
  const { BedrockInstrumentation } = require("@arizeai/openinference-instrumentation-bedrock");
  const { BedrockAgentInstrumentation } = require("@arizeai/openinference-instrumentation-bedrock-agent-runtime");

  register({
    projectName: PHOENIX_PROJECT_NAME,
    url: PHOENIX_COLLECTOR_ENDPOINT,
    apiKey: PHOENIX_API_KEY,
    diagLogLevel: DiagLogLevel.WARN,
  });

  new BedrockInstrumentation().manuallyInstrument(bedrockRuntime);
  new BedrockAgentInstrumentation().manuallyInstrument(bedrockAgentRuntime);
};
