import { describe, it, expect, vi } from 'vitest';
import { createMemoryVectorStore } from '../../src/vector-stores/memory.js';
import { Document } from '@langchain/core/documents';
import { createMockDocuments } from '../utils/mocks.js';

vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: class {
    embedDocuments = vi.fn().mockResolvedValue([
      [0.1, 0.2, 0.3, 0.4, 0.5],
      [0.2, 0.3, 0.4, 0.5, 0.6],
      [0.3, 0.4, 0.5, 0.6, 0.7],
    ]);
    embedQuery = vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]);
  },
}));

vi.mock('../../src/config/index.js', async () => {
  const actual = await vi.importActual('../../src/config/index.js');
  return {
    ...actual,
    getConfig: vi.fn(() => ({
      llmProvider: 'openai',
      llmModel: 'gpt-4o-mini',
      embeddingProvider: 'openai',
      embeddingModel: 'text-embedding-3-small',
      openaiApiKey: 'test-key',
      chunkSize: 100,
      chunkOverlap: 20,
      minChunks: 1,
      vectorStoreType: 'memory',
      retrieverType: 'similarity',
      topK: 5,
      scoreThreshold: 0.5,
      safetyEnabled: true,
      logLevel: 'error',
      nodeEnv: 'test',
    })),
  };
});

describe('Memory Vector Store', () => {
  it('should create empty vector store', async () => {
    const store = await createMemoryVectorStore();
    expect(store).toBeDefined();
  });

  it('should create vector store with documents', async () => {
    const docs = createMockDocuments(3);
    const store = await createMemoryVectorStore(docs);
    expect(store).toBeDefined();

    const results = await store.similaritySearch('test query', 2);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should perform similarity search', async () => {
    const docs = [
      new Document({ pageContent: 'Python programming language', metadata: { id: '1' } }),
      new Document({ pageContent: 'JavaScript web development', metadata: { id: '2' } }),
      new Document({ pageContent: 'Machine learning algorithms', metadata: { id: '3' } }),
    ];

    const store = await createMemoryVectorStore(docs);
    const results = await store.similaritySearch('programming', 2);
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});
