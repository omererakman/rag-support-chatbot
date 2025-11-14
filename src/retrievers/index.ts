import { BaseRetriever } from '@langchain/core/retrievers';
import { VectorStore } from '@langchain/core/vectorstores';
import { Document } from '@langchain/core/documents';
import { getConfig } from '../config/index.js';
import { createSimilarityRetriever } from './similarity.js';
import { createMMRRetriever } from './mmr.js';
import { createCompressionRetriever } from './compression.js';
import { getCache, createCacheKey, hashData, safeCacheGet, safeCacheSet } from '../cache/index.js';
import { logger } from '../logger.js';

function wrapRetrieverWithCache(retriever: BaseRetriever): BaseRetriever {
  const config = getConfig();
  const cache = getCache();

  if (!config.cacheRetrieval || !cache) {
    return retriever;
  }

  const originalInvoke = retriever.invoke.bind(retriever);

  retriever.invoke = async (query: string): Promise<Document[]> => {
    const queryHash = hashData(query);
    const retrieverConfig = `${config.retrieverType}:${config.topK}`;
    const cacheKey = createCacheKey('retrieval', retrieverConfig, queryHash);

    const cached = await safeCacheGet<
      Array<{ pageContent: string; metadata: Record<string, unknown> }>
    >(cache, cacheKey);
    if (cached) {
      logger.debug(
        { cacheKey, query: query.substring(0, 50) },
        'Retrieval results retrieved from cache'
      );
      return cached.map(
        (item) => new Document({ pageContent: item.pageContent, metadata: item.metadata })
      );
    }

    const result = await originalInvoke(query);

    const serialized = result.map((doc) => ({
      pageContent: doc.pageContent,
      metadata: { ...doc.metadata },
    }));

    await safeCacheSet(cache, cacheKey, serialized, config.cacheTtl);
    logger.debug({ cacheKey, count: result.length }, 'Retrieval results cached');

    return result;
  };

  return retriever;
}

export function createRetriever(vectorStore: VectorStore): BaseRetriever {
  const config = getConfig();

  let retriever: BaseRetriever;

  if (config.retrieverType === 'mmr') {
    retriever = createMMRRetriever(vectorStore);
  } else if (config.retrieverType === 'compression') {
    retriever = createCompressionRetriever(createSimilarityRetriever(vectorStore));
  } else {
    retriever = createSimilarityRetriever(vectorStore);
  }

  if (config.rerankEnabled && config.retrieverType !== 'compression') {
    retriever = createCompressionRetriever(retriever);
  }

  return wrapRetrieverWithCache(retriever);
}
