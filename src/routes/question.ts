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
import {
  generateCitationEvent,
  generateErrorEvent,
  generatePulseEvent,
  generateResponseEvent,
  generateSessionEvent,
} from "../utils/output.ts";
import { CitationSchema, InputBodySchema, type Citation, type InputBody } from "../schemas/api.ts";
import { CHATBOT_PROMPT } from "../config/prompts.ts";
import type { AppEnv } from "../schemas/env.ts";

export const createQuestionRouter = ({
  AWS_REGION,
  KNOWLEDGE_BASE_ID,
  MODEL_ARN,
  GUARDRAIL_ID,
  GUARDRAIL_VERSION,
  RERANK_MODEL_ARN,
}: Pick<
  AppEnv,
  "AWS_REGION" | "KNOWLEDGE_BASE_ID" | "MODEL_ARN" | "GUARDRAIL_ID" | "GUARDRAIL_VERSION" | "RERANK_MODEL_ARN"
>) => {
  const router = express.Router();

  const BEDROCK_AGENT = new BedrockAgentRuntimeClient({ region: AWS_REGION });
  const BEDROCK_RUNTIME = new BedrockRuntimeClient({ region: AWS_REGION });

  if (!GUARDRAIL_ID || !GUARDRAIL_VERSION) {
    Logger.warn("No AWS Guardrails configured. Responses will not be evaluated against guardrails!");
  }

  router.post("/", async (req, res) => {
    const validationResult = InputBodySchema.safeParse(req.body);
    if (!validationResult.success) {
      Logger.info("Rejected invalid request body", {
        issues: validationResult.error.issues,
        body: req.body,
      });
      return res.status(400).json(generateErrorEvent("Invalid request body"));
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.flushHeaders();

    const body = validationResult.data;
    const question = body.question;
    const sessionId = body.sessionId || crypto.randomUUID();
    const conversationHistory: NonNullable<InputBody["conversationHistory"]> = body.conversationHistory;

    // Initial response with sessionId
    res.write(JSON.stringify(generateSessionEvent(sessionId)) + "\n");

    // Step 1: Retrieve relevant documents from Knowledge Base
    const retrieveParams: RetrieveCommandInput = {
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      retrievalQuery: {
        text: question,
      },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: 20,
          rerankingConfiguration: RERANK_MODEL_ARN
            ? {
                type: "BEDROCK_RERANKING_MODEL",
                bedrockRerankingConfiguration: {
                  modelConfiguration: {
                    modelArn: RERANK_MODEL_ARN,
                  },
                  numberOfRerankedResults: 8,
                },
              }
            : undefined,
        },
      },
    };

    let searchResults = "";
    let citations: Citation[] = [];

    try {
      res.write(JSON.stringify(generatePulseEvent("Retrieving relevant documents")) + "\n");

      const retrieveCommand = new RetrieveCommand(retrieveParams);
      const retrieveResponse = await BEDROCK_AGENT.send(retrieveCommand);

      if (retrieveResponse?.retrievalResults?.length) {
        Logger.info("Documents retrieved from Knowledge Base", {
          sessionId,
          query: question,
          chunks: retrieveResponse.retrievalResults || [],
        });

        searchResults = retrieveResponse.retrievalResults
          .map((result, index) => {
            const content = result.content?.text || "";
            return `[Document ${index + 1}]\nContent: ${content}\n`;
          })
          .join("\n");

        citations = retrieveResponse.retrievalResults
          .map((result) => ({
            documentName: result.metadata?.document_name || null,
            documentLink: result.metadata?.public_url || null,
          }))
          .filter((citation): citation is Citation => CitationSchema.safeParse(citation).success)
          .filter(
            (citation, index, self) =>
              index ===
              self.findIndex(
                (c) => c.documentName === citation.documentName && c.documentLink === citation.documentLink
              )
          );
      } else {
        Logger.error("No retrieval results from Knowledge Base", { sessionId, query: question });
      }
    } catch (retrieveError: unknown) {
      Logger.error("Error retrieving knowledge from Knowledge Base", retrieveError);
      return res.write(JSON.stringify(generateErrorEvent("Failed to retrieve content from Knowledge Base")) + "\n");
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
      ...(GUARDRAIL_ID &&
        GUARDRAIL_VERSION && {
          guardrailConfig: {
            guardrailIdentifier: GUARDRAIL_ID,
            guardrailVersion: GUARDRAIL_VERSION,
            trace: "enabled_full",
          },
        }),
    };

    try {
      Logger.info("Sending request to Converse API", { sessionId, modelId: converseParams.modelId });

      res.write(JSON.stringify(generatePulseEvent("Generating a response")) + "\n");

      const converseCommand = new ConverseStreamCommand(converseParams);
      const converseResponse = await BEDROCK_RUNTIME.send(converseCommand);
      let emitCitations = citations.length > 0;
      let guardrailIntervened: boolean = false;

      // Stream the response
      if (converseResponse.stream) {
        Logger.info("Streaming response from Converse API", { sessionId });

        for await (const event of converseResponse.stream) {
          // Emit the generated text to the client as it arrives
          if (event.contentBlockDelta?.delta?.text) {
            res.write(JSON.stringify(generateResponseEvent(event.contentBlockDelta.delta.text)) + "\n");
          }

          // Identify if response generation was stopped due to non-standard events
          if (event.messageStop && event.messageStop?.stopReason !== "end_turn") {
            Logger.info("Received non-standard message stop event from Converse API", { sessionId, event });

            // Do not emit citations for guardrail interventions
            if (event.messageStop.stopReason === "guardrail_intervened") {
              guardrailIntervened = true;
              emitCitations = false;
            }
          }

          // Log guardrail trace if present in the response metadata
          if (guardrailIntervened && event.metadata?.trace?.guardrail) {
            Logger.info("Received guardrail trace in Converse API response", {
              sessionId,
              event: JSON.stringify(event.metadata.trace.guardrail, null, 2),
            });
          }
        }

        if (emitCitations) {
          Logger.info("Sending citations to client", { sessionId, citations });
          res.write(JSON.stringify(generateCitationEvent(citations)) + "\n");
        }
      }

      return res.end();
    } catch (converseError: unknown) {
      Logger.error("Error generating response from Converse API", converseError);
      return res.write(JSON.stringify(generateErrorEvent("Failed to generate response from language model")) + "\n");
    }
  });

  return router;
};
