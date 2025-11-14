import { z } from 'zod';

export const RAGResponseSchema = z.object({
  user_question: z.string(),
  system_answer: z.string(),
  chunks_related: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      index: z.number(),
      startChar: z.number(),
      endChar: z.number(),
      sourceId: z.string(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
  ),
  metadata: z.object({
    searchMethod: z.string(),
    topK: z.number(),
    model: z.string(),
    searchTimeMs: z.number(),
    reranked: z.boolean().optional(),
    rerankProvider: z.string().optional(),
    rerankTopN: z.number().optional(),
    rerankTopK: z.number().optional(),
    rerankTimeMs: z.number().optional(),
    tokenUsage: z
      .object({
        promptTokens: z.number(),
        completionTokens: z.number(),
        totalTokens: z.number(),
      })
      .optional(),
    timings: z.object({
      safetyCheckMs: z.number().optional(),
      retrievalMs: z.number(),
      llmGenerationMs: z.number().optional(),
      totalMs: z.number(),
    }),
    cache: z
      .object({
        embeddingsHit: z.boolean().optional(),
        retrievalHit: z.boolean().optional(),
        llmHit: z.boolean().optional(),
      })
      .optional(),
    confidence: z
      .object({
        score: z.number().min(0).max(1),
        level: z.enum(['high', 'medium', 'low', 'very_low']),
        factors: z
          .object({
            retrieval: z.number().min(0).max(1),
            relevance: z.number().min(0).max(1),
            coverage: z.number().min(0).max(1),
            answerQuality: z.number().min(0).max(1),
          })
          .optional(),
        explanation: z.string().optional(),
      })
      .optional(),
  }),
  safety: z.object({
    safe: z.boolean(),
    moderationFlagged: z.boolean(),
    injectionDetected: z.boolean(),
    piiDetected: z.boolean(),
    flaggedCategories: z.array(z.string()).optional(),
  }),
});

export type RAGResponse = z.infer<typeof RAGResponseSchema>;

export const SafetyCheckResultSchema = z.object({
  safe: z.boolean(),
  moderationResult: z.object({
    flagged: z.boolean(),
    categories: z.record(z.string(), z.boolean()),
    category_scores: z.record(z.string(), z.number()),
  }),
  injectionDetected: z.boolean(),
  piiDetected: z.object({
    detected: z.boolean(),
    types: z.record(z.string(), z.array(z.string())),
  }),
  sanitizedQuestion: z.string().optional(),
});

export type SafetyCheckResult = z.infer<typeof SafetyCheckResultSchema>;

export const ModerationResultSchema = z.object({
  flagged: z.boolean(),
  categories: z.record(z.string(), z.boolean()),
  category_scores: z.record(z.string(), z.number()),
});

export type ModerationResult = z.infer<typeof ModerationResultSchema>;

export const PIIDetectionResultSchema = z.object({
  detected: z.boolean(),
  types: z.record(z.string(), z.array(z.string())),
});

export type PIIDetectionResult = z.infer<typeof PIIDetectionResultSchema>;
