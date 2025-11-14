import { z } from 'zod';
import { ConfigurationError } from '../utils/errors.js';
import { logger } from '../logger.js';

const ConfigSchema = z.object({
  llmProvider: z.enum(['openai']).default('openai'),
  llmModel: z.string().default('gpt-4o-mini'),
  embeddingProvider: z.enum(['openai']).default('openai'),
  embeddingModel: z.string().default('text-embedding-3-small'),
  openaiApiKey: z.string().min(1, 'OPENAI_API_KEY is required'),
  chunkSize: z.number().int().positive().default(800),
  chunkOverlap: z.number().int().nonnegative().default(100),
  minChunks: z.number().int().positive().default(20),
  vectorStoreType: z.enum(['chromadb', 'memory']).default('chromadb'),
  chromaCollectionName: z.string().default('support_embeddings'),
  chromaHost: z.string().default('localhost'),
  chromaPort: z.number().int().positive().default(8000),
  chromaSsl: z.boolean().default(false),
  chromaApiKey: z.string().optional(),
  retrieverType: z.enum(['similarity', 'mmr', 'compression']).default('similarity'),
  topK: z.number().int().positive().default(5),
  scoreThreshold: z.number().min(0).max(1).default(0.5),
  rerankEnabled: z.boolean().default(false),
  rerankTopN: z.number().int().positive().default(20),
  rerankTopK: z.number().int().positive().default(5),
  safetyEnabled: z.boolean().default(true),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  cacheEnabled: z.boolean().default(false),
  cacheTtl: z.number().int().positive().default(3600),
  cacheEmbeddings: z.boolean().default(false),
  cacheRetrieval: z.boolean().default(false),
  cacheLLM: z.boolean().default(false),
  confidenceEnabled: z.boolean().default(true),
  confidenceLowThreshold: z.number().min(0).max(1).default(0.4),
  confidenceMediumThreshold: z.number().min(0).max(1).default(0.6),
  confidenceHighThreshold: z.number().min(0).max(1).default(0.8),
  confidenceIncludeFactors: z.boolean().default(true),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  try {
    const rawConfig = {
      llmProvider: process.env.LLM_PROVIDER,
      llmModel: process.env.LLM_MODEL,
      embeddingProvider: process.env.EMBEDDING_PROVIDER,
      embeddingModel: process.env.EMBEDDING_MODEL,
      openaiApiKey: process.env.OPENAI_API_KEY,
      openaiBaseUrl: process.env.OPENAI_BASE_URL,
      chunkSize: process.env.CHUNK_SIZE ? parseInt(process.env.CHUNK_SIZE, 10) : undefined,
      chunkOverlap: process.env.CHUNK_OVERLAP ? parseInt(process.env.CHUNK_OVERLAP, 10) : undefined,
      minChunks: process.env.MIN_CHUNKS ? parseInt(process.env.MIN_CHUNKS, 10) : undefined,
      vectorStoreType: process.env.VECTOR_STORE_TYPE,
      chromaCollectionName: process.env.CHROMA_COLLECTION_NAME,
      chromaHost: process.env.CHROMA_HOST,
      chromaPort: process.env.CHROMA_PORT ? parseInt(process.env.CHROMA_PORT, 10) : undefined,
      chromaSsl: process.env.CHROMA_SSL === 'true',
      chromaApiKey: process.env.CHROMA_API_KEY,
      retrieverType: process.env.RETRIEVER_TYPE,
      topK: process.env.TOP_K ? parseInt(process.env.TOP_K, 10) : undefined,
      scoreThreshold: process.env.SCORE_THRESHOLD
        ? parseFloat(process.env.SCORE_THRESHOLD)
        : undefined,
      rerankEnabled: process.env.RERANK_ENABLED === 'true',
      rerankTopN: process.env.RERANK_TOP_N ? parseInt(process.env.RERANK_TOP_N, 10) : undefined,
      rerankTopK: process.env.RERANK_TOP_K ? parseInt(process.env.RERANK_TOP_K, 10) : undefined,
      safetyEnabled: process.env.SAFETY_ENABLED !== 'false',
      logLevel: process.env.LOG_LEVEL,
      nodeEnv: process.env.NODE_ENV,
      cacheEnabled: process.env.CACHE_ENABLED === 'true',
      cacheTtl: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL, 10) : undefined,
      cacheEmbeddings: process.env.CACHE_EMBEDDINGS === 'true',
      cacheRetrieval: process.env.CACHE_RETRIEVAL === 'true',
      cacheLLM: process.env.CACHE_LLM === 'true',
      confidenceEnabled: process.env.CONFIDENCE_ENABLED !== 'false',
      confidenceLowThreshold: process.env.CONFIDENCE_LOW_THRESHOLD
        ? parseFloat(process.env.CONFIDENCE_LOW_THRESHOLD)
        : undefined,
      confidenceMediumThreshold: process.env.CONFIDENCE_MEDIUM_THRESHOLD
        ? parseFloat(process.env.CONFIDENCE_MEDIUM_THRESHOLD)
        : undefined,
      confidenceHighThreshold: process.env.CONFIDENCE_HIGH_THRESHOLD
        ? parseFloat(process.env.CONFIDENCE_HIGH_THRESHOLD)
        : undefined,
      confidenceIncludeFactors: process.env.CONFIDENCE_INCLUDE_FACTORS !== 'false',
    };

    const config = ConfigSchema.parse(rawConfig);
    logger.debug(
      {
        config: {
          ...config,
          openaiApiKey: '[REDACTED]',
        },
      },
      'Configuration loaded'
    );
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = `Configuration validation failed: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger.error({ error: error.issues }, errorMessage);
      throw new ConfigurationError(errorMessage, error as Error);
    }
    throw new ConfigurationError('Failed to load configuration', error as Error);
  }
}
