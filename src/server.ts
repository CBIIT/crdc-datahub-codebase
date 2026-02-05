import express, { type Express } from "express";
import { Logger } from "./utils/logger.ts";

export const createServer = (): Express => {
  const app = express();

  // Middleware
  app.use(express.json({ limit: "1mb" }));
  // TODO: We need rate limiting middleware here

  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  return app;
};

export const startServer = (app: Express, port: number): void => {
  app.listen(port, () => {
    Logger.info(`Express server listening on port ${port}`);
  });
};
