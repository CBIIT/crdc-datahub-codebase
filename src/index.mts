import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  RetrieveCommandInput,
} from "@aws-sdk/client-bedrock-agent-runtime";
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  ConverseStreamCommandInput,
  Message,
} from "@aws-sdk/client-bedrock-runtime";
import { APIGatewayProxyEvent } from "aws-lambda";
import { safeParseJSON } from "./utils/json.mjs";
import { formatUserPrompt } from "./utils/conversation.mjs";
import { Logger } from "./utils/logger.mjs";

const REGION = process.env.AWS_REGION;
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const MODEL_ARN = process.env.MODEL_ARN;
const GUARDRAIL_ID = process.env.GUARDRAIL_ID;
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION;

const SYSTEM_PROMPT = `
## SYSTEM ROLE

You are a domain-specific assistant for the CRDC Submission Portal.

The Submission Portal may be referred to by any of the following names:
- CRDC Submission Portal
- CRDC DataHub
- Data Hub
- CRDC-DH
- Any close variants of these names

Your purpose is to answer user questions accurately and concisely about the CRDC Submission Portal.

## KNOWLEDGE BOUNDARIES (STRICT)

- You MUST use ONLY the information provided in <search_results>.
- You MUST NOT use outside knowledge, assumptions, or guesses.
- You MAY provide code snippets if necessitated by the user's question and relevant to the information in <search_results>.

## INPUT STRUCTURE

1) Search results (authoritative source of truth)

<search_results>
$search_results$
</search_results>

2) User question

<question>
$query$
</question>

## RESPONSE RULES

- Answer ONLY the user's question
- Do NOT guess or infer beyond the provided data.
- Do NOT mention or refer to:
  - search results
  - the existence of a search process
  - the tags <search_results> or <question>
  - information being provided to you
- Respond as if the information is inherently known.
- Keep the response concise and helpful.
- If the question is ambiguous or unclear, ask for clarification instead of guessing.
- Use markdown formatting naturally where appropriate. Do not use excessive formatting.
- When using markdown formatting, avoid using large headers (h1 - h3) unless absolutely necessary. Prefer smaller headers or bold text for emphasis.
- Answer exclusively in English.

## RESPONSE FALLBACK

If the answer cannot be determined with certainty from <search_results>, or the question is unrelated to the CRDC Submission Portal, you must respond exactly with:

"I couldn’t find an answer. Please contact support or check the documentation here [link]"

## ADDITIONAL CONTEXT

- The data_models folder contains the aggregated General Commons Data Model representation in JSON format.
- These models may appear in <search_results> and should be treated as authoritative.
- The user may ask questions about GC, General Commons, GC Model, GC Data Model, or close variants of that; these are referring to "CDS" or CDS Data Model.
`;

const bedrockAgent = new BedrockAgentRuntimeClient({ region: REGION });
const bedrockRuntime = new BedrockRuntimeClient({ region: REGION });

type InputBody = {
  question: string;
  sessionId: string | null;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

/**
 * Handles the incoming API Gateway request for the Knowledge base chat completion.
 *
 * @param event The API Gateway event.
 * @param responseStream The response stream to write the output to.
 * @returns void
 */
export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEvent, responseStream): Promise<awslambda.HttpResponseStream> => {
    if (event?.httpMethod === "OPTIONS") {
      return responseStream.end();
    }

    if (!KNOWLEDGE_BASE_ID || !MODEL_ARN || !GUARDRAIL_ID || !GUARDRAIL_VERSION) {
      Logger.error("Missing required environment variables", {
        KNOWLEDGE_BASE_ID,
        MODEL_ARN,
        GUARDRAIL_ID,
        GUARDRAIL_VERSION,
      });

      return responseStream.end(
        JSON.stringify({ error: "Invalid configuration: Missing required environment variables" })
      );
    }

    const body = safeParseJSON<InputBody>(event.body || "");
    if (!body?.question) {
      Logger.info("Missing 'question' in request body", { body });
      return responseStream.end(JSON.stringify({ error: "Missing 'question' in request body" }));
    }

    const question = body?.question;
    const sessionId = body?.sessionId || crypto.randomUUID();
    const conversationHistory = body?.conversationHistory || []; // TODO: Use ephemeral storage for history

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
      const retrieveCommand = new RetrieveCommand(retrieveParams);
      const retrieveResponse = await bedrockAgent.send(retrieveCommand);

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
      }
    } catch (retrieveError: unknown) {
      Logger.error("Error retrieving knowledge from Knowledge Base", retrieveError);
      return responseStream.end(JSON.stringify({ error: "Failed to retrieve content from Knowledge Base" }));
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
      system: [{ text: SYSTEM_PROMPT }],
      inferenceConfig: {
        temperature: 0.3,
        maxTokens: 4096,
      },
      guardrailConfig: {
        guardrailIdentifier: GUARDRAIL_ID,
        guardrailVersion: GUARDRAIL_VERSION,
      },
    };

    try {
      const converseCommand = new ConverseStreamCommand(converseParams);
      const converseResponse = await bedrockRuntime.send(converseCommand);

      // Send session ID first
      responseStream.write(JSON.stringify({ sessionId }) + "\n");

      // Stream the response
      if (converseResponse.stream) {
        for await (const chunk of converseResponse.stream) {
          if (chunk.contentBlockDelta?.delta?.text) {
            responseStream.write(
              JSON.stringify({
                output: chunk.contentBlockDelta.delta.text,
                citation: {}, // citations,
              }) + "\n"
            );
          }

          if (chunk.messageStop) {
            break;
          }
        }
      }

      responseStream.end();
    } catch (converseError: unknown) {
      Logger.error("Error generating response from Converse API", converseError);
      return responseStream.end(JSON.stringify({ error: "AWS bedrock failed to generate response" }));
    }

    // NOTE: This should never be reached due to the responseStream.end() calls above
    Logger.error("Handler completed without sending a response");
    return responseStream.end();
  }
);
