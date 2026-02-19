import { createServer, startServer } from "./server.ts";
import { createQuestionRouter } from "./routes/question.ts";
import { createStatusRouter } from "./routes/status.ts";
import { envSchema } from "./schemas/env.ts";

/**
 * Initializes and starts the Express server after validating environment variables.
 */
const app = createServer();

/**
 * Validates environment variables using the defined schema and starts the server.
 */
const { PORT, AWS_REGION, KNOWLEDGE_BASE_ID, MODEL_ARN, GUARDRAIL_ID, GUARDRAIL_VERSION, RERANK_MODEL_ARN } =
  envSchema.parse(process.env);

app.use(
  "/question",
  createQuestionRouter({
    AWS_REGION,
    KNOWLEDGE_BASE_ID,
    MODEL_ARN,
    GUARDRAIL_ID,
    GUARDRAIL_VERSION,
    RERANK_MODEL_ARN,
  })
);
app.use("/status", createStatusRouter());

startServer(app, Number(PORT || 3000));
