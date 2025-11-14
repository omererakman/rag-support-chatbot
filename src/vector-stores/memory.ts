import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import { createEmbeddings } from '../embeddings/index.js';
import { logger } from '../logger.js';
import {
  saveMemoryVectorStore,
  loadMemoryVectorStore,
  deleteMemoryVectorStore,
} from './memory-vector-store.js';

export async function createMemoryVectorStore(documents?: Document[]): Promise<MemoryVectorStore> {
  const embeddings = createEmbeddings();

  if (documents && documents.length > 0) {
    logger.debug(
      { documentCount: documents.length },
      'Creating memory vector store with documents'
    );

    // Clear existing persistence before indexing
    try {
      await deleteMemoryVectorStore();
      logger.debug('Cleared existing memory vector store persistence before indexing');
    } catch (error) {
      logger.warn(
        { error },
        'Failed to clear existing memory vector store persistence, continuing'
      );
    }

    const store = await MemoryVectorStore.fromDocuments(documents, embeddings);

    try {
      await saveMemoryVectorStore(documents);
    } catch (error) {
      logger.warn(
        { error },
        'Failed to persist memory vector store, continuing without persistence'
      );
    }

    return store;
  } else {
    const storedDocuments = await loadMemoryVectorStore();

    if (storedDocuments && storedDocuments.length > 0) {
      logger.debug(
        { documentCount: storedDocuments.length },
        'Loading memory vector store from persisted storage'
      );
      return await MemoryVectorStore.fromDocuments(storedDocuments, embeddings);
    } else {
      logger.debug(
        'Creating empty memory vector store (no documents provided and no stored data found)'
      );
      return new MemoryVectorStore(embeddings);
    }
  }
}
