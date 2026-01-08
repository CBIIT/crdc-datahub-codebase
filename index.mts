import { BedrockAgentRuntimeClient, CitationEvent, RetrieveAndGenerateCommandInput, RetrieveAndGenerateStreamCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { APIGatewayProxyEvent } from "aws-lambda";

const REGION = process.env.AWS_REGION || "us-east-1";
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const MODEL_ARN = process.env.MODEL_ARN;
const GUARDRAIL_ID = process.env.GUARDRAIL_ID;
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION;

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

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEvent, responseStream) => {
    try {
      const method = event?.httpMethod || "POST";

      if (method === "OPTIONS") {
        return responseStream.end();
      }

      let body: InputBody;
      if (typeof event.body === "string") {
        try {
          body = JSON.parse(event.body) as InputBody;
        } catch (e: unknown) {
          /* @ts-ignore */
          return responseStream.end(JSON.stringify({ error: "Invalid JSON body", details: e.message }));
        }
      } else {
        return responseStream.end(JSON.stringify({ error: "Missing request body" }));
      }

      const question = body?.question;
      const sessionId = body?.sessionId || undefined;

      if (!question) {
        return responseStream.end(JSON.stringify({ error: "Missing 'question' in request body" }));
      }

      if (!KNOWLEDGE_BASE_ID || !MODEL_ARN) {
        return responseStream.end(JSON.stringify({
          error: "Missing environment variables",
          details: {
            KNOWLEDGE_BASE_ID: !!KNOWLEDGE_BASE_ID,
            MODEL_ARN: !!MODEL_ARN,
          },
        }));
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
                  maxTokens: 512,
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
        const command = new RetrieveAndGenerateStreamCommand(params);
        const resp = await bedrockAgent.send(command);

        responseStream.write(JSON.stringify({ question, sessionId: resp.sessionId ?? sessionId ?? null }));

        const citations: Array<CitationEvent> = [];
        for await (const chunk of resp.stream || []) {
          if (chunk.output) {
            responseStream.write(chunk?.output?.text ?? "");
          }
          if (chunk.citation) {
            citations.push(chunk.citation);
          }
        }

        // TODO: Output the citations

        responseStream.end();
      } catch (bedrockError) {
        console.error("Bedrock error:", bedrockError);

        /* @ts-ignore */
        responseStream.end(JSON.stringify({ error: "Internal server error", details: bedrockError.message || bedrockError }));
      }
    } catch (err: unknown) {
      console.error("Handler error:", err);

      /* @ts-ignore */
      return responseStream.end(JSON.stringify({ error: err.message || "Internal server error" }));
    }
  }
);
