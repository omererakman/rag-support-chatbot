import { describe, it, expect, vi } from 'vitest';
import { createRAGChain } from '../../src/chains/rag-chain.js';
import { createMemoryVectorStore } from '../../src/vector-stores/memory.js';
import { Document } from '@langchain/core/documents';

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

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    moderations: {
      create: vi.fn().mockResolvedValue({
        results: [{
          flagged: false,
          categories: {},
          category_scores: {},
        }],
      }),
    },
  })),
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    invoke = vi.fn().mockResolvedValue({
      content: 'This is a test answer based on the context provided.',
    });
    stream = vi.fn();
  },
  OpenAIEmbeddings: class {
    embedDocuments = vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]);
    embedQuery = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
  },
}));

describe('RAG Chain E2E', () => {
  it('should create RAG chain', async () => {
    const vectorStore = await createMemoryVectorStore();
    const chain = createRAGChain(vectorStore);
    expect(chain).toBeDefined();
  });

  it('should return chunks with non-zero start and end indexes', async () => {
    const vectorStore = await createMemoryVectorStore();
    
    const documents = [
      new Document({
        pageContent: 'This is a test document with some content.',
        metadata: {
          sourceId: 'test-source-1',
          id: 'doc-1',
          startChar: 10,
          endChar: 50,
        },
      }),
      new Document({
        pageContent: 'Another test document with different content.',
        metadata: {
          sourceId: 'test-source-2',
          id: 'doc-2',
          startChar: 5,
          endChar: 45,
        },
      }),
    ];

    await vectorStore.addDocuments(documents);

    const chain = createRAGChain(vectorStore);

    const response = await chain.invoke({
      question: 'What is this about?',
    });

    expect(response).toBeDefined();
    expect(response.chunks_related).toBeDefined();
    expect(response.chunks_related.length).toBeGreaterThan(0);

    response.chunks_related.forEach((chunk, index) => {
      expect(chunk.startChar, `Chunk ${index} should have non-zero startChar`).toBeGreaterThan(0);
      expect(chunk.endChar, `Chunk ${index} should have non-zero endChar`).toBeGreaterThan(0);
      expect(chunk.endChar, `Chunk ${index} endChar should be greater than startChar`).toBeGreaterThan(chunk.startChar);
    });
  });
});
