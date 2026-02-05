import express from "express";

export const createStatusRouter = (): express.Router => {
  const router = express.Router();

  router.get("/ping", (_, res) => {
    res.send("pong");
  });

  router.get("/version", (_, res) => {
    res.json({ version: "unknown" });
  });

  return router;
};
