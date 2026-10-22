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

  // Fix a bug in the library: constructRagDocument() drops `score`, so all retrieval scores
  // trace as 0. The internal ragAttributeExtractionUtils module is now in require.cache —
  // patch its export before manuallyInstrument() closes over it.
  const ragUtilsCacheKey = Object.keys(require.cache).find(
    (k) =>
      k.includes("ragAttributeExtractionUtils") && k.includes("openinference-instrumentation-bedrock-agent-runtime")
  );
  if (ragUtilsCacheKey) {
    const ragUtils = require.cache[ragUtilsCacheKey]?.exports;
    if (ragUtils?.extractBedrockRetrieveResponseAttributes) {
      const original = ragUtils.extractBedrockRetrieveResponseAttributes;
      ragUtils.extractBedrockRetrieveResponseAttributes = function (response: {
        retrievalResults?: Array<{ score?: number }>;
      }) {
        const attributes = original(response);
        const results = Array.isArray(response?.retrievalResults) ? response.retrievalResults : [];
        results.forEach((doc, index) => {
          if (doc.score != null) {
            attributes[`retrieval.documents.${index}.document.score`] = doc.score;
          }
        });
        return attributes;
      };
    }
  }

  register({
    projectName: PHOENIX_PROJECT_NAME,
    url: PHOENIX_COLLECTOR_ENDPOINT,
    apiKey: PHOENIX_API_KEY,
    diagLogLevel: DiagLogLevel.WARN,
  });

  new BedrockInstrumentation().manuallyInstrument(bedrockRuntime);
  new BedrockAgentInstrumentation().manuallyInstrument(bedrockAgentRuntime);
};
