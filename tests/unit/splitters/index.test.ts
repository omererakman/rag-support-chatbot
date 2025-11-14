import { describe, it, expect, vi } from 'vitest';
import { createTextSplitter } from '../../../src/splitters/index.js';

vi.mock('../../../src/config/index.js', async () => {
  const actual = await vi.importActual('../../../src/config/index.js');
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

describe('Text Splitter', () => {
  it('should create text splitter with config', () => {
    const splitter = createTextSplitter();
    expect(splitter).toBeDefined();
  });

  it('should split text into chunks', async () => {
    const splitter = createTextSplitter();
    const text = 'This is a test sentence. '.repeat(10);
    const docs = await splitter.splitText(text);
    
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every(chunk => chunk.length > 0)).toBe(true);
  });

  it('should split documents', async () => {
    const splitter = createTextSplitter();
    const { Document } = await import('@langchain/core/documents');
    const doc = new Document({
      pageContent: 'This is a test document. '.repeat(10),
      metadata: { source: 'test' },
    });
    
    const splitDocs = await splitter.splitDocuments([doc]);
    expect(splitDocs.length).toBeGreaterThan(0);
    expect(splitDocs[0].metadata.source).toBe('test');
  });
});
