import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand, RetrieveAndGenerateCommandInput } from "@aws-sdk/client-bedrock-agent-runtime";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const REGION = process.env.AWS_REGION || "us-east-1";
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const MODEL_ARN = process.env.MODEL_ARN;
const GUARDRAIL_ID = process.env.GUARDRAIL_ID;
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION;
const DEBUG = (process.env.DEBUG || "false").toLowerCase() === "true";

const PROMPT_TEMPLATE = `
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
- Base the answer strictly on <search_results>.
- Do NOT mention or refer to:
  - search results
  - the existence of a search process
  - the tags <search_results> or <question>
  - information being provided to you
- Respond as if the information is inherently known.
- Do NOT guess or infer beyond the provided data.
- Answer in English.
- Keep the response concise and helpful.
- Use bullet points when it improves clarity.
- Use plain ASCII text only.
- Do NOT use markdown or other formatting symbols.
- Use consistent formatting. Do not switch between bullet points and dashes, etc.
- If the question is ambiguous or unclear, ask for clarification instead of guessing.

## RESPONSE FALLBACK

If the answer cannot be determined with certainty from <search_results>, or the question is unrelated to the CRDC Submission Portal, you must respond exactly with:

"I couldn’t find an answer. Please contact support or check the documentation here [link]"

## ADDITIONAL CONTEXT

- The data_models folder contains aggregated Data Model representations in JSON format.
- These models may appear in <search_results> and should be treated as authoritative.
`;

const bedrockAgent = new BedrockAgentRuntimeClient({ region: REGION });

type InputBody = {
  question: string;
  sessionId: string | null;
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const method = event?.httpMethod || "POST";

    if (method === "OPTIONS") {
      return buildResponse(200, "");
    }

    let body: InputBody;
    if (typeof event.body === "string") {
      try {
        body = JSON.parse(event.body) as InputBody;
      } catch (e: unknown) {
        /* @ts-ignore */
        return buildResponse(400, { error: "Invalid JSON body", details: e.message });
      }
    } else {
      return buildResponse(400, { error: "Missing request body" });
    }

    const question = body?.question;
    const sessionId = body?.sessionId || undefined;

    if (!question) {
      return buildResponse(400, { error: "Missing 'question' in request body" });
    }

    if (!KNOWLEDGE_BASE_ID || !MODEL_ARN) {
      return buildResponse(500, {
        error: "Missing environment variables",
        details: {
          KNOWLEDGE_BASE_ID: !!KNOWLEDGE_BASE_ID,
          MODEL_ARN: !!MODEL_ARN,
        },
      });
    }

    const params: RetrieveAndGenerateCommandInput = {
      input: { text: question },
      sessionId: sessionId,
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE",
        knowledgeBaseConfiguration: {
          // Call our knowledge base
          knowledgeBaseId: KNOWLEDGE_BASE_ID,
          // Using this model
          modelArn: MODEL_ARN,
          // Using this generation configuration
          generationConfiguration: {
            // Apply a default prompt template
            promptTemplate: {
              textPromptTemplate: PROMPT_TEMPLATE,
            },
            // Apply inference configuration
            inferenceConfig: {
              textInferenceConfig: {
                temperature: 0.2,
                maxTokens: 256,
                // topP: 0.8
              }
            },
            // Apply guardrail protections
            guardrailConfiguration: {
              guardrailId: GUARDRAIL_ID,
              guardrailVersion: GUARDRAIL_VERSION
            },
          },
          // Use this for querying the KB
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              // Latch onto only 3 results to keep the response relevant
              numberOfResults: 3,
            },
          },
        },
      },
    };

    // Call Bedrock
    try {
      const command = new RetrieveAndGenerateCommand(params);
      const resp = await bedrockAgent.send(command);

      const answer = resp?.output?.text ?? "";
      const citations = resp?.citations ?? [];
      const returnedSessionId = resp?.sessionId ?? sessionId ?? null;

      return buildResponse(200, { question, answer, citations, sessionId: returnedSessionId });
    } catch (bedrockError) {
      console.error("Bedrock error:", bedrockError);
      /* @ts-ignore */
      return buildResponse(500, { error: "Uncaught error ", details: bedrockError.message || bedrockError.toString() });
    }
  } catch (err: unknown) {
    console.error("Handler error:", err);

    // If debugging, return full error object (including AWS error details)
    if (DEBUG) {
      /* @ts-ignore */
      return buildResponse(err.statusCode || 500, {
      /* @ts-ignore */

        error: err.message || "Internal server error",
      /* @ts-ignore */

        name: err.name,
      /* @ts-ignore */

        code: err.code,
      /* @ts-ignore */

        statusCode: err.statusCode,
      /* @ts-ignore */

        time: err.time,
      /* @ts-ignore */

        requestId: err.requestId || err.requestID || null,
      /* @ts-ignore */

        stack: err.stack,
        raw: err,
      });
    }

    // Otherwise return minimal info
    /* @ts-ignore */
    return buildResponse(err.statusCode || 500, { error: err.message || "Internal server error" });
  }
};

const buildResponse = (statusCode: number, body: string | object) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}
