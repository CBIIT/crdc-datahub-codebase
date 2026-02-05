import { createServer, startServer } from "./server.ts";
import { createQuestionRouter } from "./routes/question.ts";

const app = createServer();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Mount routes
app.use("/question", createQuestionRouter());

startServer(app, PORT);
