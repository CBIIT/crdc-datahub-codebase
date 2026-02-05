import { createServer, startServer } from "./server.ts";
import { createQuestionRouter } from "./routes/question.ts";
import { createStatusRouter } from "./routes/status.ts";

const app = createServer();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use("/question", createQuestionRouter());
app.use("/status", createStatusRouter());

startServer(app, PORT);
