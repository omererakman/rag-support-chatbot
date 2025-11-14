export const sampleText = `
This is a sample document for testing purposes.
It contains multiple sentences and paragraphs.

The document discusses various topics including:
- Technology
- Science
- Mathematics

Each section provides detailed information about the subject matter.
The content is designed to test text splitting and chunking functionality.
`.trim();

export const sampleDocuments = [
  {
    text: 'What is your return policy?',
    expectedChunks: 1,
  },
  {
    text: sampleText,
    expectedChunks: 3,
  },
];

export const testConfig = {
  openaiApiKey: 'test-key',
  embeddingModel: 'text-embedding-3-small',
  llmModel: 'gpt-4o-mini',
  chunkSize: 100,
  chunkOverlap: 20,
  minChunks: 1,
  vectorStoreType: 'memory' as const,
  retrieverType: 'similarity' as const,
  topK: 5,
  scoreThreshold: 0.5,
  safetyEnabled: true,
  logLevel: 'error' as const,
  nodeEnv: 'test' as const,
};
