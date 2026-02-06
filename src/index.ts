import { createServer, startServer } from "./server.ts";
import { createQuestionRouter } from "./routes/question.ts";
import { createStatusRouter } from "./routes/status.ts";

const app = createServer();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const AWS_REGION = process.env.AWS_REGION;
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const MODEL_ARN = process.env.MODEL_ARN;
const GUARDRAIL_ID = process.env.GUARDRAIL_ID;
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION;

if (!AWS_REGION || !KNOWLEDGE_BASE_ID || !MODEL_ARN || !GUARDRAIL_ID || !GUARDRAIL_VERSION) {
  throw new Error("Missing required environment variables for question router");
}

app.use(
  "/question",
  createQuestionRouter({ AWS_REGION, KNOWLEDGE_BASE_ID, MODEL_ARN, GUARDRAIL_ID, GUARDRAIL_VERSION })
);
app.use("/status", createStatusRouter());

startServer(app, PORT);
