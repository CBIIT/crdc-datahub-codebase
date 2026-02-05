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
import { safeParseJSON } from "../utils/json.ts";
import { formatUserPrompt } from "../utils/conversation.ts";
import { Logger } from "../utils/logger.ts";
import { GenerateEvent } from "../utils/output.ts";
import type { InputBody } from "../schemas/api.ts";

const REGION = process.env.AWS_REGION;
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const MODEL_ARN = process.env.MODEL_ARN;
const GUARDRAIL_ID = process.env.GUARDRAIL_ID;
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION;

const SYSTEM_PROMPT = `
## SYSTEM ROLE

You are a domain-specific assistant for the CRDC Submission Portal.

The CRDC Submission Portal may also be referred to as:
- CRDC DataHub
- Data Hub
- CRDC-DH
- Close variants of these names

Your purpose is to answer user questions accurately and concisely about the CRDC Submission Portal.

## KNOWLEDGE BOUNDARIES (STRICT)

- You MUST use ONLY information explicitly provided to you in the conversation context.
- You MUST NOT use outside knowledge, assumptions, or guesses.
- You MAY provide code snippets only when they are directly supported by the provided context.

## GROUNDING ASSUMPTIONS

- Authoritative reference material may appear in the conversation as structured or unstructured text (for example, XML, JSON, or documentation excerpts).
- This material is the sole source of truth for your responses.
- Treat provided data models and documentation as authoritative.

## RESPONSE RULES

- Answer ONLY the user's question.
- Do NOT guess or infer beyond the provided information.
- Do NOT mention or refer to:
  - how the information was provided
  - retrieval, search, or grounding processes
  - markup, tags, or document boundaries
- Respond as if the information is inherently known.
- Keep responses concise, clear, and helpful.
- If the question is ambiguous, ask for clarification instead of guessing.
- If the question cannot be answered with certainty using the provided information, follow the fallback rule below.
- Use Markdown naturally where appropriate.
  - Avoid large headers (H1 - H3).
  - Prefer short paragraphs, bullet points, or **bold** for emphasis.
- Respond exclusively in English.

## RESPONSE DECISION GATE (MANDATORY)

Before generating any response text, you MUST make an internal decision:

- Decision A: The question CAN be answered with certainty using the provided information.
- Decision B: The question CANNOT be answered with certainty using the provided information.

This decision MUST be made BEFORE writing any part of the response.

Once a decision is made:
- If Decision A is chosen, you MUST provide the answer and MUST NOT include any fallback language.
- If Decision B is chosen, you MUST provide ONLY the appropriate fallback response and MUST NOT include any other content.

You MUST NOT change decisions mid-response.
You MUST NOT reassess certainty after beginning to answer.

## RESPONSE FALLBACK (STRICT AND EXCLUSIVE)

If Decision B is chosen, you MUST respond with exactly ONE of the following responses and nothing else.

- If the question is related to **Submission Requests**, respond exactly with:
  "I couldn't find an answer. Please contact support or check the documentation here https://datacommons.cancer.gov/submission-request-instructions"

- If the question is related to **Data Submissions**, respond exactly with:
  "I couldn't find an answer. Please contact support or check the documentation here https://datacommons.cancer.gov/data-submission-instructions"

- If the question is related to **Data Explorer**, respond exactly with:
  "I couldn't find an answer. Please contact support or check the documentation here https://datacommons.cancer.gov/data-explorer-instructions"

- If the question does not clearly match any of the above topics, respond exactly with:
  "I couldn't find an answer. Please contact support."

## TERMINOLOGY NOTES

- References to **GC**, **General Commons**, **GC Model**, or **GC Data Model** refer to the **CDS Data Model**.
- The "data_models" content represents aggregated General Commons data models in JSON format and should be treated as authoritative when present.
`;

const bedrockAgent = new BedrockAgentRuntimeClient({ region: REGION });
const bedrockRuntime = new BedrockRuntimeClient({ region: REGION });

export const createQuestionRouter = (): express.Router => {
  const router = express.Router();

  router.options("/", (_req, res) => {
    res.status(204).end();
  });

  router.post("/", async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.flushHeaders();

    if (!KNOWLEDGE_BASE_ID || !MODEL_ARN || !GUARDRAIL_ID || !GUARDRAIL_VERSION) {
      Logger.error("Missing required environment variables", {
        KNOWLEDGE_BASE_ID,
        MODEL_ARN,
        GUARDRAIL_ID,
        GUARDRAIL_VERSION,
      });

      res.write(JSON.stringify({ error: "Invalid configuration: Missing required environment variables" }) + "\n");
      return res.end();
    }

    const body = safeParseJSON<InputBody>(JSON.stringify(req.body ?? {}));
    if (!body?.question) {
      Logger.info("Missing 'question' in request body", { body });
      res.write(JSON.stringify({ error: "Missing 'question' in request body" }) + "\n");
      return res.end();
    }

    const question = body?.question;
    const sessionId = body?.sessionId || crypto.randomUUID();
    const conversationHistory = body?.conversationHistory || []; // TODO: Use ephemeral storage for history

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
      const retrieveResponse = await bedrockAgent.send(retrieveCommand);

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
      ...conversationHistory.map((msg: Message) => ({
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
      system: [{ text: SYSTEM_PROMPT }],
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
      const converseResponse = await bedrockRuntime.send(converseCommand);

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
