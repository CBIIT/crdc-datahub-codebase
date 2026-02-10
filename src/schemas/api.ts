import { z } from "zod";

export const InputBodySchema = z.object({
  // TODO: Update length constraints based on actual requirements
  question: z.string().min(1, "Question is required").max(5_000, "Question cannot exceed 5000 characters"),
  sessionId: z.uuid().nullable().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z
          .string()
          .min(1, "Message content cannot be empty")
          .max(10_000, "Message content cannot exceed 10,000 characters"), // TODO: Adjust max content length based on actual requirements
      })
    )
    .max(1000, "Conversation history cannot exceed 1000 messages") // TODO: Adjust max messages based on actual requirements
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
