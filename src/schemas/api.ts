import { z } from "zod";

export const InputBodySchema = z.object({
  question: z.string().min(1, "Question is required"),
  sessionId: z.uuid().nullable().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

export type InputBody = z.infer<typeof InputBodySchema>;

export const APIResponseSchema = z.object({
  sessionId: z.uuid(),
  output: z.string().optional(),
  citation: z.null(), // TODO: Placeholder for future citation data
  error: z.string().optional(),
});

export type APIResponse = z.infer<typeof APIResponseSchema>;

export const APIEventSchema = z.object({
  type: z.enum(["pulse"]),
  description: z.string(),
});

export type APIEvent = z.infer<typeof APIEventSchema>;
