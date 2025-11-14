import { Embeddings } from '@langchain/core/embeddings';
import { getConfig } from '../config/index.js';
import { logger } from '../logger.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { retryWithBackoff, isRetryableError } from '../utils/retry.js';
import { withTimeout } from '../utils/timeout.js';
import { createEmbeddingsProvider } from './providers/index.js';
import { getCache, createCacheKey, hashData, safeCacheGet, safeCacheSet } from '../cache/index.js';

const embeddingCircuitBreaker = new CircuitBreaker('embeddings', {
  failureThreshold: 5,
  resetTimeout: 60000,
  monitoringPeriod: 60000,
});

let embeddingsInstance: Embeddings | null = null;

export function createEmbeddings(): Embeddings {
  if (embeddingsInstance) {
    return embeddingsInstance;
  }

  const config = getConfig();

  embeddingsInstance = createEmbeddingsProvider(config);

  const originalEmbedDocuments = embeddingsInstance.embedDocuments.bind(embeddingsInstance);
  const originalEmbedQuery = embeddingsInstance.embedQuery.bind(embeddingsInstance);

  embeddingsInstance.embedDocuments = async (texts: string[]) => {
    const config = getConfig();
    const cache = config.cacheEmbeddings ? getCache() : null;

    if (config.cacheEmbeddings && cache) {
      const textsHash = hashData(texts);
      const cacheKey = createCacheKey('embeddings', 'documents', textsHash);

      const cached = await safeCacheGet<number[][]>(cache, cacheKey);
      if (cached) {
        logger.debug({ cacheKey, count: texts.length }, 'Embeddings retrieved from cache');
        return cached;
      }

      const result = await embeddingCircuitBreaker.execute(() =>
        retryWithBackoff(() => withTimeout(() => originalEmbedDocuments(texts), 60000), {
          maxRetries: 3,
          retryableErrors: isRetryableError,
        })
      );

      await safeCacheSet(cache, cacheKey, result, config.cacheTtl);
      logger.debug({ cacheKey, count: texts.length }, 'Embeddings cached');
      return result;
    }

    return embeddingCircuitBreaker.execute(() =>
      retryWithBackoff(() => withTimeout(() => originalEmbedDocuments(texts), 60000), {
        maxRetries: 3,
        retryableErrors: isRetryableError,
      })
    );
  };

  embeddingsInstance.embedQuery = async (text: string) => {
    const config = getConfig();
    const cache = config.cacheEmbeddings ? getCache() : null;

    if (config.cacheEmbeddings && cache) {
      const textHash = hashData(text);
      const cacheKey = createCacheKey('embeddings', 'query', textHash);

      const cached = await safeCacheGet<number[]>(cache, cacheKey);
      if (cached) {
        logger.debug({ cacheKey }, 'Query embedding retrieved from cache');
        return cached;
      }

      const result = await embeddingCircuitBreaker.execute(() =>
        retryWithBackoff(() => withTimeout(() => originalEmbedQuery(text), 30000), {
          maxRetries: 3,
          retryableErrors: isRetryableError,
        })
      );

      await safeCacheSet(cache, cacheKey, result, config.cacheTtl);
      logger.debug({ cacheKey }, 'Query embedding cached');
      return result;
    }

    return embeddingCircuitBreaker.execute(() =>
      retryWithBackoff(() => withTimeout(() => originalEmbedQuery(text), 30000), {
        maxRetries: 3,
        retryableErrors: isRetryableError,
      })
    );
  };

  logger.debug(
    { provider: config.embeddingProvider, model: config.embeddingModel },
    'Embeddings instance created'
  );
  return embeddingsInstance;
}
