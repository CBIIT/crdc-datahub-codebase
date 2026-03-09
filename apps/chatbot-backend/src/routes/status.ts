import express from "express";
import type { AppEnv } from "../schemas/env.ts";

export const createStatusRouter = ({ SERVICE_VERSION, DEV_TIER }: Pick<AppEnv, "SERVICE_VERSION" | "DEV_TIER">) => {
  const router = express.Router();

  router.get("/ping", (_, res) => {
    res.send("pong");
  });

  router.get("/version", (_, res) => {
    res.json({ version: SERVICE_VERSION, tier: DEV_TIER });
  });

  return router;
};
