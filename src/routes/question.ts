import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  type RetrieveCommandInput,
} from "@aws-sdk/client-bedrock-agent-runtime";
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type ConverseStreamCommandInput,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";
import express from "express";
import { formatUserPrompt } from "../utils/conversation.ts";
import { Logger } from "../utils/logger.ts";
import { GenerateEvent } from "../utils/output.ts";
import { InputBodySchema, type InputBody } from "../schemas/api.ts";
import { CHATBOT_PROMPT } from "../config/prompts.ts";
import type { AppEnv } from "../types/AppEnv.ts";

export const createQuestionRouter = ({
  AWS_REGION,
  KNOWLEDGE_BASE_ID,
  MODEL_ARN,
  GUARDRAIL_ID,
  GUARDRAIL_VERSION,
}: Pick<AppEnv, "AWS_REGION" | "KNOWLEDGE_BASE_ID" | "MODEL_ARN" | "GUARDRAIL_ID" | "GUARDRAIL_VERSION">) => {
  const router = express.Router();

  const BEDROCK_AGENT = new BedrockAgentRuntimeClient({ region: AWS_REGION });
  const BEDROCK_RUNTIME = new BedrockRuntimeClient({ region: AWS_REGION });

  router.post("/", async (req, res) => {
    const validationResult = InputBodySchema.safeParse(req.body);
    if (!validationResult.success) {
      Logger.info("Invalid request body", {
        issues: validationResult.error.issues,
        body: req.body,
      });
      return res.status(400).json({
        error: "Invalid request body",
        details: validationResult.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      });
    }

    const body = validationResult.data;

    // Start streaming only after validation passes
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.flushHeaders();

    const question = body.question;
    const sessionId = body.sessionId || crypto.randomUUID();
    const conversationHistory: NonNullable<InputBody["conversationHistory"]> = body.conversationHistory;

    // Initial response with sessionId
    res.write(JSON.stringify({ sessionId }) + "\n");

    // Step 1: Retrieve relevant documents from Knowledge Base
    const retrieveParams: RetrieveCommandInput = {
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      retrievalQuery: {
        text: question,
      },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: 15,
        },
      },
    };

    let searchResults = "";
    // let citations: Citation = {};

    try {
      res.write(JSON.stringify(GenerateEvent("Retrieving relevant documents")) + "\n");

      const retrieveCommand = new RetrieveCommand(retrieveParams);
      const retrieveResponse = await BEDROCK_AGENT.send(retrieveCommand);

      Logger.info("Retrieved documents from Knowledge Base", {
        sessionId,
        chunkCount: retrieveResponse?.retrievalResults?.length || 0,
      });

      // Build search results context from retrieved documents
      if (retrieveResponse.retrievalResults) {
        // citations = {
        //   retrievedReferences: retrieveResponse.retrievalResults.map((result) => ({
        //     content: { text: result.content?.text },
        //     location: result.location,
        //     metadata: result.metadata,
        //   })),
        // };

        searchResults = retrieveResponse.retrievalResults
          .map((result, index) => {
            const content = result.content?.text || "";
            const source = result.location?.s3Location?.uri || "Unknown source";
            return `[Document ${index + 1}]\nSource: ${source}\nContent: ${content}\n`;
          })
          .join("\n");
      } else {
        Logger.error("No retrieval results from Knowledge Base", { sessionId });
      }
    } catch (retrieveError: unknown) {
      Logger.error("Error retrieving knowledge from Knowledge Base", retrieveError);
      res.write(JSON.stringify({ error: "Failed to retrieve content from Knowledge Base" }) + "\n");
      return res.end();
    }

    // Step 2: Build conversation messages with context
    const messages: Message[] = [
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: [{ text: msg.content }],
      })),
      {
        role: "user" as const,
        content: [{ text: formatUserPrompt(question, searchResults) }],
      },
    ];

    // Step 3: Call Converse API
    const converseParams: ConverseStreamCommandInput = {
      modelId: MODEL_ARN.split("/").pop() || MODEL_ARN,
      messages: messages,
      system: [{ text: CHATBOT_PROMPT }],
      inferenceConfig: {
        temperature: 0.3,
        maxTokens: 4096,
      },
      guardrailConfig: {
        guardrailIdentifier: GUARDRAIL_ID,
        guardrailVersion: GUARDRAIL_VERSION,
      },
      // additionalModelRequestFields: {
      //   top_k: 100,
      // },
    };

    try {
      res.write(JSON.stringify(GenerateEvent("Generating a response")) + "\n");

      const converseCommand = new ConverseStreamCommand(converseParams);
      const converseResponse = await BEDROCK_RUNTIME.send(converseCommand);

      // Stream the response
      if (converseResponse.stream) {
        for await (const event of converseResponse.stream) {
          if (event.contentBlockDelta?.delta?.text) {
            res.write(
              JSON.stringify({
                output: event.contentBlockDelta.delta.text,
                citation: {}, // citations,
              }) + "\n"
            );
          }

          if (event.messageStop?.stopReason === "guardrail_intervened") {
            Logger.info("Guardrail intervened in the response generation", { sessionId, event });
          }
          if (event.messageStop?.stopReason === "max_tokens") {
            Logger.info("Response generation stopped due to max tokens limit", { sessionId, event });
          }

          if (event.messageStop) {
            break;
          }
        }
      }

      return res.end();
    } catch (converseError: unknown) {
      Logger.error("Error generating response from Converse API", converseError);
      res.write(JSON.stringify({ error: "AWS bedrock failed to generate response" }) + "\n");
      return res.end();
    }
  });

  return router;
};
