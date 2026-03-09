import { z } from "zod";

export const InputBodySchema = z.object({
  // TODO: Update length constraints based on actual requirements
  question: z
    .string()
    .min(1, "Question is required")
    .max(5_000, "Question cannot exceed 5000 characters")
    .regex(/^[\p{L}\p{N}\p{P}\p{Zs}\r\n\t]+$/u, "Question must be alphanumeric and may include punctuation only")
    .refine((value) => value.trim() !== "", "Question cannot be empty or contain only whitespace"),
  sessionId: z.uuid().nullable().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z
          .string()
          .min(1, "Message content cannot be empty")
          .max(10_000, "Message content cannot exceed 10,000 characters") // TODO: Adjust max content length based on actual requirements
          .refine((value) => value.trim() !== "", "Message content cannot be empty or contain only whitespace"),
      })
    )
    .max(100, "Conversation history cannot exceed 100 messages")
    .optional()
    .default([]),
});

export const CitationSchema = z.object({
  /**
   * The display name of the document or source.
   * This is a user-friendly name that can be shown in the UI.
   */
  documentName: z.string(),
  /**
   * The public URL where the document can be accessed. This should be a valid URL pointing to the source of the information.
   * If null, it indicates that the source is not publicly accessible or the URL is not available.
   */
  documentLink: z.url().nullable(),
});

export const BaseAPIEventSchema = z.object({
  type: z.enum(["pulse", "citations", "session", "response", "error"]),
});

export const PulseEventSchema = BaseAPIEventSchema.extend({
  type: z.literal("pulse"),
  description: z.string(),
});

export const CitationEventSchema = BaseAPIEventSchema.extend({
  type: z.literal("citations"),
  citations: z.array(CitationSchema),
});

export const SessionEventSchema = BaseAPIEventSchema.extend({
  type: z.literal("session"),
  sessionId: z.uuid(),
});

export const ResponseEventSchema = BaseAPIEventSchema.extend({
  type: z.literal("response"),
  output: z.string().max(10_000, "Response output cannot exceed 10,000 characters"),
});

export const ErrorEventSchema = BaseAPIEventSchema.extend({
  type: z.literal("error"),
  message: z
    .string()
    .min(1, "Error message cannot be empty")
    .max(10_000, "Error message cannot exceed 10,000 characters"),
});

export type InputBody = z.infer<typeof InputBodySchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type APIPulseEvent = z.infer<typeof PulseEventSchema>;
export type APICitationEvent = z.infer<typeof CitationEventSchema>;
export type APISessionEvent = z.infer<typeof SessionEventSchema>;
export type APIResponseEvent = z.infer<typeof ResponseEventSchema>;
export type APIErrorEvent = z.infer<typeof ErrorEventSchema>;
