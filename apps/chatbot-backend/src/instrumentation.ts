import { DiagLogLevel, register } from "@arizeai/phoenix-otel";
import * as bedrockRuntime from "@aws-sdk/client-bedrock-runtime";
import * as bedrockAgentRuntime from "@aws-sdk/client-bedrock-agent-runtime";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { BedrockInstrumentation } = require("@arizeai/openinference-instrumentation-bedrock");
const { BedrockAgentInstrumentation } = require("@arizeai/openinference-instrumentation-bedrock-agent-runtime");

register({
  projectName: process.env.PHOENIX_PROJECT_NAME,
  url: process.env.PHOENIX_COLLECTOR_ENDPOINT,
  apiKey: process.env.PHOENIX_API_KEY,
  diagLogLevel: DiagLogLevel.WARN,
});

new BedrockInstrumentation().manuallyInstrument(bedrockRuntime);
new BedrockAgentInstrumentation().manuallyInstrument(bedrockAgentRuntime);
